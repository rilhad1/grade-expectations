import {
  uuidv7,
  type FreeSlotDto,
  type LessonItemDto,
  type LoadDto,
  type PublishResult,
  type RescheduleRequestDto,
  type ScheduleDetailDto,
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
let teacher2: ReturnType<typeof client>;
let otherMod: ReturnType<typeof client>;

const ctx = {
  teacher: '',
  teacher2: '',
  semesterId: '',
  loadLecture: '',
  loadPractice: '',
  room1: '',
  room2: '',
};
type Page<T> = { items: T[]; nextCursor: string | null };

/** Заняття лекції в понеділок (loadLecture) на задану дату. */
const lectureOn = async (date: string) => {
  const lesson = await prisma.lesson.findFirst({
    where: { loadId: ctx.loadLecture, date: new Date(date) },
  });
  if (!lesson) throw new Error(`Немає заняття ${date}`);
  return lesson;
};

beforeAll(async () => {
  app = await buildTestApp();
  app.clock.today = () => '2026-08-25';

  const org = await createOrganization(prisma, 'req', {
    mod: ['MODERATOR'],
    teacher: ['TEACHER'],
    teacher2: ['TEACHER'],
  });
  const other = await createOrganization(prisma, 'req-other', { mod: ['MODERATOR'] });
  orgs = [org.organizationId, other.organizationId];
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
    })
  ).body.id;
  const cohort = await mod<{ id: string }>('POST', '/cohorts', {
    specialty: 'ПЗ',
    entryYear: 2026,
  });
  const group = await mod<{ id: string }>('POST', '/groups', {
    cohortId: cohort.body.id,
    academicYearId: year.body.id,
    name: 'ПДт-12',
    course: 1,
  });
  const disc = await mod<{ id: string }>('POST', '/disciplines', {
    title: 'Інформатика',
    shortTitle: 'Інф',
    color: '#3B6EA5',
  });

  const mk = async (teacherId: string, kind: string) =>
    (
      await mod<LoadDto>('POST', '/loads', {
        semesterId: ctx.semesterId,
        disciplineId: disc.body.id,
        groupId: group.body.id,
        teacherId,
        kind,
        plannedHours: 40,
        controlForm: 'EXAM',
      })
    ).body.id;
  ctx.loadLecture = await mk(ctx.teacher, 'LECTURE');
  ctx.loadPractice = await mk(ctx.teacher2, 'PRACTICE');

  // понеділок, пара 2 — лекції; вівторок, пара 1 — практика тієї ж групи
  const draft = await mod<ScheduleDetailDto>('POST', '/schedules', { semesterId: ctx.semesterId });
  await mod('POST', `/schedules/${draft.body.id}/slots`, {
    loadId: ctx.loadLecture,
    weekday: 1,
    pairNumber: 2,
    roomId: ctx.room1,
  });
  await mod('POST', `/schedules/${draft.body.id}/slots`, {
    loadId: ctx.loadPractice,
    weekday: 2,
    pairNumber: 1,
    roomId: ctx.room2,
  });
  const published = await mod('POST', `/schedules/${draft.body.id}/publish`, {});
  expect(published.status).toBe(200);

  app.clock.today = () => '2026-10-06'; // «сьогодні» — вівторок посеред семестру
});

afterAll(async () => {
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
});

describe('запит на перенесення', () => {
  let lessonId = '';
  let request: RescheduleRequestDto;

  it('викладач створює запит на своє заняття; видно тільки йому та деканату', async () => {
    lessonId = (await lectureOn('2026-10-12')).id;
    const res = await teacher<RescheduleRequestDto>('POST', '/reschedule-requests', {
      lessonId,
      proposedDate: '2026-10-13',
      proposedPair: 1,
      proposedRoomId: ctx.room2,
      reason: 'Відрядження на конференцію',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      proposedDate: '2026-10-13',
      proposedPair: 1,
      reason: 'Відрядження на конференцію',
      requestedBy: { id: ctx.teacher },
      resolvedBy: null,
      lesson: {
        date: '2026-10-12',
        pairNumber: 2,
        discipline: { title: 'Інформатика' },
        group: { name: 'ПДт-12' },
      },
    });
    request = res.body;

    expect(
      (await teacher<Page<RescheduleRequestDto>>('GET', '/reschedule-requests')).body.items,
    ).toHaveLength(1);
    expect(
      (await teacher2<Page<RescheduleRequestDto>>('GET', '/reschedule-requests')).body.items,
    ).toHaveLength(0);
    expect((await teacher2('GET', `/reschedule-requests/${request.id}`)).status).toBe(404);
    expect(
      (await mod<Page<RescheduleRequestDto>>('GET', '/reschedule-requests?status=PENDING')).body
        .items,
    ).toHaveLength(1);
    expect(
      (await otherMod<Page<RescheduleRequestDto>>('GET', '/reschedule-requests')).body.items,
    ).toHaveLength(0);
    expect((await otherMod('GET', `/reschedule-requests/${request.id}`)).status).toBe(404);
  });

  it('права: чужий викладач і модератор не створюють запитів; дубль на розгляді → 409', async () => {
    const body = { lessonId, proposedDate: '2026-10-14', proposedPair: 2, reason: 'Причина' };
    expect((await teacher2('POST', '/reschedule-requests', body)).status).toBe(403);
    expect((await mod('POST', '/reschedule-requests', body)).status).toBe(403);
    const dup = await teacher<{ code: string }>('POST', '/reschedule-requests', body);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('REQUEST_PENDING');
  });

  it('перевірки: минула дата, поза семестром, невідома пара, минуле заняття, невідоме заняття', async () => {
    const other = (await lectureOn('2026-10-19')).id;
    const base = {
      lessonId: other,
      proposedDate: '2026-10-20',
      proposedPair: 2,
      reason: 'Причина',
    };
    expect(
      (
        await teacher<{ code: string }>('POST', '/reschedule-requests', {
          ...base,
          proposedDate: '2026-10-01',
        })
      ).body.code,
    ).toBe('DATE_IN_PAST');
    expect(
      (
        await teacher<{ code: string }>('POST', '/reschedule-requests', {
          ...base,
          proposedDate: '2027-02-01',
        })
      ).body.code,
    ).toBe('DATE_OUT_OF_SEMESTER');
    expect(
      (
        await teacher<{ code: string }>('POST', '/reschedule-requests', {
          ...base,
          proposedPair: 9,
        })
      ).body.code,
    ).toBe('UNKNOWN_PAIR');
    expect(
      (
        await teacher<{ code: string }>('POST', '/reschedule-requests', {
          ...base,
          proposedRoomId: uuidv7(),
        })
      ).body.code,
    ).toBe('ROOM_NOT_FOUND');
    expect((await teacher('POST', '/reschedule-requests', { ...base, reason: 'a' })).status).toBe(
      400,
    );

    const past = (await lectureOn('2026-09-14')).id;
    expect(
      (await teacher<{ code: string }>('POST', '/reschedule-requests', { ...base, lessonId: past }))
        .body.code,
    ).toBe('LESSON_NOT_MOVABLE');
    expect(
      (await teacher('POST', '/reschedule-requests', { ...base, lessonId: uuidv7() })).status,
    ).toBe(404);
  });

  it('підказка вільних слотів: без зайнятих групою, лише для деканату', async () => {
    const res = await mod<FreeSlotDto[]>('GET', `/reschedule-requests/${request.id}/free-slots`);
    expect(res.status).toBe(200);
    const on = (date: string, pair: number) =>
      res.body.find((s) => s.date === date && s.pairNumber === pair);

    expect(on('2026-10-13', 1)).toBeUndefined(); // у вівторок 1-ша пара в групи практика
    expect(on('2026-10-13', 2)).toBeDefined();
    expect(on('2026-10-12', 2)).toBeDefined(); // власний слот заняття не блокує
    expect(on('2026-10-11', 1)).toBeUndefined(); // неділя — не навчальний день
    expect(res.body.every((s) => s.date >= '2026-10-06')).toBe(true);
    // найближчі до бажаної дати — першими
    expect(res.body[0]?.date).toBe('2026-10-13');
    expect(
      res.body.find((s) => s.date === '2026-10-13' && s.pairNumber === 2)?.freeRoomIds,
    ).toEqual(expect.arrayContaining([ctx.room1, ctx.room2]));

    expect((await teacher('GET', `/reschedule-requests/${request.id}/free-slots`)).status).toBe(
      403,
    );
  });

  it('погодження в зайнятий слот → 409, запит лишається на розгляді', async () => {
    const res = await mod<{ code: string }>(
      'POST',
      `/reschedule-requests/${request.id}/approve`,
      {},
    );
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SLOT_NOT_FREE');
    expect(
      (await mod<RescheduleRequestDto>('GET', `/reschedule-requests/${request.id}`)).body.status,
    ).toBe('PENDING');
  });

  it('погодження в інший вільний слот переносить заняття: оригінал — MOVED, нове — окремий запис', async () => {
    const res = await mod<RescheduleRequestDto>(
      'POST',
      `/reschedule-requests/${request.id}/approve`,
      {
        date: '2026-10-13',
        pairNumber: 2,
        roomId: ctx.room1,
        comment: 'Погоджено, інша пара',
      },
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'APPROVED', resolverComment: 'Погоджено, інша пара' });
    expect(res.body.resolvedBy?.fullName).toContain('mod');

    const original = await prisma.lesson.findUnique({ where: { id: lessonId } });
    expect(original?.status).toBe('MOVED');
    const moved = await prisma.lesson.findFirst({
      where: { loadId: ctx.loadLecture, date: new Date('2026-10-13'), pairNumber: 2 },
    });
    expect(moved).toMatchObject({
      status: 'PLANNED',
      slotId: null,
      manuallyEdited: true,
      teacherId: ctx.teacher,
      roomId: ctx.room1,
    });
    expect(moved?.topicId).toBe(original?.topicId);

    // викладач бачить нове заняття, перенесене не рахується у вичитку
    const mine = await teacher<LessonItemDto[]>('GET', '/lessons?from=2026-10-12&to=2026-10-13');
    expect(mine.body.map((l) => `${l.date}:${l.pairNumber}:${l.status}`)).toEqual([
      '2026-10-12:2:MOVED',
      '2026-10-13:2:PLANNED',
    ]);

    const again = await mod<{ code: string }>(
      'POST',
      `/reschedule-requests/${request.id}/approve`,
      {},
    );
    expect(again.body.code).toBe('REQUEST_NOT_PENDING');
  });

  it('повторна публікація не відтворює перенесене заняття і не скасовує додаткове', async () => {
    const draft = await mod<ScheduleDetailDto>('POST', '/schedules', {
      semesterId: ctx.semesterId,
    });
    const preview = await mod<PublishResult>('POST', `/schedules/${draft.body.id}/publish`, {
      dryRun: true,
    });
    expect(preview.body).toMatchObject({ create: 0, cancel: 0 });
    await mod('DELETE', `/schedules/${draft.body.id}`);
  });

  it('відхилення потребує коментаря і працює один раз', async () => {
    const lesson = await lectureOn('2026-10-19');
    const created = await teacher<RescheduleRequestDto>('POST', '/reschedule-requests', {
      lessonId: lesson.id,
      proposedDate: '2026-10-21',
      proposedPair: 3,
      reason: 'Особисті обставини',
    });
    const id = created.body.id;
    expect((await mod('POST', `/reschedule-requests/${id}/reject`, {})).status).toBe(400);
    expect(
      (await teacher('POST', `/reschedule-requests/${id}/reject`, { comment: 'ні' })).status,
    ).toBe(403);
    const rej = await mod<RescheduleRequestDto>('POST', `/reschedule-requests/${id}/reject`, {
      comment: 'Немає вільних аудиторій',
    });
    expect(rej.body).toMatchObject({
      status: 'REJECTED',
      resolverComment: 'Немає вільних аудиторій',
    });
    expect(
      (
        await mod<{ code: string }>('POST', `/reschedule-requests/${id}/reject`, {
          comment: 'ще раз',
        })
      ).body.code,
    ).toBe('REQUEST_NOT_PENDING');
    expect(
      (await mod<{ code: string }>('POST', `/reschedule-requests/${id}/approve`, {})).body.code,
    ).toBe('REQUEST_NOT_PENDING');
    // заняття не рухалось
    expect((await prisma.lesson.findUnique({ where: { id: lesson.id } }))?.status).toBe('PLANNED');
    // після відхилення можна подати новий запит
    expect(
      (
        await teacher('POST', '/reschedule-requests', {
          lessonId: lesson.id,
          proposedDate: '2026-10-22',
          proposedPair: 2,
          reason: 'Нова спроба',
        })
      ).status,
    ).toBe(201);
  });
});

describe('винятки для окремих занять', () => {
  it('скасування: заплановане → CANCELLED, повторно не можна, викладачу заборонено', async () => {
    const lesson = await lectureOn('2026-11-02');
    expect((await teacher('POST', `/lessons/${lesson.id}/cancel`, {})).status).toBe(403);
    expect((await mod('POST', `/lessons/${lesson.id}/cancel`, { reason: 'Карантин' })).status).toBe(
      204,
    );
    const row = await prisma.lesson.findUnique({ where: { id: lesson.id } });
    expect(row).toMatchObject({ status: 'CANCELLED', manuallyEdited: true, note: 'Карантин' });
    expect(
      (await mod<{ code: string }>('POST', `/lessons/${lesson.id}/cancel`, {})).body.code,
    ).toBe('LESSON_NOT_PLANNED');
    expect((await otherMod('POST', `/lessons/${lesson.id}/cancel`, {})).status).toBe(404);
  });

  it('заміна викладача на одному занятті', async () => {
    const lesson = await lectureOn('2026-11-09');
    expect(
      (await mod('POST', `/lessons/${lesson.id}/substitute`, { teacherId: ctx.teacher2 })).status,
    ).toBe(204);
    expect(await prisma.lesson.findUnique({ where: { id: lesson.id } })).toMatchObject({
      teacherId: ctx.teacher2,
      manuallyEdited: true,
    });
    expect(
      (
        await mod<{ code: string }>('POST', `/lessons/${lesson.id}/substitute`, {
          teacherId: uuidv7(),
        })
      ).body.code,
    ).toBe('NOT_A_TEACHER');
    // нова власниця заняття бачить його у своєму календарі
    const theirs = await teacher2<LessonItemDto[]>('GET', '/lessons?from=2026-11-09&to=2026-11-09');
    expect(theirs.body.some((l) => l.id === lesson.id)).toBe(true);
  });

  it('додаткова пара: створення, дубль, зайнятий слот, неробочий день, поза семестром', async () => {
    const ok = await mod<{ id: string }>('POST', '/lessons', {
      loadId: ctx.loadLecture,
      date: '2026-12-23',
      pairNumber: 3,
      roomId: ctx.room1,
    });
    expect(ok.status).toBe(201);
    expect(await prisma.lesson.findUnique({ where: { id: ok.body.id } })).toMatchObject({
      slotId: null,
      manuallyEdited: true,
      status: 'PLANNED',
    });

    expect(
      (
        await mod<{ code: string }>('POST', '/lessons', {
          loadId: ctx.loadLecture,
          date: '2026-12-23',
          pairNumber: 3,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await mod<{ code: string }>('POST', '/lessons', {
          loadId: ctx.loadLecture,
          date: '2026-10-20',
          pairNumber: 1,
        })
      ).body.code,
    ).toBe('SLOT_NOT_FREE'); // група зайнята
    expect(
      (
        await mod<{ code: string }>('POST', '/lessons', {
          loadId: ctx.loadLecture,
          date: '2026-10-25',
          pairNumber: 2,
        })
      ).body.code,
    ).toBe('SLOT_NOT_FREE'); // неділя
    expect(
      (
        await mod<{ code: string }>('POST', '/lessons', {
          loadId: ctx.loadLecture,
          date: '2027-03-01',
          pairNumber: 2,
        })
      ).body.code,
    ).toBe('DATE_OUT_OF_SEMESTER');
    expect(
      (
        await teacher('POST', '/lessons', {
          loadId: ctx.loadLecture,
          date: '2026-12-24',
          pairNumber: 3,
        })
      ).status,
    ).toBe(403);
  });

  it('скасоване заняття можна «відновити» додатковою парою на те саме місце', async () => {
    const res = await mod<{ id: string }>('POST', '/lessons', {
      loadId: ctx.loadLecture,
      date: '2026-11-02',
      pairNumber: 2,
    });
    expect(res.status).toBe(201);
    expect((await prisma.lesson.findUnique({ where: { id: res.body.id } }))?.status).toBe(
      'PLANNED',
    );
  });
});
