/**
 * Імпорт реальних даних (журнал викладача з Google-таблиці) замість демо-даних.
 *
 * Вхід: data/journal.json (scripts/export-journal.py; персональні дані, не комітиться).
 * Запуск: tsx --env-file=<env> prisma/import-real.ts [--wipe] [--dry]
 *   --wipe  спершу очистити всі таблиці застосунку (окрім _prisma_migrations)
 *   --dry   лише розібрати файл і вивести звіт, нічого не писати в БД
 * Змінні: DATABASE_URL, IMPORT_EMAIL, IMPORT_PASSWORD (мін. 8 символів).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { generateLessons, type ScheduleSlotInput, type SemesterInput } from '@ge/domain';
import { defaultGradingRules, type IsoDate } from '@ge/shared';
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

type SlotParity = ScheduleSlotInput['parity'];

const prisma = new PrismaClient();
const args = new Set(process.argv.slice(2));
const TODAY: IsoDate = '2026-10-07';

function id(key: string): string {
  const h = createHash('sha1').update(`grade-expectations-real:${key}`).digest();
  h[6] = ((h[6] ?? 0) & 0x0f) | 0x50;
  h[8] = ((h[8] ?? 0) & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const weekdayOf = (iso: string): number => ((d(iso).getUTCDay() + 6) % 7) + 1;

// ── Вхідний файл ────────────────────────────────────
interface Column {
  col: number;
  kind: 'date' | 'practical' | 'module' | 'skip';
  date?: string;
  dup?: number;
  title?: string;
}
interface SheetRow {
  name: string;
  cells: Record<string, boolean | number | string>;
}
interface Sheet {
  sheet: string;
  columns: Column[];
  students: SheetRow[];
}
const sheets = JSON.parse(readFileSync('data/journal.json', 'utf8')) as Sheet[];

// ── Довідкові дані (з календаря викладача) ──────────
type Kind = 'LECTURE' | 'PRACTICE';
const DISC = {
  inf: { title: 'Інформатика', short: 'Інформ.', color: '#3B6EA5', control: 'CREDIT' },
  graph: {
    title: "Комп'ютерна та інженерна графіка",
    short: 'Графіка',
    color: '#7B5E8D',
    control: 'EXAM',
  },
  met: {
    title: 'Метрологія інформаційно-обчислювальних систем',
    short: 'Метр.',
    color: '#8A6D3B',
    control: 'CREDIT',
  },
  per: { title: 'Периферійні пристрої', short: 'Периф.', color: '#4F7F5F', control: 'CREDIT' },
} as const;
type DiscKey = keyof typeof DISC;

/** Пари: 1 = 08:00, далі за календарем (80 хв + перерви). */
const BELLS: [string, string][] = [
  ['08:00', '09:20'],
  ['09:35', '10:55'],
  ['11:10', '12:30'],
  ['12:50', '14:10'],
  ['14:25', '15:45'],
  ['16:00', '17:20'],
  ['17:35', '18:55'],
  ['19:00', '20:20'],
];

const sheetMeta = (sheet: string): { group: string; disc: DiscKey } => {
  const group = sheet.split(' ')[0] ?? sheet;
  const disc: DiscKey = sheet.includes('Метрологія')
    ? 'met'
    : sheet.endsWith(' ПП')
      ? 'per'
      : sheet.includes('Графіка')
        ? 'graph'
        : 'inf';
  return { group, disc };
};

interface SlotDef {
  group: string;
  disc: DiscKey;
  kind: Kind;
  weekday: number;
  pair: number;
  parity: SlotParity;
  room: string | null;
}
const S = (
  group: string,
  disc: DiscKey,
  kind: Kind,
  weekday: number,
  pair: number,
  parity: SlotParity,
  room: string | null,
): SlotDef => ({ group, disc, kind, weekday, pair, parity, room });
const KIT = ['КІт-31', 'КІт-32', 'КІт-33', 'КІт-34'];
const slotDefs: SlotDef[] = [
  // Інформатика та графіка (практичні)
  S('АТТт-22', 'inf', 'PRACTICE', 1, 4, 'EVERY', '2309'),
  S('АТТт-21', 'inf', 'PRACTICE', 1, 6, 'BOTTOM', '2303'),
  S('АТт-21', 'inf', 'PRACTICE', 1, 7, 'EVERY', '2309'),
  S('АТт-31', 'graph', 'PRACTICE', 1, 8, 'EVERY', '2209'),
  S('ПДт-13', 'inf', 'PRACTICE', 2, 2, 'BOTTOM', '2113'),
  S('ПДт-11', 'inf', 'PRACTICE', 2, 3, 'BOTTOM', '2113'),
  S('ПДт-12', 'inf', 'PRACTICE', 2, 3, 'TOP', '2113'),
  S('АТТт-21', 'inf', 'PRACTICE', 2, 6, 'EVERY', '2303'),
  S('АТТт-22', 'inf', 'PRACTICE', 2, 7, 'TOP', '2209'),
  S('АТт-21', 'inf', 'PRACTICE', 2, 8, 'TOP', '2209'),
  S('АТт-31', 'graph', 'PRACTICE', 4, 4, 'EVERY', '2209'),
  S('АТт-11', 'inf', 'PRACTICE', 5, 3, 'BOTTOM', null),
  // Метрологія: практичні по групах (середа) і потокова лекція (вівторок)
  S('КІт-31', 'met', 'PRACTICE', 3, 4, 'EVERY', '2403'),
  S('КІт-32', 'met', 'PRACTICE', 3, 5, 'EVERY', '2203'),
  S('КІт-33', 'met', 'PRACTICE', 3, 7, 'EVERY', '2209'),
  S('КІт-34', 'met', 'PRACTICE', 3, 8, 'EVERY', '2209'),
  ...KIT.map((g) => S(g, 'met', 'LECTURE', 2, 5, 'EVERY', '2203')),
  // Периферійні пристрої: практичні (за словами викладача) і потокова лекція (понеділок)
  S('КІт-31', 'per', 'PRACTICE', 2, 4, 'TOP', '2203'),
  S('КІт-32', 'per', 'PRACTICE', 3, 6, 'TOP', '2113'),
  S('КІт-33', 'per', 'PRACTICE', 3, 6, 'BOTTOM', '2209'),
  S('КІт-34', 'per', 'PRACTICE', 1, 6, 'TOP', '2309'),
  ...KIT.map((g) => S(g, 'per', 'LECTURE', 1, 5, 'EVERY', '2111')),
];

const semesterInput: SemesterInput = {
  startDate: '2026-09-01',
  endDate: '2026-12-23',
  firstWeekParity: 'TOP',
  parityAfterBreak: 'CONTINUE',
  periods: [],
};

// ── Розбір імен ─────────────────────────────────────
function parseName(raw: string): {
  lastName: string;
  firstName: string;
  middleName: string | null;
} {
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
const studentKey = (n: { lastName: string; firstName: string }) =>
  `${n.lastName} ${n.firstName}`.toLowerCase().replaceAll('ʼ', '');

// ── Побудова моделі ─────────────────────────────────
const warnings: string[] = [];
const warn = (m: string) => warnings.push(m);

const groups = [...new Set(sheets.map((s) => sheetMeta(s.sheet).group))];
const courseOf = (g: string) => Number((g.split('-')[1] ?? '1')[0]);
const scaleOf = (g: string) => (courseOf(g) >= 3 ? 'HUNDRED' : 'TWELVE');
const maxOf = (g: string) => (courseOf(g) >= 3 ? 100 : 12);

const ORG = id('org');
const YEAR = id('year');
const SEMESTER = id('semester');
const SCHEDULE = id('schedule');
const USER = id('user');
const roomId = (name: string) => id(`room:${name}`);
const groupId = (g: string) => id(`group:${g}`);
const discId = (k: DiscKey) => id(`discipline:${k}`);
const loadId = (g: string, k: DiscKey, kind: Kind) => id(`load:${g}:${k}:${kind}`);

// Студенти: по групі, об'єднуємо аркуші однієї групи за прізвищем та ім'ям
const studentsByGroup = new Map<string, Map<string, ReturnType<typeof parseName>>>();
for (const sh of sheets) {
  const { group } = sheetMeta(sh.sheet);
  const map = studentsByGroup.get(group) ?? new Map<string, ReturnType<typeof parseName>>();
  for (const r of sh.students) {
    const n = parseName(r.name);
    const k = studentKey(n);
    if (!map.has(k)) map.set(k, n);
  }
  studentsByGroup.set(group, map);
}
const studentId = (g: string, k: string) => id(`student:${g}:${k}`);
const enrollmentId = (g: string, k: string) => id(`enrollment:${g}:${k}`);

// Навантаження: яке потрібне за slotDefs
const loadsUsed = new Map<string, SlotDef>();
for (const s of slotDefs) loadsUsed.set(loadId(s.group, s.disc, s.kind), s);

// Слоти
const slots: (ScheduleSlotInput & { def: SlotDef })[] = slotDefs.map((s, i) => ({
  id: id(`slot:${i}`),
  loadId: loadId(s.group, s.disc, s.kind),
  weekday: s.weekday,
  pairNumber: s.pair,
  parity: s.parity,
  roomId: s.room ? roomId(s.room) : null,
  validFrom: semesterInput.startDate,
  validTo: null,
  def: s,
}));
// Сесія 14–23 грудня є лише у 2–3 курсів: пар у ці дні в них немає, а в першого курсу заняття тривають
const generationInput: SemesterInput = {
  ...semesterInput,
  periods: [2, 3].map((course) => ({
    kind: 'EXAM_SESSION' as const,
    startDate: '2026-12-14',
    endDate: '2026-12-23',
    course,
  })),
};
const loadCourses = new Map(
  slotDefs.map((s) => [loadId(s.group, s.disc, s.kind), courseOf(s.group)]),
);
const { create: generated } = generateLessons(generationInput, { version: 1, slots }, [], {
  loadCourses,
});
type Gen = (typeof generated)[number];
const genByLoadDate = new Map<string, Gen>();
for (const g of generated) genByLoadDate.set(`${g.loadId}|${g.date}`, g);

interface LessonRow {
  id: string;
  loadId: string;
  slotId: string | null;
  date: string;
  pairNumber: number;
  roomId: string | null;
  scheduleVersion: number | null;
}
const lessons = new Map<string, LessonRow>(); // ключ loadId|date|pair
for (const g of generated) {
  lessons.set(`${g.loadId}|${g.date}|${g.pairNumber}`, {
    id: id(`lesson:${g.loadId}|${g.date}|${g.pairNumber}`),
    loadId: g.loadId,
    slotId: g.slotId,
    date: g.date,
    pairNumber: g.pairNumber,
    roomId: g.roomId,
    scheduleVersion: g.scheduleVersion,
  });
}

interface AttRow {
  lessonId: string;
  enrollmentId: string;
  status: 'PRESENT' | 'ABSENT';
}
interface GradeRow {
  id: string;
  enrollmentId: string;
  assessmentId: string;
  kind: 'PRACTICE' | 'TEST';
  value: number;
}
interface ResultRow {
  loadId: string;
  enrollmentId: string;
  final: string;
}
const attendance: AttRow[] = [];
const grades: GradeRow[] = [];
const results: ResultRow[] = [];
const assessments = new Map<
  string,
  {
    id: string;
    loadId: string;
    kind: 'LAB' | 'TEST';
    title: string;
    maxScore: number;
    attestationKind: 'INTERIM' | 'DIRECTOR_TEST';
    order: number;
  }
>();
const heldLessons = new Set<string>();
const extraLessons: string[] = [];

for (const sh of sheets) {
  const { group, disc } = sheetMeta(sh.sheet);
  const practicalLoad = loadId(group, disc, 'PRACTICE');
  const lectureLoad = slotDefs.some(
    (s) => s.group === group && s.disc === disc && s.kind === 'LECTURE',
  )
    ? loadId(group, disc, 'LECTURE')
    : null;
  const slotPair = (kind: Kind, weekday: number): number | null =>
    slotDefs.find(
      (s) => s.group === group && s.disc === disc && s.kind === kind && s.weekday === weekday,
    )?.pair ?? null;

  // Яке заняття відповідає колонці-даті: практичні мають пріоритет над лекцією, інакше — додаткова пара
  const pickLesson = (col: Column): LessonRow | null => {
    const date = col.date ?? '';
    const dup = col.dup ?? 1;
    if (dup === 1) {
      for (const l of [practicalLoad, lectureLoad]) {
        if (l === null) continue;
        const g = genByLoadDate.get(`${l}|${date}`);
        if (g) return lessons.get(`${l}|${date}|${String(g.pairNumber)}`) ?? null;
      }
    }
    const wd = weekdayOf(date);
    const lectureDay =
      lectureLoad !== null && slotPair('LECTURE', wd) !== null && slotPair('PRACTICE', wd) === null;
    const target = lectureDay && lectureLoad ? lectureLoad : practicalLoad;
    const pair = (slotPair(lectureDay ? 'LECTURE' : 'PRACTICE', wd) ?? 1) + (dup - 1);
    const key = `${target}|${date}|${String(pair)}`;
    let row = lessons.get(key);
    if (!row) {
      row = {
        id: id(`lesson:${key}`),
        loadId: target,
        slotId: null,
        date,
        pairNumber: pair,
        roomId: null,
        scheduleVersion: null,
      };
      lessons.set(key, row);
      extraLessons.push(
        `${sh.sheet}: ${date} (пара ${String(pair)}) — немає в календарі, додано як додаткову`,
      );
    }
    return row;
  };

  // Колонки оцінювання до «Модуль 1» (і він сам) належать до 1-ї рубіжної атестації, решта — до наступної
  const moduleAt = sh.columns.find((c) => c.kind === 'module')?.col ?? Infinity;

  const lessonByCol = new Map<number, LessonRow>();
  for (const col of sh.columns) {
    if (col.kind !== 'date') continue;
    // Порожні колонки (майбутні дати без відміток) ігноруємо: істина — календар
    if (!sh.students.some((r) => r.cells[String(col.col)] !== undefined)) continue;
    // Відмітки на майбутню дату — друкарська помилка в місяці (22.10 замість 22.09): зсуваємо на місяць назад
    if ((col.date ?? '') > TODAY) {
      const fixed = `${(col.date ?? '').slice(0, 5)}${String(Number((col.date ?? '').slice(5, 7)) - 1).padStart(2, '0')}${(col.date ?? '').slice(7)}`;
      warn(`${sh.sheet}: дата ${col.date ?? ''} з відмітками в майбутньому, прийнято як ${fixed}`);
      col.date = fixed;
    }
    const row = pickLesson(col);
    if (row) lessonByCol.set(col.col, row);
  }

  for (const col of sh.columns) {
    if (col.kind === 'practical' || col.kind === 'module') {
      const key = `${practicalLoad}|${col.title ?? ''}`;
      if (!assessments.has(key))
        assessments.set(key, {
          id: id(`assessment:${key}`),
          loadId: practicalLoad,
          kind: col.kind === 'module' ? 'TEST' : 'LAB',
          title: col.title ?? '',
          maxScore: maxOf(group),
          attestationKind: col.col <= moduleAt ? ('INTERIM' as const) : ('DIRECTOR_TEST' as const),
          order: col.col,
        });
    }
  }

  // Колонка, де нікого немає, — заняття було, але відвідуваність не вносилась: відміток не створюємо
  const columnHasPresent = new Map<number, boolean>();
  for (const col of sh.columns)
    columnHasPresent.set(
      col.col,
      sh.students.some((r) => r.cells[String(col.col)] === true),
    );

  for (const r of sh.students) {
    const n = parseName(r.name);
    const k = studentKey(n);
    const enr = enrollmentId(group, k);
    for (const col of sh.columns) {
      const v = r.cells[String(col.col)];
      if (v === undefined) continue;
      if (col.kind === 'date') {
        const lesson = lessonByCol.get(col.col);
        if (!lesson || typeof v !== 'boolean' || !columnHasPresent.get(col.col)) continue;
        attendance.push({
          lessonId: lesson.id,
          enrollmentId: enr,
          status: v ? 'PRESENT' : 'ABSENT',
        });
        heldLessons.add(lesson.id);
      } else if (col.kind === 'practical' || col.kind === 'module') {
        const a = assessments.get(`${practicalLoad}|${col.title ?? ''}`);
        if (!a) continue;
        if (typeof v === 'number') {
          grades.push({
            id: id(`grade:${a.id}:${enr}`),
            enrollmentId: enr,
            assessmentId: a.id,
            kind: col.kind === 'module' ? 'TEST' : 'PRACTICE',
            value: Math.round(v),
          });
          if (col.kind === 'module')
            results.push({
              loadId: practicalLoad,
              enrollmentId: enr,
              final: String(Math.round(v)),
            });
        } else if (typeof v === 'string' && col.kind === 'module') {
          results.push({
            loadId: practicalLoad,
            enrollmentId: enr,
            final: v.trim() === 'є' ? 'зар.' : v.trim(),
          });
        }
      }
    }
  }
}

// Дублі (одна й та сама клітинка двічі) — залишаємо останнє
const attMap = new Map(attendance.map((a) => [`${a.lessonId}|${a.enrollmentId}`, a]));

// ── Звіт ────────────────────────────────────────────
for (const g of groups) {
  const own = sheets.filter((s) => sheetMeta(s.sheet).group === g);
  if (own.length < 2) continue;
  const sets = own.map((s) => new Set(s.students.map((r) => studentKey(parseName(r.name)))));
  const all = studentsByGroup.get(g) ?? new Map<string, ReturnType<typeof parseName>>();
  for (const k of all.keys())
    sets.forEach((set, i) => {
      if (!set.has(k)) warn(`${g}: «${k}» є не в усіх аркушах (немає в «${own[i]?.sheet ?? ''}»)`);
    });
}
const report = {
  групи: groups.length,
  студенти: [...studentsByGroup.values()].reduce((a, m) => a + m.size, 0),
  навантаження: loadsUsed.size,
  слотів: slots.length,
  заняття: lessons.size,
  'з відмітками (проведені)': heldLessons.size,
  присутність: attMap.size,
  'колонки оцінювання': assessments.size,
  оцінки: grades.length,
  'результати модуля': results.length,
};
console.log('Звіт імпорту:', report);
for (const w of [...warnings, ...extraLessons]) console.log(' •', w);

if (args.has('--dry')) {
  await prisma.$disconnect();
  process.exit(0);
}

// ── Запис ───────────────────────────────────────────
const email = process.env['IMPORT_EMAIL'];
const password = process.env['IMPORT_PASSWORD'];
if (!email || !password || password.length < 8) {
  throw new Error('Задай IMPORT_EMAIL і IMPORT_PASSWORD (мінімум 8 символів)');
}

if (args.has('--wipe')) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`Очищено таблиць: ${String(tables.length)}`);
}

const insert = { skipDuplicates: true } as const;
await prisma.organization.createMany({
  data: [{ id: ORG, title: 'ФКЕПІТ', timezone: 'Europe/Kyiv' }],
  ...insert,
});
await prisma.user.createMany({
  data: [{ id: USER, email, fullName: 'Бойчук Володимир Васильович', emailVerified: true }],
  ...insert,
});
await prisma.account.createMany({
  data: [
    {
      id: id('account'),
      userId: USER,
      accountId: USER,
      providerId: 'credential',
      password: await hashPassword(password),
    },
  ],
  ...insert,
});
await prisma.membership.createMany({
  data: [
    { id: id('membership'), userId: USER, organizationId: ORG, roles: ['TEACHER', 'MODERATOR'] },
  ],
  ...insert,
});
await prisma.bellTime.createMany({
  data: BELLS.map(([startsAt, endsAt], i) => ({
    organizationId: ORG,
    pairNumber: i + 1,
    startsAt,
    endsAt,
  })),
  ...insert,
});
const roomNames = [...new Set(slotDefs.map((s) => s.room).filter((r): r is string => r !== null))];
await prisma.room.createMany({
  data: roomNames.map((name) => ({ id: roomId(name), organizationId: ORG, name })),
  ...insert,
});
await prisma.academicYear.createMany({
  data: [
    {
      id: YEAR,
      organizationId: ORG,
      title: '2026/2027',
      startDate: d('2026-09-01'),
      endDate: d('2027-06-30'),
    },
  ],
  ...insert,
});
await prisma.semester.createMany({
  data: [
    {
      id: SEMESTER,
      academicYearId: YEAR,
      number: 1,
      startDate: d(semesterInput.startDate),
      endDate: d(semesterInput.endDate),
      firstWeekParity: semesterInput.firstWeekParity,
      parityAfterBreak: semesterInput.parityAfterBreak,
      status: 'ACTIVE',
    },
  ],
  ...insert,
});
// Графік атестацій за курсами (з графіка навчання на I семестр 2026/2027)
const SCHEDULE_BY_COURSE: Record<
  number,
  {
    interim: [string, string];
    director: [string, string];
    average: [string, string];
    exam: [string, string] | null;
  }
> = {
  1: {
    interim: ['2026-10-05', '2026-10-16'],
    director: ['2026-11-23', '2026-12-04'],
    average: ['2026-12-14', '2026-12-23'],
    exam: null,
  },
  2: {
    interim: ['2026-09-28', '2026-10-09'],
    director: ['2026-11-16', '2026-11-27'],
    average: ['2026-11-30', '2026-12-11'],
    exam: ['2026-12-14', '2026-12-23'],
  },
};
SCHEDULE_BY_COURSE[3] = SCHEDULE_BY_COURSE[2] as (typeof SCHEDULE_BY_COURSE)[number];
const courses = [...new Set(groups.map(courseOf))].sort();
const periodRows = courses.flatMap((course) => {
  const sc = SCHEDULE_BY_COURSE[course];
  if (!sc) return [];
  return [
    { kind: 'INTERIM_ATTESTATION' as const, course, range: sc.interim },
    { kind: 'DIRECTOR_TEST' as const, course, range: sc.director },
    ...(sc.exam ? [{ kind: 'EXAM_SESSION' as const, course, range: sc.exam }] : []),
  ];
});
await prisma.semesterPeriod.createMany({
  data: periodRows.map((p) => ({
    id: id(`period:${p.kind}:${String(p.course)}`),
    semesterId: SEMESTER,
    kind: p.kind,
    course: p.course,
    startDate: d(p.range[0]),
    endDate: d(p.range[1]),
  })),
  ...insert,
});
const attestationRows = courses.flatMap((course) => {
  const sc = SCHEDULE_BY_COURSE[course];
  if (!sc) return [];
  return [
    { kind: 'INTERIM' as const, course, range: sc.interim },
    { kind: 'DIRECTOR_TEST' as const, course, range: sc.director },
    { kind: 'AVERAGE' as const, course, range: sc.average },
    ...(sc.exam ? [{ kind: 'EXAM' as const, course, range: sc.exam }] : []),
  ];
});
await prisma.attestation.createMany({
  data: attestationRows.map((a) => ({
    id: id(`attestation:${a.kind}:${String(a.course)}`),
    semesterId: SEMESTER,
    kind: a.kind,
    course: a.course,
    dateFrom: d(a.range[0]),
    dateTo: d(a.range[1]),
  })),
  ...insert,
});

await prisma.discipline.createMany({
  data: (Object.keys(DISC) as DiscKey[]).map((k) => ({
    id: discId(k),
    organizationId: ORG,
    title: DISC[k].title,
    shortTitle: DISC[k].short,
    color: DISC[k].color,
    defaultScale: 'TWELVE' as const,
  })),
  ...insert,
});

const specialtyOf = (g: string) => (g.split('-')[0] ?? g).replace(/т$/, '');
const cohortKeys = [
  ...new Set(groups.map((g) => `${specialtyOf(g)}|${String(2026 - (courseOf(g) - 1))}`)),
];
await prisma.cohort.createMany({
  data: cohortKeys.map((k) => ({
    id: id(`cohort:${k}`),
    organizationId: ORG,
    specialty: k.split('|')[0] ?? '',
    entryYear: Number(k.split('|')[1]),
  })),
  ...insert,
});
await prisma.group.createMany({
  data: groups.map((g) => ({
    id: groupId(g),
    cohortId: id(`cohort:${specialtyOf(g)}|${String(2026 - (courseOf(g) - 1))}`),
    academicYearId: YEAR,
    name: g,
    course: courseOf(g),
  })),
  ...insert,
});
const studentRows = [...studentsByGroup].flatMap(([g, map]) =>
  [...map].map(([k, n]) => ({
    id: studentId(g, k),
    organizationId: ORG,
    lastName: n.lastName,
    firstName: n.firstName,
    middleName: n.middleName,
  })),
);
await prisma.student.createMany({ data: studentRows, ...insert });
await prisma.enrollment.createMany({
  data: [...studentsByGroup].flatMap(([g, map]) =>
    [...map.keys()].map((k) => ({
      id: enrollmentId(g, k),
      studentId: studentId(g, k),
      groupId: groupId(g),
      status: 'ACTIVE' as const,
      fromDate: d('2026-09-01'),
    })),
  ),
  ...insert,
});

const lessonsPerLoad = new Map<string, number>();
for (const l of lessons.values())
  lessonsPerLoad.set(l.loadId, (lessonsPerLoad.get(l.loadId) ?? 0) + 1);
await prisma.teachingLoad.createMany({
  data: [...loadsUsed].map(([lid, s]) => ({
    id: lid,
    semesterId: SEMESTER,
    disciplineId: discId(s.disc),
    groupId: groupId(s.group),
    teacherId: USER,
    kind: s.kind,
    // Потокові лекції КІт-31…34: одна пара для чотирьох груп (одна дисципліна — один потік)
    streamId: s.kind === 'LECTURE' && KIT.includes(s.group) ? id(`stream:${s.disc}`) : null,
    plannedHours: (lessonsPerLoad.get(lid) ?? 0) * 2,
    controlForm: DISC[s.disc].control,
    gradingRules: { ...defaultGradingRules, scale: scaleOf(s.group) },
  })),
  ...insert,
});
await prisma.schedule.createMany({
  data: [
    {
      id: SCHEDULE,
      semesterId: SEMESTER,
      revision: 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById: USER,
    },
  ],
  ...insert,
});
await prisma.scheduleSlot.createMany({
  data: slots.map((s) => ({
    id: s.id,
    scheduleId: SCHEDULE,
    loadId: s.loadId,
    weekday: s.weekday,
    pairNumber: s.pairNumber,
    parity: s.parity,
    roomId: s.roomId,
    validFrom: d(s.validFrom),
  })),
  ...insert,
});
await prisma.lesson.createMany({
  data: [...lessons.values()].map((l): Prisma.LessonCreateManyInput => ({
    id: l.id,
    loadId: l.loadId,
    slotId: l.slotId,
    teacherId: USER,
    scheduleVersion: l.scheduleVersion,
    date: d(l.date),
    pairNumber: l.pairNumber,
    roomId: l.roomId,
    hours: 2,
    // Усі минулі заняття за календарем проведені (відмітки могли не вноситись); сьогоднішні ще попереду
    status: l.date < TODAY || heldLessons.has(l.id) ? 'HELD' : 'PLANNED',
    manuallyEdited: l.slotId === null,
  })),
  ...insert,
});
await prisma.attendance.createMany({
  data: [...attMap.values()].map((a) => ({
    lessonId: a.lessonId,
    enrollmentId: a.enrollmentId,
    status: a.status,
  })),
  ...insert,
});
await prisma.assessment.createMany({
  data: [...assessments.values()].map((a) => ({
    id: a.id,
    loadId: a.loadId,
    kind: a.kind,
    title: a.title,
    maxScore: a.maxScore,
    attestationKind: a.attestationKind,
    // Порядок колонок як у таблиці: сортування журналу йде за createdAt
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, 0, 0, a.order)),
  })),
  ...insert,
});
await prisma.grade.createMany({
  data: grades.map((g) => ({
    id: g.id,
    enrollmentId: g.enrollmentId,
    assessmentId: g.assessmentId,
    kind: g.kind,
    value: g.value,
  })),
  ...insert,
});
const courseOfLoad = (lid: string): number => courseOf(loadsUsed.get(lid)?.group ?? '');
await prisma.attestationResult.createMany({
  data: [...new Map(results.map((r) => [`${r.loadId}|${r.enrollmentId}`, r])).values()].map(
    (r) => ({
      id: id(`result:${r.loadId}:${r.enrollmentId}`),
      attestationId: id(`attestation:INTERIM:${String(courseOfLoad(r.loadId))}`),
      loadId: r.loadId,
      enrollmentId: r.enrollmentId,
      final: r.final,
      confirmed: true,
    }),
  ),
  ...insert,
});

console.log('Імпорт завершено:', {
  студентів: await prisma.student.count(),
  навантажень: await prisma.teachingLoad.count(),
  занять: await prisma.lesson.count(),
  відміток: await prisma.attendance.count(),
  оцінок: await prisma.grade.count(),
});
await prisma.$disconnect();
