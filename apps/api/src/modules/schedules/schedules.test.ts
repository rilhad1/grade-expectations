import {
  uuidv7,
  type ConflictDto,
  type LessonItemDto,
  type LoadDto,
  type PublishResult,
  type ScheduleDetailDto,
  type ScheduleDto,
  type SlotDto,
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
let mod: ReturnType<typeof client>;
let teacher: ReturnType<typeof client>;
let otherMod: ReturnType<typeof client>;

const ctx = {
  teacher: '',
  teacher2: '',
  semesterId: '',
  groupId: '',
  disciplineId: '',
  loadLecture: '',
  loadPractice: '',
  room1: '',
  room2: '',
  draftId: '',
  slotId: '',
};

beforeAll(async () => {
  app = await buildTestApp();
  app.clock.today = () => '2026-08-25'; // до початку семестру: генеруються всі заняття

  const org = await createOrganization(prisma, 'sch', {
    mod: ['MODERATOR'],
    teacher: ['TEACHER'],
    teacher2: ['TEACHER'],
  });
  const other = await createOrganization(prisma, 'sch-other', { mod: ['MODERATOR'] });
  orgs = [org.organizationId, other.organizationId];
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  otherMod = client(app, await login(app, other.users['mod']?.email ?? ''));
  ctx.teacher = org.users['teacher']?.id ?? '';
  ctx.teacher2 = org.users['teacher2']?.id ?? '';

  const bells = await mod(
    'PUT',
    '/bells',
    [1, 2, 3, 4, 5].map((n) => ({
      pairNumber: n,
      startsAt: `${String(7 + n).padStart(2, '0')}:00`,
      endsAt: `${String(7 + n).padStart(2, '0')}:50`,
    })),
  );
  expect(bells.status).toBe(200);
  ctx.room1 = (await mod<{ id: string }>('POST', '/rooms', { name: '101' })).body.id;
  ctx.room2 = (await mod<{ id: string }>('POST', '/rooms', { name: '214' })).body.id;

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
      periods: [{ kind: 'HOLIDAY', startDate: '2026-10-26', endDate: '2026-11-01' }],
    })
  ).body.id;
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
  ctx.disciplineId = (
    await mod<{ id: string }>('POST', '/disciplines', {
      title: 'Інформатика',
      shortTitle: 'Інф',
      color: '#3B6EA5',
    })
  ).body.id;

  const programId = uuidv7();
  await prisma.disciplineProgram.create({
    data: { id: programId, disciplineId: ctx.disciplineId, edition: '2026' },
  });
  await prisma.programTopic.createMany({
    data: Array.from({ length: 20 }, (_, i) => ({
      id: uuidv7(),
      programId,
      order: i + 1,
      title: `Тема ${i + 1}`,
      hours: 2,
      kind: 'LECTURE' as const,
    })),
  });

  const mk = async (teacherId: string, kind: string, plannedHours: number) =>
    (
      await mod<LoadDto>('POST', '/loads', {
        semesterId: ctx.semesterId,
        disciplineId: ctx.disciplineId,
        groupId: ctx.groupId,
        teacherId,
        kind,
        plannedHours,
        controlForm: 'EXAM',
      })
    ).body.id;
  ctx.loadLecture = await mk(ctx.teacher, 'LECTURE', 32);
  ctx.loadPractice = await mk(ctx.teacher2, 'PRACTICE', 32);
});

afterAll(async () => {
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
});

const slot = (loadId: string, over: object = {}) => ({
  loadId,
  weekday: 1,
  pairNumber: 2,
  parity: 'EVERY',
  roomId: ctx.room1,
  ...over,
});

describe('чернетка та слоти', () => {
  it('створюється порожня чернетка; друга — 409; викладач не бачить чернеток', async () => {
    const res = await mod<ScheduleDetailDto>('POST', '/schedules', { semesterId: ctx.semesterId });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      revision: 1,
      status: 'DRAFT',
      slotCount: 0,
      changedFromPublished: false,
    });
    ctx.draftId = res.body.id;

    expect(
      (await mod<{ code: string }>('POST', '/schedules', { semesterId: ctx.semesterId })).body.code,
    ).toBe('DRAFT_EXISTS');
    expect(
      (await teacher<ScheduleDto[]>('GET', `/schedules?semesterId=${ctx.semesterId}`)).body,
    ).toEqual([]);
    expect((await teacher('GET', `/schedules/${ctx.draftId}`)).status).toBe(403);
    expect((await teacher('POST', '/schedules', { semesterId: ctx.semesterId })).status).toBe(403);
    expect((await otherMod('GET', `/schedules/${ctx.draftId}`)).status).toBe(404);
  });

  it('слот: створення, перевірка пари / аудиторії / навантаження', async () => {
    const ok = await mod<SlotDto>('POST', `/schedules/${ctx.draftId}/slots`, slot(ctx.loadLecture));
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      weekday: 1,
      pairNumber: 2,
      parity: 'EVERY',
      validFrom: '2026-09-01',
      validTo: null,
    });
    ctx.slotId = ok.body.id;

    expect(
      (
        await mod<{ code: string }>(
          'POST',
          `/schedules/${ctx.draftId}/slots`,
          slot(ctx.loadLecture, { pairNumber: 9 }),
        )
      ).body.code,
    ).toBe('UNKNOWN_PAIR');
    expect(
      (
        await mod<{ code: string }>(
          'POST',
          `/schedules/${ctx.draftId}/slots`,
          slot(ctx.loadLecture, { roomId: uuidv7() }),
        )
      ).body.code,
    ).toBe('ROOM_NOT_FOUND');
    expect(
      (await mod<{ code: string }>('POST', `/schedules/${ctx.draftId}/slots`, slot(uuidv7()))).body
        .code,
    ).toBe('LOAD_NOT_IN_SEMESTER');
    expect(
      (await mod('POST', `/schedules/${ctx.draftId}/slots`, slot(ctx.loadLecture, { weekday: 7 })))
        .status,
    ).toBe(400);
    expect(
      (
        await mod(
          'POST',
          `/schedules/${ctx.draftId}/slots`,
          slot(ctx.loadLecture, { validFrom: '2026-10-01', validTo: '2026-09-01' }),
        )
      ).status,
    ).toBe(422);
  });

  it('оновлення за версією і видалення слота', async () => {
    const upd = await mod<SlotDto>('PATCH', `/schedule-slots/${ctx.slotId}`, {
      pairNumber: 3,
      parity: 'TOP',
      version: 0,
    });
    expect(upd.body).toMatchObject({ pairNumber: 3, parity: 'TOP', roomId: ctx.room1, version: 1 }); // roomId не скинуто
    expect(
      (await mod('PATCH', `/schedule-slots/${ctx.slotId}`, { pairNumber: 2, version: 0 })).status,
    ).toBe(409);
    expect(
      (await mod('PATCH', `/schedule-slots/${ctx.slotId}`, { pairNumber: 9, version: 1 })).status,
    ).toBe(422);
    expect(
      (await teacher('PATCH', `/schedule-slots/${ctx.slotId}`, { pairNumber: 1, version: 1 }))
        .status,
    ).toBe(403);

    const extra = await mod<SlotDto>(
      'POST',
      `/schedules/${ctx.draftId}/slots`,
      slot(ctx.loadLecture, { weekday: 5 }),
    );
    expect((await mod('DELETE', `/schedule-slots/${extra.body.id}`)).status).toBe(204);
    expect(
      (await mod<ScheduleDetailDto>('GET', `/schedules/${ctx.draftId}`)).body.slots,
    ).toHaveLength(1);
    expect((await mod('DELETE', `/schedule-slots/${extra.body.id}`)).status).toBe(404);
  });
});

describe('конфлікти та публікація', () => {
  it('конфлікти виявляються наживо і блокують публікацію', async () => {
    // той самий викладач (loadLecture) двічі в одній клітинці
    await mod('PATCH', `/schedule-slots/${ctx.slotId}`, {
      pairNumber: 2,
      parity: 'EVERY',
      version: 1,
    });
    const dup = await mod<SlotDto>(
      'POST',
      `/schedules/${ctx.draftId}/slots`,
      slot(ctx.loadLecture, { roomId: ctx.room2 }),
    );

    const conflicts = await mod<ConflictDto[]>('GET', `/schedules/${ctx.draftId}/conflicts`);
    expect(conflicts.body.map((c) => c.type).sort()).toEqual(['GROUP_BUSY', 'TEACHER_BUSY']);

    const preview = await mod<PublishResult>('POST', `/schedules/${ctx.draftId}/publish`, {
      dryRun: true,
    });
    expect(preview.body.conflicts).toHaveLength(2);

    const blocked = await mod<{ code: string }>('POST', `/schedules/${ctx.draftId}/publish`, {});
    expect(blocked.status).toBe(422);
    expect(blocked.body.code).toBe('SCHEDULE_HAS_CONFLICTS');
    expect((await mod<ScheduleDetailDto>('GET', `/schedules/${ctx.draftId}`)).body.status).toBe(
      'DRAFT',
    );

    await mod('DELETE', `/schedule-slots/${dup.body.id}`);
    expect((await mod<ConflictDto[]>('GET', `/schedules/${ctx.draftId}/conflicts`)).body).toEqual(
      [],
    );
  });

  it('попередній перегляд: скільки занять буде створено і скількох викладачів це стосується', async () => {
    await mod(
      'POST',
      `/schedules/${ctx.draftId}/slots`,
      slot(ctx.loadPractice, { weekday: 2, pairNumber: 1, roomId: ctx.room2, parity: 'TOP' }),
    );
    const preview = await mod<PublishResult>('POST', `/schedules/${ctx.draftId}/publish`, {
      dryRun: true,
    });
    // Понеділки без канікул: 16; вівторки у верхні тижні (1, 15, 29 вер ... ): рахуємо нижче, без жорсткої цифри
    expect(preview.body.dryRun).toBe(true);
    expect(preview.body.create).toBeGreaterThan(16);
    expect(preview.body).toMatchObject({ cancel: 0, keep: 0, teachers: 2, conflicts: [] });
    expect(await prisma.lesson.count({ where: { loadId: ctx.loadLecture } })).toBe(0); // dryRun нічого не пише
  });

  it('публікація створює заняття, призначає теми і робить версію незмінною', async () => {
    const res = await mod<PublishResult>('POST', `/schedules/${ctx.draftId}/publish`, {});
    expect(res.status).toBe(200);

    const lectures = await prisma.lesson.findMany({
      where: { loadId: ctx.loadLecture },
      orderBy: [{ date: 'asc' }],
    });
    expect(lectures).toHaveLength(16); // понеділки 7 вер – 28 груд без 26 жовтня (канікули)
    expect(lectures[0]?.date.toISOString().slice(0, 10)).toBe('2026-09-07');
    expect(lectures.map((l) => l.date.toISOString().slice(0, 10))).not.toContain('2026-10-26');
    expect(
      lectures.every(
        (l) => l.teacherId === ctx.teacher && l.status === 'PLANNED' && l.scheduleVersion === 1,
      ),
    ).toBe(true);

    const topics = await prisma.programTopic.findMany({
      where: { id: { in: lectures.map((l) => l.topicId ?? '') } },
    });
    expect(new Set(lectures.map((l) => l.topicId)).size).toBe(16);
    expect(topics.map((t) => t.title).sort()).toHaveLength(16);

    const sched = await mod<ScheduleDetailDto>('GET', `/schedules/${ctx.draftId}`);
    expect(sched.body).toMatchObject({ status: 'PUBLISHED' });
    expect(sched.body.publishedAt).not.toBeNull();

    const edit = await mod<{ code: string }>(
      'POST',
      `/schedules/${ctx.draftId}/slots`,
      slot(ctx.loadLecture, { weekday: 3 }),
    );
    expect(edit.status).toBe(409);
    expect(edit.body.code).toBe('SCHEDULE_PUBLISHED');
    expect((await mod('DELETE', `/schedules/${ctx.draftId}`)).status).toBe(409);
  });

  it('викладач бачить опублікований розклад та лише свої заняття', async () => {
    expect(
      (await teacher<ScheduleDto[]>('GET', `/schedules?semesterId=${ctx.semesterId}`)).body,
    ).toHaveLength(1);
    expect((await teacher('GET', `/schedules/${ctx.draftId}`)).status).toBe(200);

    const mine = await teacher<LessonItemDto[]>('GET', '/lessons?from=2026-09-01&to=2026-09-30');
    expect(mine.body.length).toBeGreaterThan(0);
    expect(mine.body.every((l) => l.teacher.id === ctx.teacher)).toBe(true);
    expect(mine.body[0]).toMatchObject({
      date: '2026-09-07',
      pairNumber: 2,
      kind: 'LECTURE',
      topic: 'Тема 1',
      status: 'PLANNED',
      discipline: { title: 'Інформатика', color: '#3B6EA5' },
      group: { name: 'ПДт-12' },
      room: { name: '101' },
    });

    // викладач не обходить обмеження фільтром
    const sneaky = await teacher<LessonItemDto[]>(
      'GET',
      `/lessons?from=2026-09-01&to=2026-09-30&teacherId=${ctx.teacher2}`,
    );
    expect(sneaky.body.every((l) => l.teacher.id === ctx.teacher)).toBe(true);

    const all = await mod<LessonItemDto[]>('GET', '/lessons?from=2026-09-01&to=2026-09-30');
    expect(new Set(all.body.map((l) => l.teacher.id))).toEqual(
      new Set([ctx.teacher, ctx.teacher2]),
    );
    const byTeacher2 = await mod<LessonItemDto[]>(
      'GET',
      `/lessons?from=2026-09-01&to=2026-09-30&teacherId=${ctx.teacher2}`,
    );
    expect(byTeacher2.body.every((l) => l.teacher.id === ctx.teacher2)).toBe(true);

    expect(
      (await otherMod<LessonItemDto[]>('GET', '/lessons?from=2026-09-01&to=2026-09-30')).body,
    ).toEqual([]);
  });

  it('діапазон занять обмежений', async () => {
    expect(
      (await mod<{ code: string }>('GET', '/lessons?from=2026-01-01&to=2026-12-31')).body.code,
    ).toBe('RANGE_TOO_LARGE');
    expect((await mod('GET', '/lessons?from=2026-09-30&to=2026-09-01')).status).toBe(422);
    expect((await mod('GET', '/lessons?from=вчора&to=2026-09-01')).status).toBe(400);
  });
});

describe('нова версія розкладу посеред семестру', () => {
  let draft2: ScheduleDetailDto;

  it('чернетка копіює опубліковану; зміни відстежуються', async () => {
    const res = await mod<ScheduleDetailDto>('POST', '/schedules', { semesterId: ctx.semesterId });
    expect(res.body).toMatchObject({ revision: 2, status: 'DRAFT', changedFromPublished: false });
    expect(res.body.slots).toHaveLength(2);
    draft2 = res.body;

    const add = await mod<SlotDto>(
      'POST',
      `/schedules/${draft2.id}/slots`,
      slot(ctx.loadLecture, { weekday: 3, pairNumber: 4 }),
    );
    expect(add.status).toBe(201);
    expect(
      (await mod<ScheduleDetailDto>('GET', `/schedules/${draft2.id}`)).body.changedFromPublished,
    ).toBe(true);
    await mod('DELETE', `/schedule-slots/${add.body.id}`);
    expect(
      (await mod<ScheduleDetailDto>('GET', `/schedules/${draft2.id}`)).body.changedFromPublished,
    ).toBe(false);
  });

  it('ідемпотентність: публікація без змін нічого не створює й не скасовує', async () => {
    app.clock.today = () => '2026-10-06';
    const preview = await mod<PublishResult>('POST', `/schedules/${draft2.id}/publish`, {
      dryRun: true,
    });
    expect(preview.body).toMatchObject({ create: 0, cancel: 0 });
    expect(preview.body.keep).toBeGreaterThan(0);
  });

  it('зміна шаблону зачіпає лише майбутні заняття без відміток; проведені й вручну змінені лишаються', async () => {
    // проведене в минулому, вручну змінене в майбутньому
    await prisma.lesson.updateMany({
      where: { loadId: ctx.loadLecture, date: new Date('2026-09-07') },
      data: { status: 'HELD' },
    });
    await prisma.lesson.updateMany({
      where: { loadId: ctx.loadLecture, date: new Date('2026-11-09') },
      data: { manuallyEdited: true },
    });

    // прибираємо понеділковий слот лекцій, додаємо середу
    const monday = draft2.slots.find((s) => s.loadId === ctx.loadLecture);
    await mod('DELETE', `/schedule-slots/${monday?.id}`);
    await mod(
      'POST',
      `/schedules/${draft2.id}/slots`,
      slot(ctx.loadLecture, { weekday: 3, pairNumber: 4, roomId: ctx.room1 }),
    );

    const preview = await mod<PublishResult>('POST', `/schedules/${draft2.id}/publish`, {
      dryRun: true,
    });
    expect(preview.body.create).toBeGreaterThan(0); // середи від 6 жовтня
    // майбутні понеділки (6 жовтня і далі) без 26 жовтня: 12, 19, 2, 16, 23, 30 лист., 7, 14, 21, 28 груд. — окрім змінених вручну 9 листопада
    expect(preview.body.cancel).toBeGreaterThan(0);

    const res = await mod<PublishResult>('POST', `/schedules/${draft2.id}/publish`, {});
    expect(res.status).toBe(200);

    const lessons = await prisma.lesson.findMany({ where: { loadId: ctx.loadLecture } });
    const alive = lessons.filter((l) => l.deletedAt === null);
    const iso = (l: { date: Date }) => l.date.toISOString().slice(0, 10);
    expect(alive.find((l) => iso(l) === '2026-09-07')?.status).toBe('HELD'); // проведене
    expect(alive.find((l) => iso(l) === '2026-11-09')?.manuallyEdited).toBe(true); // змінене вручну
    expect(alive.some((l) => iso(l) === '2026-10-12')).toBe(false); // майбутній понеділок прибрано
    expect(alive.some((l) => iso(l) === '2026-09-14')).toBe(true); // минуле не чіпаємо
    const wednesdays = alive.filter((l) => l.date.getUTCDay() === 3);
    expect(wednesdays.length).toBeGreaterThan(0);
    expect(wednesdays.every((l) => iso(l) >= '2026-10-06' && l.scheduleVersion === 2)).toBe(true);

    // повторний перегляд: уже нічого міняти
    const again = await mod<PublishResult>('POST', `/schedules/${draft2.id}/publish`, {
      dryRun: true,
    });
    expect(again.status).toBe(409); // версія опублікована
  });

  it('відкинути чернетку можна лише поки вона не опублікована', async () => {
    const draft3 = await mod<ScheduleDetailDto>('POST', '/schedules', {
      semesterId: ctx.semesterId,
    });
    expect(draft3.body.revision).toBe(3);
    expect((await mod('DELETE', `/schedules/${draft3.body.id}`)).status).toBe(204);
    expect((await mod('GET', `/schedules/${draft3.body.id}`)).status).toBe(404);
    expect(
      (await mod<ScheduleDto[]>('GET', `/schedules?semesterId=${ctx.semesterId}`)).body.map(
        (s) => s.revision,
      ),
    ).toEqual([2, 1]);
  });

  it('закритий семестр: розклад змінювати не можна', async () => {
    await prisma.semester.update({ where: { id: ctx.semesterId }, data: { status: 'CLOSED' } });
    const res = await mod<{ code: string }>('POST', '/schedules', { semesterId: ctx.semesterId });
    expect(res.body.code).toBe('SEMESTER_CLOSED');
  });
});
