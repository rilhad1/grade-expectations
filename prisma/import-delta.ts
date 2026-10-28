/**
 * Дозавантаження оновленої таблиці журналу (Google-таблиця → data/journal.json) БЕЗ очищення бази.
 *
 * Лише ДОДАЄ те, чого ще немає: відмітки, оцінки, колонки оцінювання, результати модуля, по батькові.
 * Нічого не перезаписує й не видаляє: розклад, заняття (окрім статусу PLANNED → HELD для занять
 * з новими відмітками), студенти та вже внесені значення лишаються як є. Розбіжності з наявними
 * значеннями й неоднозначні колонки потрапляють у звіт і не записуються.
 * Усе шукається в самій БД за назвами (група, предмет, дата, ПІБ), а не за ідентифікаторами імпортера.
 *
 * Запуск: tsx --env-file=<env> prisma/import-delta.ts [--file=data/journal.json] [--apply] [--lectures]
 *   без --apply  — лише звіт (нічого не пишеться)
 *   --apply      — записати доповнення (спершу зберігає резервну копію в data/backup-*.json)
 *   --lectures   — також внести колонки «Лекція ДД.ММ.РРРР» як відвідуваність лекції
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LECTURES = args.includes('--lectures');
const FILE = args.find((a) => a.startsWith('--file='))?.slice(7) ?? 'data/journal.json';
const TODAY = new Date().toISOString().slice(0, 10);

interface Column {
  col: number;
  kind: 'date' | 'practical' | 'module' | 'skip';
  date?: string;
  dup?: number;
  title?: string;
}
interface Sheet {
  sheet: string;
  columns: Column[];
  students: { name: string; cells: Record<string, boolean | number | string> }[];
}
const sheets = JSON.parse(readFileSync(FILE, 'utf8')) as Sheet[];

const DISC_TITLE = {
  inf1: 'Інформатика (1 курс)',
  inf2: 'Інформатика (2 курс)',
  graph: "Комп'ютерна та інженерна графіка",
  met: 'Метрологія інформаційно-обчислювальних систем',
  per: 'Периферійні пристрої',
} as const;
const sheetMeta = (sheet: string) => {
  const group = sheet.split(' ')[0] ?? sheet;
  const disc: keyof typeof DISC_TITLE = sheet.includes('Метрологія')
    ? 'met'
    : sheet.endsWith(' ПП')
      ? 'per'
      : sheet.includes('Графіка')
        ? 'graph'
        : Number((group.split('-')[1] ?? '1')[0]) >= 2
          ? 'inf2'
          : 'inf1';
  return { group, disc };
};
const courseOf = (g: string) => Number((g.split('-')[1] ?? '1')[0]);
const maxOf = (g: string) => (courseOf(g) >= 3 ? 100 : 12);

function parseName(raw: string) {
  const clean = raw
    .replace(/^\s*\d+\.\s*/, '')
    .replace(/[`'’]/g, 'ʼ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = clean.split(' ');
  let last = tokens.shift() ?? '';
  if (tokens[0]?.startsWith('(')) {
    while (tokens.length > 0) {
      const t = tokens.shift() ?? '';
      last += ` ${t}`;
      if (t.endsWith(')')) break;
    }
  }
  const firstName = tokens.shift() ?? '';
  return { lastName: last, firstName, middleName: tokens.length > 0 ? tokens.join(' ') : null };
}
const keyOf = (n: { lastName: string; firstName: string }) =>
  `${n.lastName} ${n.firstName}`.toLowerCase().replaceAll('ʼ', '').replaceAll("'", '');
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (x: Date) => x.toISOString().slice(0, 10);
const newId = (key: string): string => {
  const h = createHash('sha1').update(`grade-expectations-delta:${key}`).digest();
  h[6] = ((h[6] ?? 0) & 0x0f) | 0x50;
  h[8] = ((h[8] ?? 0) & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
};

// ── Збір доповнень ───────────────────────────────────
const notes: string[] = [];
const conflicts: string[] = [];
const skipped: string[] = [];
const stats = {
  attendance: 0,
  grades: 0,
  assessments: 0,
  results: 0,
  middleNames: 0,
  lessonsToHeld: 0,
  same: 0,
};

const newAttendance: { lessonId: string; enrollmentId: string; status: 'PRESENT' | 'ABSENT' }[] =
  [];
const newAssessments: {
  id: string;
  loadId: string;
  kind: 'LAB' | 'TEST';
  title: string;
  maxScore: number;
  attestationKind: 'INTERIM' | 'DIRECTOR_TEST';
  order: number;
}[] = [];
const newGrades: {
  id: string;
  enrollmentId: string;
  assessmentId: string;
  kind: 'PRACTICE' | 'TEST';
  value: number;
}[] = [];
const newResults: {
  id: string;
  attestationId: string;
  loadId: string;
  enrollmentId: string;
  final: string;
}[] = [];
const middleNameUpdates: { id: string; middleName: string }[] = [];
const heldLessonIds = new Set<string>();

const semester = await prisma.semester.findFirst({
  where: { startDate: { lte: d(TODAY) }, endDate: { gte: d(TODAY) }, deletedAt: null },
});
if (!semester) throw new Error('Не знайдено поточний семестр');

for (const sh of sheets) {
  const { group, disc } = sheetMeta(sh.sheet);
  const title = DISC_TITLE[disc];
  const loads = await prisma.teachingLoad.findMany({
    where: {
      semesterId: semester.id,
      deletedAt: null,
      group: { name: group },
      discipline: { title },
    },
  });
  const practical = loads.find((l) => l.kind === 'PRACTICE');
  const lecture = loads.find((l) => l.kind === 'LECTURE');
  if (!practical) {
    skipped.push(`${sh.sheet}: у БД немає практичного навантаження «${title}» для ${group}`);
    continue;
  }

  // студенти групи за ПІБ
  const enrollments = await prisma.enrollment.findMany({
    where: { group: { name: group }, deletedAt: null },
    include: { student: true },
  });
  const enrByKey = new Map(enrollments.map((e) => [keyOf(e.student), e]));

  // заняття цих навантажень за датою
  const lessonRows = await prisma.lesson.findMany({
    where: { loadId: { in: loads.map((l) => l.id) }, deletedAt: null },
    orderBy: [{ date: 'asc' }, { pairNumber: 'asc' }],
  });
  const lessonsOf = (loadId: string | undefined, date: string) =>
    lessonRows.filter((l) => l.loadId === loadId && iso(l.date) === date);

  const moduleAt = sh.columns.find((c) => c.kind === 'module')?.col ?? Infinity;
  const hasValue = (col: Column) => sh.students.some((r) => r.cells[String(col.col)] !== undefined);
  const hasTrue = (col: Column) => sh.students.some((r) => r.cells[String(col.col)] === true);

  // яке заняття відповідає колонці
  const lessonByCol = new Map<number, { id: string; status: string }>();
  for (const col of sh.columns) {
    let date: string | undefined;
    let loadId: string | undefined;
    let dup = 1;
    if (col.kind === 'date') {
      date = col.date;
      dup = col.dup ?? 1;
    } else if (col.kind === 'skip') {
      const m = /^Лекція\s+(\d{2})\.(\d{2})\.(\d{4})$/.exec(col.title ?? '');
      if (m) {
        date = `${m[3]}-${m[2]}-${m[1]}`;
        loadId = lecture?.id;
        if (!hasValue(col)) continue;
        if (!LECTURES) {
          skipped.push(
            `${sh.sheet}: колонка «${col.title ?? ''}» (${hasTrue(col) ? 'є присутні' : 'порожня'}) — потрібен прапорець --lectures`,
          );
          continue;
        }
      } else if (hasValue(col) && (col.title ?? '').toLowerCase() !== 'ratatype') {
        skipped.push(`${sh.sheet}: колонка «${col.title ?? ''}» невідома, не внесено`);
        continue;
      }
    }
    if (!date) continue;
    if (!hasValue(col) || !hasTrue(col)) continue; // порожня/без присутніх — відвідуваність не вносилась
    let found = loadId ? lessonsOf(loadId, date) : lessonsOf(practical.id, date);
    if (!loadId && found.length === 0) found = lessonsOf(lecture?.id, date);
    const lesson = date > TODAY ? undefined : found[dup - 1];
    if (!lesson) {
      // Давня друкарська помилка в місяці (22.10 замість 22.09): її відмітки вже внесені на правильну дату
      const prev = `${date.slice(0, 5)}${String(Number(date.slice(5, 7)) - 1).padStart(2, '0')}${date.slice(7)}`;
      const earlier = lessonsOf(practical.id, prev)[dup - 1];
      if (
        earlier &&
        (await prisma.attendance.count({ where: { lessonId: earlier.id, deletedAt: null } })) > 0
      ) {
        notes.push(
          `${sh.sheet}: колонка ${date} — це вже внесене ${prev} (помилка в місяці), пропущено`,
        );
        continue;
      }
    }
    if (date > TODAY) {
      skipped.push(`${sh.sheet}: ${date} у майбутньому з відмітками — не внесено`);
      continue;
    }
    if (!lesson) {
      skipped.push(
        `${sh.sheet}: ${date}${dup > 1 ? ` (${String(dup)}-та пара)` : ''} — у розкладі такого заняття немає, відмітки не внесено`,
      );
      continue;
    }
    lessonByCol.set(col.col, { id: lesson.id, status: lesson.status });
  }

  // колонки оцінювання: знайти або створити
  // Разом із видаленими: видалену в застосунку колонку/оцінку не воскрешаємо
  const existingAssessments = await prisma.assessment.findMany({
    where: { loadId: practical.id },
  });
  const assessmentByCol = new Map<number, string>();
  for (const col of sh.columns) {
    if (col.kind !== 'practical' && col.kind !== 'module') continue;
    if (!hasValue(col)) continue;
    const t = col.title ?? '';
    const ex = existingAssessments.find((a) => a.title.toLowerCase() === t.toLowerCase());
    if (ex) {
      if (ex.deletedAt !== null) {
        skipped.push(`${sh.sheet}: колонку «${t}» видалено в застосунку, не відновлено`);
        continue;
      }
      assessmentByCol.set(col.col, ex.id);
      continue;
    }
    if (/^практична\s+\d+\s+\d/i.test(t)) {
      skipped.push(`${sh.sheet}: нова колонка «${t}» має схожу на помилку назву, не створено`);
      continue;
    }
    const a = {
      id: newId(`assessment:${practical.id}|${t.toLowerCase()}`),
      loadId: practical.id,
      kind: col.kind === 'module' ? ('TEST' as const) : ('LAB' as const),
      title: t,
      maxScore: maxOf(group),
      attestationKind: col.col <= moduleAt ? ('INTERIM' as const) : ('DIRECTOR_TEST' as const),
      order: col.col,
    };
    newAssessments.push(a);
    assessmentByCol.set(col.col, a.id);
    stats.assessments++;
    notes.push(`${sh.sheet}: нова колонка оцінювання «${t}»`);
  }

  const existingAtt = await prisma.attendance.findMany({
    where: { lessonId: { in: [...lessonByCol.values()].map((l) => l.id) } },
  });
  const attByKey = new Map(existingAtt.map((a) => [`${a.lessonId}|${a.enrollmentId}`, a]));
  const existingGrades = await prisma.grade.findMany({
    where: {
      assessmentId: { in: [...assessmentByCol.values()] },
    },
  });
  const gradeByKey = new Map(existingGrades.map((g) => [`${g.assessmentId}|${g.enrollmentId}`, g]));
  const attestation =
    (await prisma.attestation.findFirst({
      where: { semesterId: semester.id, kind: 'INTERIM', course: courseOf(group), deletedAt: null },
    })) ??
    (await prisma.attestation.findFirst({
      where: { semesterId: semester.id, kind: 'INTERIM', course: 0, deletedAt: null },
    }));
  const existingResults = await prisma.attestationResult.findMany({
    where: { loadId: practical.id },
  });
  const resultByEnr = new Map(
    existingResults.map((r) => [`${r.attestationId}|${r.enrollmentId}`, r]),
  );

  const missing = new Set<string>();
  for (const r of sh.students) {
    const n = parseName(r.name);
    const e = enrByKey.get(keyOf(n));
    if (!e) {
      if (!missing.has(r.name)) {
        missing.add(r.name);
        skipped.push(
          `${sh.sheet}: студента «${r.name}» немає в групі ${group} у БД, його дані не внесено`,
        );
      }
      continue;
    }
    if (n.middleName && !e.student.middleName) {
      middleNameUpdates.push({ id: e.student.id, middleName: n.middleName });
      stats.middleNames++;
    }
    for (const col of sh.columns) {
      const v = r.cells[String(col.col)];
      if (v === undefined) continue;
      const lesson = lessonByCol.get(col.col);
      if (lesson && typeof v === 'boolean') {
        const status = v ? 'PRESENT' : 'ABSENT';
        const ex = attByKey.get(`${lesson.id}|${e.id}`);
        if (!ex) {
          newAttendance.push({ lessonId: lesson.id, enrollmentId: e.id, status });
          stats.attendance++;
          if (lesson.status !== 'HELD') heldLessonIds.add(lesson.id);
        } else if (ex.deletedAt === null && ex.status !== status) {
          conflicts.push(
            `${sh.sheet}: ${r.name}, ${col.date ?? col.title ?? ''}: у БД ${ex.status === 'PRESENT' ? 'присутній' : 'н'}, у таблиці ${v ? 'присутній' : 'н'}`,
          );
        } else stats.same++;
        continue;
      }
      const aid = assessmentByCol.get(col.col);
      if (!aid) continue;
      if (typeof v === 'number') {
        const value = Math.round(v);
        const ex = gradeByKey.get(`${aid}|${e.id}`);
        if (!ex) {
          newGrades.push({
            id: newId(`grade:${aid}:${e.id}`),
            enrollmentId: e.id,
            assessmentId: aid,
            kind: col.kind === 'module' ? 'TEST' : 'PRACTICE',
            value,
          });
          stats.grades++;
        } else if (ex.deletedAt === null && ex.value !== value) {
          conflicts.push(
            `${sh.sheet}: ${r.name}, «${col.title ?? ''}»: у БД ${String(ex.value)}, у таблиці ${String(value)}`,
          );
        } else stats.same++;
      }
      if (
        col.kind === 'module' &&
        attestation &&
        (typeof v === 'number' || typeof v === 'string')
      ) {
        const final =
          typeof v === 'number' ? String(Math.round(v)) : v.trim() === 'є' ? 'зар.' : v.trim();
        const ex = resultByEnr.get(`${attestation.id}|${e.id}`);
        if (!ex) {
          newResults.push({
            id: newId(`result:${attestation.id}:${practical.id}:${e.id}`),
            attestationId: attestation.id,
            loadId: practical.id,
            enrollmentId: e.id,
            final,
          });
          stats.results++;
        } else if (ex.deletedAt === null && ex.final !== final) {
          conflicts.push(
            `${sh.sheet}: ${r.name}, підсумок модуля: у БД «${ex.final ?? ''}», у таблиці «${final}»`,
          );
        }
      }
    }
  }
}
stats.lessonsToHeld = heldLessonIds.size;

// ── Звіт ─────────────────────────────────────────────
console.log(APPLY ? 'РЕЖИМ ЗАПИСУ' : 'ЛИШЕ ЗВІТ (нічого не пишеться; додай --apply)');
console.log('Буде додано:', stats);
console.log('\nНові колонки оцінювання:');
for (const n of notes) console.log(' +', n);
console.log(
  `\nРозбіжності з наявними значеннями (НЕ перезаписуються): ${String(conflicts.length)}`,
);
for (const c of conflicts) console.log(' ≠', c);
console.log(`\nПропущено (потрібне рішення): ${String(skipped.length)}`);
for (const s of skipped) console.log(' ?', s);

if (!APPLY) {
  await prisma.$disconnect();
  process.exit(0);
}

// ── Резервна копія й запис ───────────────────────────
mkdirSync('data', { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-');
const backup = {
  students: await prisma.student.findMany(),
  lessons: await prisma.lesson.findMany(),
  attendance: await prisma.attendance.findMany(),
  assessments: await prisma.assessment.findMany(),
  grades: await prisma.grade.findMany(),
  results: await prisma.attestationResult.findMany(),
};
const backupFile = `data/backup-${stamp}.json`;
writeFileSync(
  backupFile,
  JSON.stringify(backup, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)),
);
console.log(`\nРезервна копія: ${backupFile}`);

await prisma.$transaction(
  async (tx) => {
    await tx.assessment.createMany({
      data: newAssessments.map((a) => ({
        id: a.id,
        loadId: a.loadId,
        kind: a.kind,
        title: a.title,
        maxScore: a.maxScore,
        attestationKind: a.attestationKind,
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, 0, a.order)),
      })),
      skipDuplicates: true,
    });
    await tx.attendance.createMany({ data: newAttendance, skipDuplicates: true });
    await tx.grade.createMany({
      data: newGrades.map((g) => ({
        id: g.id,
        enrollmentId: g.enrollmentId,
        assessmentId: g.assessmentId,
        kind: g.kind,
        value: g.value,
      })),
      skipDuplicates: true,
    });
    await tx.attestationResult.createMany({
      data: newResults.map((r) => ({ ...r, confirmed: true })),
      skipDuplicates: true,
    });
    await tx.lesson.updateMany({
      where: { id: { in: [...heldLessonIds] }, status: 'PLANNED' },
      data: { status: 'HELD' },
    });
    for (const m of middleNameUpdates)
      await tx.student.updateMany({
        where: { id: m.id, middleName: null },
        data: { middleName: m.middleName },
      });
  },
  { timeout: 120_000, maxWait: 20_000 },
);
console.log('Записано.', {
  відміток: await prisma.attendance.count(),
  оцінок: await prisma.grade.count(),
});
await prisma.$disconnect();
