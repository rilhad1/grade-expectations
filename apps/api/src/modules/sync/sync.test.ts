import {
  uuidv7,
  type LessonDetailDto,
  type LoadDto,
  type PullResponse,
  type PushResponse,
  type SyncOp,
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
let orgId = '';
let mod: ReturnType<typeof client>;
let teacher: ReturnType<typeof client>;
let teacher2: ReturnType<typeof client>;

const ids = {
  teacher: '',
  loadId: '',
  otherLoad: '',
  enrollments: [] as string[],
  date: '2026-10-12',
};

const lessonOn = async (date: string, loadId = ids.loadId) => {
  const l = await prisma.lesson.findFirst({ where: { loadId, date: new Date(date) } });
  if (!l) throw new Error(`Немає заняття ${date}`);
  return l.id;
};
const detail = async (id: string) => (await teacher<LessonDetailDto>('GET', `/lessons/${id}`)).body;
const push = (ops: SyncOp[], who = teacher) => who<PushResponse>('POST', '/sync/push', { ops });
// Час дій на пристрої: у минулому відносно реального «зараз» (інакше сервер обріже його до «зараз»)
const EPOCH = Date.now() - 3 * 3_600_000;
const t = (minutes: number) => new Date(EPOCH + minutes * 60_000).toISOString();

type Base = { opId: string; at: string; lessonId: string };
const att = (b: Base, enrollmentId: string, status: 'ABSENT' | 'PRESENT' | 'EXCUSED'): SyncOp => ({
  ...b,
  type: 'attendance.set',
  enrollmentId,
  status,
});
const gradeSet = (b: Base, enrollmentId: string, gradeId: string, value: number): SyncOp => ({
  ...b,
  type: 'grade.set',
  enrollmentId,
  gradeId,
  kind: 'ORAL',
  value,
  comment: null,
});
const base = (lessonId: string, at: string): Base => ({ opId: uuidv7(), at, lessonId });

beforeAll(async () => {
  app = await buildTestApp();
  app.clock.today = () => '2026-08-25';
  const org = await createOrganization(prisma, 'sync', {
    mod: ['MODERATOR'],
    teacher: ['TEACHER'],
    teacher2: ['TEACHER'],
  });
  orgId = org.organizationId;
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  teacher2 = client(app, await login(app, org.users['teacher2']?.email ?? ''));
  ids.teacher = org.users['teacher']?.id ?? '';

  await mod('PUT', '/bells', [
    { pairNumber: 1, startsAt: '08:00', endsAt: '09:20' },
    { pairNumber: 2, startsAt: '09:40', endsAt: '11:00' },
  ]);
  const year = await mod<{ id: string }>('POST', '/academic-years', {
    title: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
  });
  const semesterId = (
    await mod<{ id: string }>('POST', '/semesters', {
      academicYearId: year.body.id,
      number: 1,
      startDate: '2026-09-01',
      endDate: '2026-12-28',
      firstWeekParity: 'TOP',
    })
  ).body.id;
  await mod('POST', `/semesters/${semesterId}/activate`);
  const cohort = await mod<{ id: string }>('POST', '/cohorts', {
    specialty: 'ПЗ',
    entryYear: 2026,
  });
  const groupId = (
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
  ]) {
    const s = await mod<{ enrollments: { id: string }[] }>('POST', '/students', {
      lastName,
      firstName,
      groupId,
      fromDate: '2026-09-01',
    });
    ids.enrollments.push(s.body.enrollments[0]?.id ?? '');
  }
  const disciplineId = (
    await mod<{ id: string }>('POST', '/disciplines', {
      title: 'Інформатика',
      shortTitle: 'Інф',
      color: '#3B6EA5',
    })
  ).body.id;
  const mk = async (teacherId: string) =>
    (
      await mod<LoadDto>('POST', '/loads', {
        semesterId,
        disciplineId,
        groupId,
        teacherId,
        kind: 'LECTURE',
        plannedHours: 40,
        controlForm: 'EXAM',
      })
    ).body.id;
  ids.loadId = await mk(ids.teacher);
  ids.otherLoad = await mk(org.users['teacher2']?.id ?? '');
  const draft = await mod<{ id: string }>('POST', '/schedules', { semesterId });
  await mod('POST', `/schedules/${draft.body.id}/slots`, {
    loadId: ids.loadId,
    weekday: 1,
    pairNumber: 2,
  });
  await mod('POST', `/schedules/${draft.body.id}/slots`, {
    loadId: ids.otherLoad,
    weekday: 1,
    pairNumber: 1,
  });
  expect((await mod('POST', `/schedules/${draft.body.id}/publish`, {})).status).toBe(200);
  app.clock.today = () => ids.date;
});

afterAll(async () => {
  await prisma.changeLog.deleteMany({ where: { organizationId: orgId } });
  await deleteOrganization(prisma, orgId);
  await prisma.$disconnect();
  await app.close();
});

describe('sync/push', () => {
  it('застосовує пачку по черзі: відмітка, оцінка, тема, завершення', async () => {
    const lessonId = await lessonOn('2026-10-12');
    const [a, b] = ids.enrollments;
    const gradeId = uuidv7();
    const res = await push([
      att(base(lessonId, t(1)), a ?? '', 'ABSENT'),
      gradeSet(base(lessonId, t(2)), b ?? '', gradeId, 10),
      { ...base(lessonId, t(3)), type: 'lesson.info', topicText: 'Алгоритми', homework: null },
      { ...base(lessonId, t(4)), type: 'lesson.finish' },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.results.map((r) => r.status)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
    const d = await detail(lessonId);
    expect(d).toMatchObject({ status: 'HELD', topic: 'Алгоритми' });
    expect(d.roster.find((r) => r.enrollmentId === a)?.attendance).toBe('ABSENT');
    expect(d.roster.find((r) => r.enrollmentId === b)?.grades[0]).toMatchObject({
      id: gradeId,
      value: 10,
    });
  });

  it('ідемпотентність: повторна відправка повертає ті самі результати й нічого не дублює', async () => {
    const lessonId = await lessonOn('2026-10-19');
    const gradeId = uuidv7();
    const ops = [gradeSet(base(lessonId, t(5)), ids.enrollments[0] ?? '', gradeId, 8)];
    const first = await push(ops);
    const again = await push(ops);
    expect(first.body.results[0]?.status).toBe('applied');
    expect(again.body.results).toEqual(first.body.results);
    expect(await prisma.grade.count({ where: { lessonId } })).toBe(1);
  });

  it('LWW по клітинці: старіша дія з іншого пристрою програє, новіша виграє', async () => {
    const lessonId = await lessonOn('2026-10-26');
    const [a] = ids.enrollments;
    const gradeId = uuidv7();
    await push([gradeSet(base(lessonId, t(30)), a ?? '', gradeId, 9)]);

    const older = await push([gradeSet(base(lessonId, t(10)), a ?? '', gradeId, 4)]);
    expect(older.body.results[0]).toMatchObject({ status: 'skipped', code: 'SUPERSEDED' });
    expect((await detail(lessonId)).roster[0]?.grades[0]?.value).toBe(9);

    const newer = await push([gradeSet(base(lessonId, t(40)), a ?? '', gradeId, 11)]);
    expect(newer.body.results[0]?.status).toBe('applied');
    expect((await detail(lessonId)).roster[0]?.grades[0]?.value).toBe(11);

    // видалення зі старішим часом не стирає новіше значення
    const oldDelete = await push([{ ...base(lessonId, t(20)), type: 'grade.delete', gradeId }]);
    expect(oldDelete.body.results[0]).toMatchObject({ status: 'skipped', code: 'SUPERSEDED' });
    const del = await push([{ ...base(lessonId, t(50)), type: 'grade.delete', gradeId }]);
    expect(del.body.results[0]?.status).toBe('applied');
    expect((await detail(lessonId)).roster[0]?.grades).toHaveLength(0);
    const repeat = await push([{ ...base(lessonId, t(60)), type: 'grade.delete', gradeId }]);
    expect(repeat.body.results[0]).toMatchObject({ status: 'skipped', code: 'UNCHANGED' });
  });

  it('відвідуваність: онлайн-запис пізніше за офлайн-дію перемагає', async () => {
    const lessonId = await lessonOn('2026-11-02');
    const [a] = ids.enrollments;
    // онлайн (REST) ставить editedAt «зараз»; офлайн-дія з минулого програє
    await teacher('PUT', `/lessons/${lessonId}/attendance`, {
      marks: [{ enrollmentId: a, status: 'ABSENT' }],
    });
    const res = await push([att(base(lessonId, t(1)), a ?? '', 'PRESENT')]);
    expect(res.body.results[0]).toMatchObject({ status: 'skipped', code: 'SUPERSEDED' });
    expect((await detail(lessonId)).roster[0]?.attendance).toBe('ABSENT');

    // час із майбутнього обрізається до «зараз»: операція застосовується
    const future = await push([
      att(base(lessonId, new Date(Date.now() + 3_600_000).toISOString()), a ?? '', 'EXCUSED'),
    ]);
    expect(future.body.results[0]?.status).toBe('applied');
  });

  it('відмови: скасоване заняття, чуже заняття, оцінка поза шкалою, деканат без прав', async () => {
    const lessonId = await lessonOn('2026-11-09');
    const [a] = ids.enrollments;
    const bad = await push([gradeSet(base(lessonId, t(1)), a ?? '', uuidv7(), 13)]);
    expect(bad.body.results[0]).toMatchObject({ status: 'rejected', code: 'GRADE_OUT_OF_SCALE' });

    const foreign = await push([att(base(lessonId, t(1)), a ?? '', 'ABSENT')], teacher2);
    expect(foreign.body.results[0]).toMatchObject({ status: 'rejected', code: 'NOT_FOUND' });

    const byMod = await push([att(base(lessonId, t(1)), a ?? '', 'ABSENT')], mod);
    expect(byMod.body.results[0]).toMatchObject({ status: 'rejected', code: 'FORBIDDEN' });

    await prisma.lesson.update({ where: { id: lessonId }, data: { status: 'CANCELLED' } });
    const cancelled = await push([att(base(lessonId, t(1)), a ?? '', 'ABSENT')]);
    expect(cancelled.body.results[0]).toMatchObject({
      status: 'rejected',
      code: 'LESSON_NOT_ACTIVE',
    });
    await prisma.lesson.update({ where: { id: lessonId }, data: { status: 'PLANNED' } });
  });

  it('відхилена операція теж фіксується: повтор дає ту саму відмову', async () => {
    const lessonId = await lessonOn('2026-11-09');
    const op = gradeSet(base(lessonId, t(1)), ids.enrollments[0] ?? '', uuidv7(), 99);
    const first = await push([op]);
    const again = await push([op]);
    expect(again.body.results[0]).toEqual(first.body.results[0]);
  });

  it('завершення й скасування: повтор і зайвий reopen не ламають стан', async () => {
    const lessonId = await lessonOn('2026-10-12');
    const finishAgain = await push([{ ...base(lessonId, t(70)), type: 'lesson.finish' }]);
    expect(finishAgain.body.results[0]).toMatchObject({ status: 'skipped', code: 'UNCHANGED' });
    const reopen = await push([{ ...base(lessonId, t(71)), type: 'lesson.reopen' }]);
    expect(reopen.body.results[0]?.status).toBe('applied');
    const reopenAgain = await push([{ ...base(lessonId, t(72)), type: 'lesson.reopen' }]);
    expect(reopenAgain.body.results[0]).toMatchObject({ status: 'skipped', code: 'UNCHANGED' });
    const infoSame = await push([
      { ...base(lessonId, t(73)), type: 'lesson.info', topicText: 'Алгоритми' },
    ]);
    expect(infoSame.body.results[0]).toMatchObject({ status: 'skipped', code: 'UNCHANGED' });
  });

  it('вимагає входу й валідує тіло', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/sync/push',
          payload: { ops: [{ ...base(uuidv7(), t(1)), type: 'lesson.finish' }] },
        })
      ).statusCode,
    ).toBe(401);
    expect((await teacher('POST', '/sync/push', { ops: [] })).status).toBe(400);
  });
});

describe('sync/pull', () => {
  it('знімок: заняття викладача у вікні, дзвінки; чужих занять немає', async () => {
    const res = await teacher<PullResponse>('GET', '/sync/pull');
    expect(res.status).toBe(200);
    expect(res.body.window).toEqual({ from: '2026-09-28', to: '2026-10-26' });
    expect(res.body.bells.map((b) => b.pairNumber)).toEqual([1, 2]);
    const own = res.body.lessons.map((l) => l.loadId);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((id) => id === ids.loadId)).toBe(true);
    expect(res.body.lessons.every((l) => l.date >= '2026-09-28' && l.date <= '2026-10-26')).toBe(
      true,
    );
    expect(res.body.removedLessonIds).toEqual([]);
  });

  it('дельта: лише змінені після курсора, зміни з іншого пристрою видно', async () => {
    await new Promise((r) => setTimeout(r, 2_300)); // зміни з попередніх тестів мають вийти за запас курсора
    const first = await teacher<PullResponse>('GET', '/sync/pull');
    await new Promise((r) => setTimeout(r, 2_300));
    const quiet = await teacher<PullResponse>(
      'GET',
      `/sync/pull?since=${encodeURIComponent(first.body.cursor)}`,
    );
    expect(quiet.body.lessons).toHaveLength(0);

    const lessonId = await lessonOn('2026-10-19');
    await teacher('PUT', `/lessons/${lessonId}/attendance`, {
      marks: [{ enrollmentId: ids.enrollments[1], status: 'ABSENT' }],
    });
    const delta = await teacher<PullResponse>(
      'GET',
      `/sync/pull?since=${encodeURIComponent(quiet.body.cursor)}`,
    );
    expect(delta.body.lessons.map((l) => l.id)).toEqual([lessonId]);
    expect(
      delta.body.lessons[0]?.roster.find((r) => r.enrollmentId === ids.enrollments[1]),
    ).toMatchObject({
      attendance: 'ABSENT',
    });
  });

  it('видалені заняття потрапляють у removedLessonIds', async () => {
    const first = await teacher<PullResponse>('GET', '/sync/pull');
    const lessonId = await lessonOn('2026-10-26');
    await new Promise((r) => setTimeout(r, 2_300));
    await prisma.lesson.update({ where: { id: lessonId }, data: { deletedAt: new Date() } });
    const delta = await teacher<PullResponse>(
      'GET',
      `/sync/pull?since=${encodeURIComponent(first.body.cursor)}`,
    );
    expect(delta.body.removedLessonIds).toEqual([lessonId]);
    expect(delta.body.lessons.map((l) => l.id)).not.toContain(lessonId);
  });

  it('вимагає входу', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/sync/pull' })).statusCode).toBe(401);
  });
});
