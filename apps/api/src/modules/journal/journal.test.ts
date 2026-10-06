import {
  uuidv7,
  type GradebookDto,
  type LessonDetailDto,
  type LoadDto,
  type TodayDto,
  type TopicPlanDto,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  client,
  createOrganization,
  deleteOrganization,
  login,
  testPrisma,
} from '../../test/helpers.js';

const prisma = testPrisma();
let app: FastifyInstance;
let orgs: string[] = [];
let orgId = '';
let mod: ReturnType<typeof client>;
let teacher: ReturnType<typeof client>;
let teacher2: ReturnType<typeof client>;
let otherMod: ReturnType<typeof client>;

const ctx = {
  teacher: '',
  teacher2: '',
  groupId: '',
  semesterId: '',
  disciplineId: '',
  loadId: '',
  loadOther: '',
  subLoadId: '',
  subgroupId: '',
  enrollments: [] as string[],
  students: [] as string[],
};

const lessonOn = async (date: string, loadId = ctx.loadId) => {
  const l = await prisma.lesson.findFirst({ where: { loadId, date: new Date(date) } });
  if (!l) throw new Error(`Немає заняття ${date}`);
  return l.id;
};
const detail = async (id: string) => (await teacher<LessonDetailDto>('GET', `/lessons/${id}`)).body;

beforeAll(async () => {
  app = await buildTestApp();
  app.clock.today = () => '2026-08-25';

  const org = await createOrganization(prisma, 'jrn', {
    mod: ['MODERATOR'],
    teacher: ['TEACHER'],
    teacher2: ['TEACHER'],
  });
  const other = await createOrganization(prisma, 'jrn-other', { mod: ['MODERATOR'] });
  orgs = [org.organizationId, other.organizationId];
  orgId = org.organizationId;
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  teacher2 = client(app, await login(app, org.users['teacher2']?.email ?? ''));
  otherMod = client(app, await login(app, other.users['mod']?.email ?? ''));
  ctx.teacher = org.users['teacher']?.id ?? '';
  ctx.teacher2 = org.users['teacher2']?.id ?? '';

  await mod(
    'PUT',
    '/bells',
    [1, 2, 3].map((n) => ({
      pairNumber: n,
      startsAt: `${String(7 + n).padStart(2, '0')}:00`,
      endsAt: `${String(7 + n).padStart(2, '0')}:50`,
    })),
  );
  const room = await mod<{ id: string }>('POST', '/rooms', { name: '214' });
  const year = await mod<{ id: string }>('POST', '/academic-years', {
    title: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
  });
  ctx.semesterId = (
    await mod<{ id: string }>('POST', '/semesters', {
      academicYearId: year.body.id,
      number: 1,
      startDate: '2026-09-01',
      endDate: '2026-12-28',
      firstWeekParity: 'TOP',
    })
  ).body.id;
  await mod('POST', `/semesters/${ctx.semesterId}/activate`);
  const cohort = await mod<{ id: string }>('POST', '/cohorts', {
    specialty: 'ПЗ',
    entryYear: 2026,
  });
  ctx.groupId = (
    await mod<{ id: string }>('POST', '/groups', {
      cohortId: cohort.body.id,
      academicYearId: year.body.id,
      name: 'ПДт-12',
      course: 1,
    })
  ).body.id;

  for (const [lastName, firstName] of [
    ['Бондар', 'Максим'],
    ['Коваленко', 'Анна'],
    ['Мельник', 'Остап'],
    ['Ткачук', 'Ірина'],
  ]) {
    const s = await mod<{ id: string; enrollments: { id: string }[] }>('POST', '/students', {
      lastName,
      firstName,
      groupId: ctx.groupId,
      fromDate: '2026-09-01',
    });
    ctx.students.push(s.body.id);
    ctx.enrollments.push(s.body.enrollments[0]?.id ?? '');
  }
  const sub = await mod<{ id: string }>('POST', `/groups/${ctx.groupId}/subgroups`, {
    name: '1 підгрупа',
    enrollmentIds: ctx.enrollments.slice(0, 2),
  });
  ctx.subgroupId = sub.body.id;

  ctx.disciplineId = (
    await mod<{ id: string }>('POST', '/disciplines', {
      title: 'Інформатика',
      shortTitle: 'Інф',
      color: '#3B6EA5',
    })
  ).body.id;
  const mk = async (teacherId: string, kind: string, extra: object = {}) =>
    (
      await mod<LoadDto>('POST', '/loads', {
        semesterId: ctx.semesterId,
        disciplineId: ctx.disciplineId,
        groupId: ctx.groupId,
        teacherId,
        kind,
        plannedHours: 40,
        controlForm: 'EXAM',
        ...extra,
      })
    ).body.id;
  ctx.loadId = await mk(ctx.teacher, 'LECTURE');
  ctx.loadOther = await mk(ctx.teacher2, 'PRACTICE');
  ctx.subLoadId = await mk(ctx.teacher, 'LAB', { subgroupId: ctx.subgroupId });

  const draft = await mod<{ id: string }>('POST', '/schedules', { semesterId: ctx.semesterId });
  await mod('POST', `/schedules/${draft.body.id}/slots`, {
    loadId: ctx.loadId,
    weekday: 1,
    pairNumber: 2,
    roomId: room.body.id,
  });
  await mod('POST', `/schedules/${draft.body.id}/slots`, {
    loadId: ctx.loadOther,
    weekday: 2,
    pairNumber: 1,
  });
  expect((await mod('POST', `/schedules/${draft.body.id}/publish`, {})).status).toBe(200);
  // підгрупове заняття створюємо напряму
  await prisma.lesson.create({
    data: {
      id: uuidv7(),
      loadId: ctx.subLoadId,
      teacherId: ctx.teacher,
      date: new Date('2026-10-12'),
      pairNumber: 3,
      hours: 2,
      status: 'PLANNED',
    },
  });

  app.clock.today = () => '2026-10-12'; // сьогодні — понеділок із парою лекцій
});

afterAll(async () => {
  await prisma.changeLog.deleteMany({ where: { organizationId: orgId } });
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
});

describe('заняття «На парі»', () => {
  it('склад: усі активні студенти, за замовчуванням присутні; підгрупа — лише її склад', async () => {
    const id = await lessonOn('2026-10-12');
    const res = await teacher<LessonDetailDto>('GET', `/lessons/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.roster.map((r) => r.lastName)).toEqual([
      'Бондар',
      'Коваленко',
      'Мельник',
      'Ткачук',
    ]);
    expect(
      res.body.roster.every(
        (r) => r.attendance === 'PRESENT' && !r.marked && r.grades.length === 0,
      ),
    ).toBe(true);
    expect(res.body).toMatchObject({
      scale: 'TWELVE',
      status: 'PLANNED',
      undoUntil: null,
      discipline: { shortTitle: 'Інф' },
    });

    const subId = await lessonOn('2026-10-12', ctx.subLoadId);
    const sub = await teacher<LessonDetailDto>('GET', `/lessons/${subId}`);
    expect(sub.body.roster.map((r) => r.lastName)).toEqual(['Бондар', 'Коваленко']);
  });

  it('доступ: чужий викладач і інший коледж — ні, деканат — читає', async () => {
    const id = await lessonOn('2026-10-12');
    expect((await teacher2('GET', `/lessons/${id}`)).status).toBe(403);
    expect((await otherMod('GET', `/lessons/${id}`)).status).toBe(404);
    expect((await mod('GET', `/lessons/${id}`)).status).toBe(200);
    expect((await mod('POST', `/lessons/${id}/finish`)).status).toBe(403); // деканат не веде пари (OQ-3)
    expect((await app.inject({ method: 'GET', url: `/api/v1/lessons/${id}` })).statusCode).toBe(
      401,
    );
  });

  it('тема й домашнє завдання: зміна за версією', async () => {
    const id = await lessonOn('2026-10-12');
    const d = await detail(id);
    const res = await teacher<LessonDetailDto>('PATCH', `/lessons/${id}`, {
      topicText: 'Алгоритми та їх властивості',
      homework: 'Опрацювати §3',
      version: d.version,
    });
    expect(res.body).toMatchObject({
      topic: 'Алгоритми та їх властивості',
      homework: 'Опрацювати §3',
      version: d.version + 1,
    });
    expect(
      (await teacher('PATCH', `/lessons/${id}`, { topicText: 'ще', version: d.version })).status,
    ).toBe(409);
    expect(
      (await teacher2('PATCH', `/lessons/${id}`, { topicText: 'злам', version: res.body.version }))
        .status,
    ).toBe(403);
  });
});

describe('відвідуваність', () => {
  it('відмітка «н» → «нп»; кожна зміна в аудиті; повтор нічого не пише', async () => {
    const id = await lessonOn('2026-10-12');
    const [a, b] = ctx.enrollments;
    const first = await teacher<LessonDetailDto>('PUT', `/lessons/${id}/attendance`, {
      marks: [{ enrollmentId: a, status: 'ABSENT' }],
    });
    expect(first.status).toBe(200);
    expect(first.body.roster.find((r) => r.enrollmentId === a)).toMatchObject({
      attendance: 'ABSENT',
      marked: true,
    });
    expect(first.body.roster.find((r) => r.enrollmentId === b)).toMatchObject({
      attendance: 'PRESENT',
      marked: false,
    });

    await teacher('PUT', `/lessons/${id}/attendance`, {
      marks: [{ enrollmentId: a, status: 'ABSENT' }],
    }); // без змін
    await teacher('PUT', `/lessons/${id}/attendance`, {
      marks: [{ enrollmentId: a, status: 'EXCUSED' }],
    });

    const log = await prisma.changeLog.findMany({
      where: { organizationId: orgId, entity: 'Attendance' },
      orderBy: { id: 'asc' },
    });
    expect(log.map((l) => [l.before, l.after])).toEqual([
      [null, { status: 'ABSENT' }],
      [{ status: 'ABSENT' }, { status: 'EXCUSED' }],
    ]);
    expect(log[0]).toMatchObject({ userId: ctx.teacher, deviceId: 'web', entityId: `${id}:${a}` });
  });

  it('студент не зі складу заняття → 422; чужий викладач і деканат → 403', async () => {
    const id = await lessonOn('2026-10-12', ctx.subLoadId); // підгрупа: лише перші двоє
    const outsider = ctx.enrollments[3];
    const res = await teacher<{ code: string }>('PUT', `/lessons/${id}/attendance`, {
      marks: [{ enrollmentId: outsider, status: 'ABSENT' }],
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ENROLLMENT_NOT_IN_LESSON');
    expect(
      (
        await mod('PUT', `/lessons/${id}/attendance`, {
          marks: [{ enrollmentId: ctx.enrollments[0], status: 'ABSENT' }],
        })
      ).status,
    ).toBe(403);
    expect((await teacher('PUT', `/lessons/${id}/attendance`, { marks: [] })).status).toBe(400);
  });
});

describe('оцінки', () => {
  let gradeId = '';
  let version = 0;

  it('виставлення, перевірка шкали, зміна і видалення з історією', async () => {
    const id = await lessonOn('2026-10-12');
    const [a] = ctx.enrollments;
    const created = await teacher<LessonDetailDto>('POST', `/lessons/${id}/grades`, {
      enrollmentId: a,
      kind: 'ORAL',
      value: 10,
    });
    expect(created.status).toBe(201);
    const entry = created.body.roster.find((r) => r.enrollmentId === a)?.grades[0];
    expect(entry).toMatchObject({ kind: 'ORAL', value: 10, version: 0 });
    gradeId = entry?.id ?? '';
    version = entry?.version ?? 0;

    expect(
      (
        await teacher<{ code: string }>('POST', `/lessons/${id}/grades`, {
          enrollmentId: a,
          kind: 'ORAL',
          value: 13,
        })
      ).body.code,
    ).toBe('GRADE_OUT_OF_SCALE');
    expect(
      (
        await teacher<{ code: string }>('POST', `/lessons/${id}/grades`, {
          enrollmentId: a,
          kind: 'ORAL',
          value: 0,
        })
      ).body.code,
    ).toBe('GRADE_OUT_OF_SCALE');

    const upd = await teacher<LessonDetailDto>('PATCH', `/grades/${gradeId}`, {
      value: 11,
      comment: 'Чудова відповідь',
      version,
    });
    expect(upd.body.roster.find((r) => r.enrollmentId === a)?.grades[0]).toMatchObject({
      value: 11,
      comment: 'Чудова відповідь',
      version: 1,
    });
    expect((await teacher('PATCH', `/grades/${gradeId}`, { value: 5, version: 0 })).status).toBe(
      409,
    );
    expect((await teacher2('PATCH', `/grades/${gradeId}`, { value: 5, version: 1 })).status).toBe(
      403,
    );
    expect((await mod('PATCH', `/grades/${gradeId}`, { value: 5, version: 1 })).status).toBe(403);

    const del = await teacher<LessonDetailDto>('DELETE', `/grades/${gradeId}`);
    expect(del.body.roster.find((r) => r.enrollmentId === a)?.grades).toEqual([]);

    const log = await prisma.changeLog.findMany({
      where: { organizationId: orgId, entity: 'Grade', entityId: gradeId },
      orderBy: { id: 'asc' },
    });
    expect(log.map((l) => [l.op, l.before, l.after])).toEqual([
      ['UPSERT', null, { enrollmentId: a, lessonId: id, kind: 'ORAL', value: 10 }],
      [
        'UPSERT',
        { kind: 'ORAL', value: 10, comment: null },
        { kind: 'ORAL', value: 11, comment: 'Чудова відповідь' },
      ],
      ['DELETE', { kind: 'ORAL', value: 11, comment: 'Чудова відповідь' }, null],
    ]);
    expect(log.every((l) => l.userId === ctx.teacher)).toBe(true);
  });

  it('оцінка студентові не зі складу заняття → 422; чужий викладач → 403', async () => {
    const id = await lessonOn('2026-10-12', ctx.subLoadId);
    const res = await teacher<{ code: string }>('POST', `/lessons/${id}/grades`, {
      enrollmentId: ctx.enrollments[3],
      kind: 'LAB',
      value: 9,
    });
    expect(res.body.code).toBe('ENROLLMENT_NOT_IN_LESSON');
    expect(
      (
        await teacher2('POST', `/lessons/${id}/grades`, {
          enrollmentId: ctx.enrollments[0],
          kind: 'LAB',
          value: 9,
        })
      ).status,
    ).toBe(403);
  });

  it('скасоване заняття не приймає відміток і оцінок', async () => {
    const id = await lessonOn('2026-10-19');
    await mod('POST', `/lessons/${id}/cancel`, {});
    const res = await teacher<{ code: string }>('POST', `/lessons/${id}/grades`, {
      enrollmentId: ctx.enrollments[0],
      kind: 'ORAL',
      value: 8,
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LESSON_NOT_ACTIVE');
  });
});

describe('завершення пари', () => {
  it('«Завершити пару»: непозначені фіксуються присутніми, відмітка «нп» зберігається, можна скасувати', async () => {
    const id = await lessonOn('2026-10-12');
    const done = await teacher<LessonDetailDto>('POST', `/lessons/${id}/finish`);
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('HELD');
    expect(done.body.undoUntil).not.toBeNull();
    expect(done.body.roster.map((r) => [r.attendance, r.marked])).toEqual([
      ['EXCUSED', true],
      ['PRESENT', true],
      ['PRESENT', true],
      ['PRESENT', true],
    ]);
    expect(await prisma.attendance.count({ where: { lessonId: id } })).toBe(4);

    expect((await teacher<LessonDetailDto>('POST', `/lessons/${id}/finish`)).body.status).toBe(
      'HELD',
    ); // повтор ідемпотентний

    const reopened = await teacher<LessonDetailDto>('POST', `/lessons/${id}/reopen`);
    expect(reopened.body).toMatchObject({ status: 'PLANNED', undoUntil: null });
    expect((await teacher<{ code: string }>('POST', `/lessons/${id}/reopen`)).body.code).toBe(
      'LESSON_NOT_HELD',
    );
    await teacher('POST', `/lessons/${id}/finish`);
  });

  it('скасувати завершення можна лише 10 хвилин', async () => {
    const id = await lessonOn('2026-10-12');
    await prisma.lesson.update({
      where: { id },
      data: { updatedAt: new Date(Date.now() - 11 * 60_000) },
    });
    const res = await teacher<{ code: string }>('POST', `/lessons/${id}/reopen`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('UNDO_EXPIRED');
    expect((await detail(id)).undoUntil).toBeNull();
  });

  it('майбутню пару завершити не можна', async () => {
    const id = await lessonOn('2026-11-02');
    const res = await teacher<{ code: string }>('POST', `/lessons/${id}/finish`);
    expect(res.body.code).toBe('LESSON_IN_FUTURE');
  });
});

describe('журнал групи', () => {
  beforeAll(async () => {
    // кілька оцінок і відміток на проведених парах
    await prisma.lesson.updateMany({
      where: { loadId: ctx.loadId, date: { lt: new Date('2026-10-12') } },
      data: { status: 'HELD' },
    });
    const sep7 = await lessonOn('2026-09-07');
    const sep14 = await lessonOn('2026-09-14');
    const [a, b, c] = ctx.enrollments;
    app.clock.today = () => '2026-10-12';
    for (const lesson of [sep7, sep14]) {
      await teacher('PUT', `/lessons/${lesson}/attendance`, {
        marks: [
          { enrollmentId: a, status: 'PRESENT' },
          { enrollmentId: b, status: 'ABSENT' },
          { enrollmentId: c, status: 'PRESENT' },
        ],
      });
    }
    await teacher('POST', `/lessons/${sep7}/grades`, { enrollmentId: a, kind: 'ORAL', value: 10 });
    await teacher('POST', `/lessons/${sep14}/grades`, { enrollmentId: a, kind: 'TEST', value: 7 });
    await teacher('POST', `/lessons/${sep7}/grades`, { enrollmentId: c, kind: 'ORAL', value: 2 });
    await teacher('POST', `/lessons/${sep14}/grades`, { enrollmentId: c, kind: 'ORAL', value: 3 });
  });

  it('студенти × заняття: розріджені клітинки, середній бал за вагами, пропуски, ризик', async () => {
    const res = await teacher<GradebookDto>('GET', `/loads/${ctx.loadId}/gradebook`);
    expect(res.status).toBe(200);
    expect(res.body.students.map((s) => s.lastName)).toEqual([
      'Бондар',
      'Коваленко',
      'Мельник',
      'Ткачук',
    ]);
    expect(res.body.lessons.length).toBeGreaterThan(10);
    expect(res.body.lessons[0]).toMatchObject({ date: '2026-09-07', status: 'HELD' });

    const bondar = res.body.students[0];
    const sep7 = await lessonOn('2026-09-07');
    expect(bondar?.cells[sep7]).toMatchObject({
      attendance: 'PRESENT',
      grades: [{ kind: 'ORAL', value: 10 }],
    });
    // (10×1 + 7×2) / 3 = 8
    expect(bondar?.summary.average).toBeCloseTo(8, 5);
    expect(bondar?.summary.gradesCount).toBe(2);
    expect(bondar?.summary.risk).toEqual([]);

    const kovalenko = res.body.students[1];
    expect(kovalenko?.summary.absences).toMatchObject({ unexcused: 2 });
    expect(kovalenko?.summary.heldLessons).toBeGreaterThan(0);
    expect(kovalenko?.summary.risk).toEqual(['ABSENCES']);

    const melnyk = res.body.students[2];
    expect(melnyk?.summary.average).toBeCloseTo(2.5, 5);
    expect(melnyk?.summary.risk).toContain('LOW_GRADE');
    expect(Object.keys(res.body.students[3]?.cells ?? {})).toHaveLength(1); // лише заняття 12.10 з завершення пари
    expect(res.body.load).toMatchObject({
      kind: 'LECTURE',
      discipline: { shortTitle: 'Інф' },
      group: { name: 'ПДт-12' },
    });
  });

  it('фільтр за періодом; чужий викладач — 403, деканат — читає, інший коледж — 404', async () => {
    const res = await teacher<GradebookDto>(
      'GET',
      `/loads/${ctx.loadId}/gradebook?from=2026-09-10&to=2026-09-20`,
    );
    expect(res.body.lessons.map((l) => l.date)).toEqual(['2026-09-14']);
    expect((await teacher2('GET', `/loads/${ctx.loadId}/gradebook`)).status).toBe(403);
    expect((await mod('GET', `/loads/${ctx.loadId}/gradebook`)).status).toBe(200);
    expect((await otherMod('GET', `/loads/${ctx.loadId}/gradebook`)).status).toBe(404);
  });
});

describe('«Сьогодні»', () => {
  it('пари дня з прогресом відмітки, найближча атестація, зона ризику, вичитка', async () => {
    await prisma.attestation.create({
      data: {
        id: uuidv7(),
        semesterId: ctx.semesterId,
        kind: 'INTERIM',
        dateFrom: new Date('2026-10-15'),
        dateTo: new Date('2026-10-20'),
      },
    });
    const res = await teacher<TodayDto>('GET', '/today');
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-10-12');
    expect(res.body.lessons.map((l) => [l.pairNumber, l.marked, l.total])).toEqual([
      [2, 4, 4],
      [3, 0, 2],
    ]);
    expect(res.body.attestations).toEqual([
      {
        kind: 'INTERIM',
        dateFrom: '2026-10-15',
        dateTo: '2026-10-20',
        daysUntil: 3,
        groups: ['ПДт-12'],
      },
    ]);
    expect(res.body.hours.map((h) => h.teacher.id)).toEqual([ctx.teacher, ctx.teacher]);
    const names = res.body.risk.map((r) => `${r.lastName}:${r.reasons.join('+')}`);
    expect(names).toContain('Мельник:LOW_GRADE');
    expect(names).toContain('Коваленко:ABSENCES');
    expect(names.some((n) => n.startsWith('Бондар'))).toBe(false);
  });

  it('другий викладач бачить лише своє; без входу — 401', async () => {
    const res = await teacher2<TodayDto>('GET', '/today');
    expect(res.body.lessons.every((l) => l.teacher.id === ctx.teacher2)).toBe(true);
    expect(res.body.risk).toEqual([]);
    expect((await app.inject({ method: 'GET', url: '/api/v1/today' })).statusCode).toBe(401);
  });
});

describe('тематичний план', () => {
  let plan: TopicPlanDto;

  it('порожній → створення → перестановка й видалення; теми розкладаються по заняттях', async () => {
    const empty = await teacher<TopicPlanDto>('GET', `/loads/${ctx.loadId}/topics`);
    expect(empty.body).toMatchObject({ programId: null, loadKind: 'LECTURE', topics: [] });

    const created = await teacher<TopicPlanDto>('PUT', `/loads/${ctx.loadId}/topics`, {
      topics: [
        { title: 'Алгоритми', hours: 4 },
        { title: 'Системи числення', hours: 2 },
        { title: 'Бази даних', hours: 2 },
      ],
    });
    expect(created.status).toBe(200);
    expect(created.body.topics.map((t) => [t.order, t.title, t.hours])).toEqual([
      [1, 'Алгоритми', 4],
      [2, 'Системи числення', 2],
      [3, 'Бази даних', 2],
    ]);
    plan = created.body;

    // тема на 4 години займає перші два заняття; змінені вручну (topicText) не чіпаємо
    const first = await prisma.lesson.findFirst({
      where: { loadId: ctx.loadId, date: new Date('2026-09-07') },
    });
    const second = await prisma.lesson.findFirst({
      where: { loadId: ctx.loadId, date: new Date('2026-09-14') },
    });
    const third = await prisma.lesson.findFirst({
      where: { loadId: ctx.loadId, date: new Date('2026-09-21') },
    });
    expect(first?.topicId).toBe(plan.topics[0]?.id);
    expect(second?.topicId).toBe(plan.topics[0]?.id);
    expect(third?.topicId).toBe(plan.topics[1]?.id);
    const today = await prisma.lesson.findFirst({
      where: { loadId: ctx.loadId, date: new Date('2026-10-12') },
    });
    expect(today?.topicText).toBe('Алгоритми та їх властивості');

    const reordered = await teacher<TopicPlanDto>('PUT', `/loads/${ctx.loadId}/topics`, {
      topics: [
        { id: plan.topics[2]?.id, title: 'Бази даних', hours: 2 },
        { id: plan.topics[0]?.id, title: 'Алгоритми (нова назва)', hours: 4 },
        { title: 'Нова тема', hours: 2 },
      ],
    });
    expect(reordered.body.topics.map((t) => t.title)).toEqual([
      'Бази даних',
      'Алгоритми (нова назва)',
      'Нова тема',
    ]);
    expect(reordered.body.topics[0]?.id).toBe(plan.topics[2]?.id); // id збережено
    const removed = await prisma.programTopic.findUnique({
      where: { id: plan.topics[1]?.id ?? '' },
    });
    expect(removed?.deletedAt).not.toBeNull();
  });

  it('невідома тема → 409; чужий викладач і деканат не змінюють, деканат читає', async () => {
    const bad = await teacher<{ code: string }>('PUT', `/loads/${ctx.loadId}/topics`, {
      topics: [{ id: uuidv7(), title: 'x', hours: 2 }],
    });
    expect(bad.body.code).toBe('TOPIC_NOT_FOUND');
    expect((await teacher2('PUT', `/loads/${ctx.loadId}/topics`, { topics: [] })).status).toBe(403);
    expect((await mod('PUT', `/loads/${ctx.loadId}/topics`, { topics: [] })).status).toBe(403);
    expect((await mod('GET', `/loads/${ctx.loadId}/topics`)).status).toBe(200);
    expect(
      (await teacher('PUT', `/loads/${ctx.loadId}/topics`, { topics: [{ title: '', hours: 2 }] }))
        .status,
    ).toBe(400);
  });
});

describe('правила оцінювання', () => {
  it('зміна ваг доступна, шкала блокується, коли оцінки вже є; чужі не міняють', async () => {
    const load = (await teacher<LoadDto>('GET', `/loads/${ctx.loadId}`)).body;
    const rules = { ...load.gradingRules, weights: { TEST: 3, ORAL: 1 }, minGrades: 2 };
    const ok = await teacher<LoadDto>('PUT', `/loads/${ctx.loadId}/grading-rules`, { rules });
    expect(ok.status).toBe(200);
    expect(ok.body.gradingRules).toMatchObject({ weights: { TEST: 3, ORAL: 1 }, minGrades: 2 });

    const locked = await teacher<{ code: string }>('PUT', `/loads/${ctx.loadId}/grading-rules`, {
      rules: { ...rules, scale: 'FIVE' },
    });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('SCALE_LOCKED');

    // навантаження без оцінок: шкалу змінити можна
    const free = await teacher<LoadDto>('PUT', `/loads/${ctx.subLoadId}/grading-rules`, {
      rules: { ...rules, scale: 'FIVE' },
    });
    expect(free.body.gradingRules.scale).toBe('FIVE');

    expect((await teacher2('PUT', `/loads/${ctx.loadId}/grading-rules`, { rules })).status).toBe(
      403,
    );
    expect((await mod('PUT', `/loads/${ctx.loadId}/grading-rules`, { rules })).status).toBe(403);
    expect(
      (
        await teacher('PUT', `/loads/${ctx.loadId}/grading-rules`, {
          rules: { ...rules, maxUnexcusedAbsencePercent: 150 },
        })
      ).status,
    ).toBe(400);
  });
});
