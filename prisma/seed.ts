/**
 * Демо-дані для розробки. Ідемпотентний: id детерміновані (з ключа), вставка через
 * createMany(skipDuplicates). Щоб перезалити змінені значення, скинь БД: pnpm db:reset.
 */
import { createHash } from 'node:crypto';

import {
  assignTopics,
  detectScheduleConflicts,
  generateLessons,
  type LoadInput,
  type ScheduleSlotInput,
  type SemesterInput,
} from '@ge/domain';
import { defaultGradingRules, type IsoDate } from '@ge/shared';
import { Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();

/** Детермінований UUID (формат v5) з текстового ключа: однаковий ключ → однаковий id. */
function seedId(key: string): string {
  const h = createHash('sha1').update(`grade-expectations:${key}`).digest();
  h[6] = ((h[6] ?? 0) & 0x0f) | 0x50;
  h[8] = ((h[8] ?? 0) & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const d = (iso: IsoDate): Date => new Date(`${iso}T00:00:00.000Z`);
const isoOf = (date: Date): IsoDate => date.toISOString().slice(0, 10);

const ORG = seedId('org');
const YEAR = seedId('year:2026');
const SEMESTER = seedId('semester:2026:1');
const SCHEDULE = seedId('schedule:2026:1:rev1');

// ── Люди ────────────────────────────────────────────
const users = {
  teacher: {
    id: seedId('user:teacher'),
    email: 'teacher@demo.local',
    fullName: 'Бойчук В.В.',
    roles: ['TEACHER'],
  },
  dekanat: {
    id: seedId('user:dekanat'),
    email: 'dekanat@demo.local',
    fullName: 'Мазур Т.О.',
    roles: ['MODERATOR'],
  },
  both: {
    id: seedId('user:both'),
    email: 'both@demo.local',
    fullName: 'Гончар Л.І.',
    roles: ['TEACHER', 'MODERATOR'],
  },
} as const;

// ── Студенти ────────────────────────────────────────
const surnames = [
  'Коваленко',
  'Мельник',
  'Ткачук',
  'Бондар',
  'Савчук',
  'Шевчук',
  'Бойко',
  'Кравченко',
  'Олійник',
  'Мороз',
  'Лисенко',
  'Руденко',
  'Поліщук',
  'Марченко',
  'Іваненко',
  'Петренко',
  'Гриценко',
  'Давиденко',
  'Сидоренко',
  'Назаренко',
  'Кушнір',
  'Тимошенко',
  'Яценко',
  'Данильченко',
  'Мазуренко',
];
const maleNames = [
  'Андрій',
  'Остап',
  'Максим',
  'Богдан',
  'Тарас',
  'Назар',
  'Дмитро',
  'Олег',
  'Іван',
  'Роман',
  'Артем',
  'Юрій',
  'Денис',
];
const femaleNames = [
  'Анна',
  'Ірина',
  'Олена',
  'Софія',
  'Марія',
  'Катерина',
  'Наталія',
  'Оксана',
  'Юлія',
  'Дарина',
  'Христина',
  'Вікторія',
];
const STUDENTS_PER_GROUP = 25;

function studentName(group: number, i: number): { lastName: string; firstName: string } {
  const lastName = surnames[(i + group * 7) % surnames.length] ?? 'Коваленко';
  const pool = i % 2 === 0 ? femaleNames : maleNames;
  const firstName = pool[(i + group * 3) % pool.length] ?? 'Анна';
  return { lastName, firstName };
}

const groups = [
  { key: 'pdt-11', name: 'ПДт-11', n: 1 },
  { key: 'pdt-12', name: 'ПДт-12', n: 2 },
  { key: 'pdt-13', name: 'ПДт-13', n: 3 },
] as const;
const groupId = (key: string) => seedId(`group:${key}`);

// ── Дисципліни ──────────────────────────────────────
const disciplines = [
  { key: 'informatics', title: 'Інформатика', shortTitle: 'Інформ.', color: '#3B6EA5' },
  {
    key: 'metrology',
    title: 'Метрологія інформаційно-обчислювальних систем',
    shortTitle: 'Метр.',
    color: '#8A6D3B',
  },
  { key: 'programming', title: 'Основи програмування', shortTitle: 'ОП', color: '#4F7F5F' },
  { key: 'math', title: 'Вища математика', shortTitle: 'Вища мат.', color: '#7B5E8D' },
] as const;
const disciplineId = (key: string) => seedId(`discipline:${key}`);

const topicTitles: Record<string, string[]> = {
  informatics: [
    'Інформація та інформаційні процеси',
    'Алгоритми та їх властивості',
    'Системи числення',
    'Апаратне забезпечення ПК',
    'Операційні системи',
    'Текстові процесори',
    'Електронні таблиці',
    'Бази даних',
  ],
  metrology: ['Основи метрології', 'Похибки вимірювань', 'Засоби вимірювань', 'Стандартизація'],
  programming: ['Змінні та типи даних', 'Умовні оператори', 'Цикли', 'Функції', 'Масиви', 'Рядки'],
  math: ['Границі', 'Похідні', 'Інтеграли', 'Ряди'],
};

// ── Навантаження ────────────────────────────────────
type SeedLoad = LoadInput & { key: string; disciplineKey: string };
const L = (
  key: string,
  disciplineKey: string,
  group: string,
  teacher: keyof typeof users,
  kind: LoadInput['kind'],
  plannedHours: number,
  controlForm: LoadInput['controlForm'],
  subgroup: string | null = null,
): SeedLoad => ({
  key,
  disciplineKey,
  id: seedId(`load:${key}`),
  groupId: groupId(group),
  subgroupId: subgroup ? seedId(`subgroup:${group}:${subgroup}`) : null,
  teacherId: users[teacher].id,
  kind,
  plannedHours,
  controlForm,
});

const loads: SeedLoad[] = [
  L('inf-12-lec', 'informatics', 'pdt-12', 'teacher', 'LECTURE', 32, 'EXAM'),
  L('inf-12-lab1', 'informatics', 'pdt-12', 'teacher', 'LAB', 32, 'EXAM', '1'),
  L('inf-12-lab2', 'informatics', 'pdt-12', 'teacher', 'LAB', 32, 'EXAM', '2'),
  L('met-12-lec', 'metrology', 'pdt-12', 'teacher', 'LECTURE', 32, 'CREDIT'),
  L('prog-11-prac', 'programming', 'pdt-11', 'both', 'PRACTICE', 32, 'EXAM'),
  L('math-13-lec', 'math', 'pdt-13', 'both', 'LECTURE', 32, 'CREDIT'),
  L('inf-11-lec', 'informatics', 'pdt-11', 'teacher', 'LECTURE', 16, 'EXAM'),
  L('math-12-prac', 'math', 'pdt-12', 'both', 'PRACTICE', 16, 'CREDIT'),
];

const rooms = { r101: '101', r214: '214', r305: '305', cc2: "Комп'ютерний клас 2" } as const;
const roomId = (k: keyof typeof rooms) => seedId(`room:${k}`);

const slotDefs: {
  key: string;
  load: string;
  weekday: number;
  pair: number;
  parity: 'EVERY' | 'TOP' | 'BOTTOM';
  room: keyof typeof rooms;
}[] = [
  { key: 's1', load: 'inf-12-lec', weekday: 1, pair: 2, parity: 'EVERY', room: 'r214' },
  { key: 's2', load: 'inf-12-lab1', weekday: 3, pair: 3, parity: 'EVERY', room: 'cc2' },
  { key: 's3', load: 'inf-12-lab2', weekday: 3, pair: 4, parity: 'EVERY', room: 'cc2' },
  { key: 's4', load: 'met-12-lec', weekday: 4, pair: 1, parity: 'EVERY', room: 'r101' },
  { key: 's5', load: 'prog-11-prac', weekday: 2, pair: 2, parity: 'EVERY', room: 'r305' },
  { key: 's6', load: 'math-13-lec', weekday: 5, pair: 1, parity: 'EVERY', room: 'r101' },
  { key: 's7', load: 'inf-11-lec', weekday: 1, pair: 3, parity: 'BOTTOM', room: 'r214' },
  { key: 's8', load: 'math-12-prac', weekday: 5, pair: 2, parity: 'TOP', room: 'r101' },
];

// ── Семестр (TODO: дати канікул і атестацій — заглушки, уточнити в закладі) ─────────
const semesterInput: SemesterInput = {
  startDate: '2026-09-01',
  endDate: '2026-12-28',
  firstWeekParity: 'TOP',
  parityAfterBreak: 'CONTINUE',
  periods: [
    { kind: 'HOLIDAY', startDate: '2026-10-14', endDate: '2026-10-14' }, // День захисників
    { kind: 'HOLIDAY', startDate: '2026-10-26', endDate: '2026-11-01' }, // TODO: осінні канікули (заглушка)
    { kind: 'INTERIM_ATTESTATION', startDate: '2026-10-08', endDate: '2026-10-13' }, // TODO: заглушка
    { kind: 'DIRECTOR_TEST', startDate: '2026-11-23', endDate: '2026-11-27' }, // TODO: заглушка
    { kind: 'EXAM_SESSION', startDate: '2026-12-21', endDate: '2026-12-28' }, // TODO: заглушка
  ],
};

async function main(): Promise<void> {
  const insert = { skipDuplicates: true } as const;

  await prisma.organization.createMany({
    data: [{ id: ORG, title: 'Демо-коледж', timezone: 'Europe/Kyiv' }],
    ...insert,
  });

  await prisma.user.createMany({
    data: Object.values(users).map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      emailVerified: true,
    })),
    ...insert,
  });

  // Пароль демо-користувачів береться зі змінної середовища (див. .env.example), у коді його немає
  const demoPassword = process.env['DEMO_PASSWORD'];
  if (demoPassword === undefined || demoPassword.length < 8) {
    throw new Error('Задай DEMO_PASSWORD (мінімум 8 символів) у .env — див. .env.example');
  }
  const passwordHash = await hashPassword(demoPassword);
  await prisma.account.createMany({
    data: Object.entries(users).map(([k, u]) => ({
      id: seedId(`account:${k}`),
      userId: u.id,
      accountId: u.id,
      providerId: 'credential',
      password: passwordHash,
    })),
    ...insert,
  });
  await prisma.membership.createMany({
    data: Object.entries(users).map(([k, u]) => ({
      id: seedId(`membership:${k}`),
      userId: u.id,
      organizationId: ORG,
      roles: [...u.roles],
    })),
    ...insert,
  });

  const bells = [
    ['08:30', '09:50'],
    ['10:00', '11:20'],
    ['11:40', '13:00'],
    ['13:10', '14:30'],
    ['14:40', '16:00'],
  ] as const;
  await prisma.bellTime.createMany({
    data: bells.map(([startsAt, endsAt], i) => ({
      organizationId: ORG,
      pairNumber: i + 1,
      startsAt,
      endsAt,
    })),
    ...insert,
  });
  await prisma.room.createMany({
    data: (Object.keys(rooms) as (keyof typeof rooms)[]).map((k) => ({
      id: roomId(k),
      organizationId: ORG,
      name: rooms[k],
    })),
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
  await prisma.semesterPeriod.createMany({
    data: semesterInput.periods.map((p, i) => ({
      id: seedId(`period:${i}`),
      semesterId: SEMESTER,
      kind: p.kind,
      startDate: d(p.startDate),
      endDate: d(p.endDate),
    })),
    ...insert,
  });
  const attestations = [
    { kind: 'INTERIM', from: '2026-10-08', to: '2026-10-13' },
    { kind: 'DIRECTOR_TEST', from: '2026-11-23', to: '2026-11-27' },
    { kind: 'AVERAGE', from: '2026-09-01', to: '2026-12-20' },
    { kind: 'EXAM', from: '2026-12-21', to: '2026-12-28' },
  ] as const;
  await prisma.attestation.createMany({
    data: attestations.map((a) => ({
      id: seedId(`attestation:${a.kind}`),
      semesterId: SEMESTER,
      kind: a.kind,
      dateFrom: d(a.from),
      dateTo: d(a.to),
    })),
    ...insert,
  });

  // Довідники й програми
  await prisma.discipline.createMany({
    data: disciplines.map((x) => ({
      id: disciplineId(x.key),
      organizationId: ORG,
      title: x.title,
      shortTitle: x.shortTitle,
      color: x.color,
      defaultScale: 'TWELVE',
    })),
    ...insert,
  });
  await prisma.disciplineProgram.createMany({
    data: disciplines.map((x) => ({
      id: seedId(`program:${x.key}`),
      disciplineId: disciplineId(x.key),
      edition: '2026',
    })),
    ...insert,
  });
  const topicRows = disciplines.flatMap((x) =>
    (topicTitles[x.key] ?? []).map((title, i) => ({
      id: seedId(`topic:${x.key}:${i}`),
      programId: seedId(`program:${x.key}`),
      order: i + 1,
      title,
      hours: 4,
      // Теми прив'язані до виду занять, який веде навантаження дисципліни
      kind:
        x.key === 'programming' || x.key === 'math' ? ('PRACTICE' as const) : ('LECTURE' as const),
    })),
  );
  await prisma.programTopic.createMany({ data: topicRows, ...insert });

  // Потік, групи, студенти, зарахування
  await prisma.cohort.createMany({
    data: [
      {
        id: seedId('cohort:2026'),
        organizationId: ORG,
        specialty: 'Програмне забезпечення',
        entryYear: 2026,
      },
    ],
    ...insert,
  });
  await prisma.group.createMany({
    data: groups.map((g) => ({
      id: groupId(g.key),
      cohortId: seedId('cohort:2026'),
      academicYearId: YEAR,
      name: g.name,
      course: 1,
    })),
    ...insert,
  });
  await prisma.subgroup.createMany({
    data: ['1', '2'].map((s) => ({
      id: seedId(`subgroup:pdt-12:${s}`),
      groupId: groupId('pdt-12'),
      name: `${s} підгрупа`,
    })),
    ...insert,
  });

  const exampleNames = [
    ['Коваленко', 'Анна'],
    ['Мельник', 'Остап'],
    ['Ткачук', 'Ірина'],
    ['Бондар', 'Максим'],
    ['Савчук', 'Олена'],
  ] as const;
  const studentRows = groups.flatMap((g) =>
    Array.from({ length: STUDENTS_PER_GROUP }, (_, i) => {
      const [lastName, firstName] =
        g.key === 'pdt-12' && i < exampleNames.length
          ? (exampleNames[i] ?? ['', ''])
          : Object.values(studentName(g.n, i));
      return { id: seedId(`student:${g.key}:${i}`), organizationId: ORG, lastName, firstName };
    }),
  );
  await prisma.student.createMany({ data: studentRows, ...insert });
  const enrollmentRows = groups.flatMap((g) =>
    Array.from({ length: STUDENTS_PER_GROUP }, (_, i) => ({
      id: seedId(`enrollment:${g.key}:${i}`),
      studentId: seedId(`student:${g.key}:${i}`),
      groupId: groupId(g.key),
      status: 'ACTIVE' as const,
      fromDate: d('2026-09-01'),
    })),
  );
  await prisma.enrollment.createMany({ data: enrollmentRows, ...insert });
  await prisma.subgroupMember.createMany({
    data: Array.from({ length: STUDENTS_PER_GROUP }, (_, i) => ({
      subgroupId: seedId(`subgroup:pdt-12:${i < 13 ? '1' : '2'}`),
      enrollmentId: seedId(`enrollment:pdt-12:${i}`),
    })),
    ...insert,
  });

  // Навантаження, розклад
  await prisma.teachingLoad.createMany({
    data: loads.map((l) => ({
      id: l.id,
      semesterId: SEMESTER,
      disciplineId: disciplineId(l.disciplineKey),
      groupId: l.groupId,
      subgroupId: l.subgroupId,
      teacherId: l.teacherId,
      kind: l.kind,
      plannedHours: l.plannedHours,
      controlForm: l.controlForm,
      gradingRules: { ...defaultGradingRules },
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
        publishedAt: new Date('2026-08-25T09:00:00Z'),
        publishedById: users.dekanat.id,
      },
    ],
    ...insert,
  });
  const slots: ScheduleSlotInput[] = slotDefs.map((s) => ({
    id: seedId(`slot:${s.key}`),
    loadId: seedId(`load:${s.load}`),
    weekday: s.weekday,
    pairNumber: s.pair,
    parity: s.parity,
    roomId: roomId(s.room),
    validFrom: semesterInput.startDate,
    validTo: null,
  }));

  // Розклад із сида мусить бути без конфліктів — перевіряємо доменною функцією
  const conflicts = detectScheduleConflicts(slots, loads);
  if (conflicts.length > 0)
    throw new Error(`Конфлікти в сид-розкладі: ${JSON.stringify(conflicts)}`);

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

  // Заняття: генеруються з розкладу доменною функцією; теми призначаються по черзі
  const existing = await prisma.lesson.findMany({
    where: { load: { semesterId: SEMESTER } },
    select: {
      id: true,
      loadId: true,
      slotId: true,
      date: true,
      pairNumber: true,
      status: true,
      manuallyEdited: true,
    },
  });
  const { create } = generateLessons(
    semesterInput,
    { version: 1, slots },
    existing.map((l) => ({ ...l, date: isoOf(l.date), hasMarks: false })),
  );

  const loadById = new Map(loads.map((l) => [l.id, l]));
  const topicsByDiscipline = new Map<string, typeof topicRows>(
    disciplines.map((x) => [
      x.key,
      topicRows.filter((t) => t.programId === seedId(`program:${x.key}`)),
    ]),
  );
  const lessonRows: Prisma.LessonCreateManyInput[] = [];
  const rowsByLoad = new Map<string, typeof create>();
  for (const l of create) rowsByLoad.set(l.loadId, [...(rowsByLoad.get(l.loadId) ?? []), l]);

  for (const [loadId, items] of rowsByLoad) {
    const load = loadById.get(loadId);
    if (!load) continue;
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const topics = (topicsByDiscipline.get(load.disciplineKey) ?? []).filter(
      (t) => t.kind === load.kind || load.kind === 'LAB',
    );
    const assigned = assignTopics(
      sorted.map((l) => ({ id: `${l.date}|${l.pairNumber}`, hours: 2 })),
      topics,
    );
    sorted.forEach((l, i) => {
      lessonRows.push({
        id: seedId(`lesson:${l.loadId}|${l.date}|${l.pairNumber}`),
        loadId: l.loadId,
        slotId: l.slotId,
        teacherId: load.teacherId,
        scheduleVersion: l.scheduleVersion,
        date: d(l.date),
        pairNumber: l.pairNumber,
        roomId: l.roomId,
        hours: 2,
        // Заняття до 5 жовтня вважаємо проведеними (демо для вичитки годин)
        status: l.date < '2026-10-05' ? 'HELD' : 'PLANNED',
        topicId: assigned[i]?.topicId ?? null,
      });
    });
  }
  await prisma.lesson.createMany({ data: lessonRows, ...insert });

  const counts = {
    students: await prisma.student.count(),
    loads: await prisma.teachingLoad.count(),
    slots: await prisma.scheduleSlot.count(),
    lessons: await prisma.lesson.count(),
  };
  console.log('Seed готовий:', counts);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
