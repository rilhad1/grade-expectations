import type { LessonDetailDto, LessonItemDto, LoadDto } from '@ge/shared';
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

const ids = { teacher: '', semesterId: '', scheduleId: '', loads: [] as string[], other: '' };

beforeAll(async () => {
  app = await buildTestApp();
  app.clock.today = () => '2026-08-25';
  const org = await createOrganization(prisma, 'streams', {
    mod: ['MODERATOR'],
    teacher: ['TEACHER'],
    teacher2: ['TEACHER'],
  });
  orgId = org.organizationId;
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  teacher2 = client(app, await login(app, org.users['teacher2']?.email ?? ''));
  ids.teacher = org.users['teacher']?.id ?? '';

  await mod('PUT', '/bells', [{ pairNumber: 1, startsAt: '08:00', endsAt: '09:20' }]);
  const room = await mod<{ id: string }>('POST', '/rooms', { name: '2203' });
  const year = await mod<{ id: string }>('POST', '/academic-years', {
    title: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
  });
  ids.semesterId = (
    await mod<{ id: string }>('POST', '/semesters', {
      academicYearId: year.body.id,
      number: 1,
      startDate: '2026-09-01',
      endDate: '2026-12-28',
      firstWeekParity: 'TOP',
    })
  ).body.id;
  await mod('POST', `/semesters/${ids.semesterId}/activate`);
  const cohort = await mod<{ id: string }>('POST', '/cohorts', {
    specialty: 'КІ',
    entryYear: 2024,
  });
  const discipline = (
    await mod<{ id: string }>('POST', '/disciplines', {
      title: 'Метрологія',
      shortTitle: 'Метр.',
      color: '#8A6D3B',
    })
  ).body.id;
  const mk = async (groupName: string, teacherId: string, kind = 'LECTURE') => {
    const group = await mod<{ id: string }>('POST', '/groups', {
      cohortId: cohort.body.id,
      academicYearId: year.body.id,
      name: groupName,
      course: 3,
    });
    await mod('POST', '/students', {
      lastName: `Студент-${groupName}`,
      firstName: 'Тест',
      groupId: group.body.id,
      fromDate: '2026-09-01',
    });
    return (
      await mod<LoadDto>('POST', '/loads', {
        semesterId: ids.semesterId,
        disciplineId: discipline,
        groupId: group.body.id,
        teacherId,
        kind,
        plannedHours: 34,
        controlForm: 'CREDIT',
      })
    ).body.id;
  };
  for (const name of ['КІт-32', 'КІт-31', 'КІт-33']) ids.loads.push(await mk(name, ids.teacher));
  ids.other = await mk('КІт-34', org.users['teacher2']?.id ?? '');

  const draft = await mod<{ id: string }>('POST', '/schedules', { semesterId: ids.semesterId });
  ids.scheduleId = draft.body.id;
  for (const loadId of ids.loads)
    await mod('POST', `/schedules/${draft.body.id}/slots`, {
      loadId,
      weekday: 1,
      pairNumber: 1,
      roomId: room.body.id,
    });
});

afterAll(async () => {
  await prisma.changeLog.deleteMany({ where: { organizationId: orgId } });
  await deleteOrganization(prisma, orgId);
  await prisma.$disconnect();
  await app.close();
});

describe('потоки лекцій', () => {
  it('без потоку одна пара кількох груп — конфлікт викладача й аудиторії, публікація заблокована', async () => {
    const res = await mod('POST', `/schedules/${ids.scheduleId}/publish`, {});
    expect(res.status).toBe(422);
  });

  it('об’єднання: потік має спільний streamId; чужий викладач, різні види й дублікати груп відхиляються', async () => {
    const wrong = await mod('POST', '/loads/stream', { loadIds: [ids.loads[0], ids.other] });
    expect(wrong.status).toBe(422);
    expect((wrong.body as { code?: string }).code).toBe('STREAM_MISMATCH');
    expect((await mod('POST', '/loads/stream', { loadIds: [ids.loads[0]] })).status).toBe(400);
    expect((await teacher('POST', '/loads/stream', { loadIds: ids.loads })).status).toBe(403);

    const merged = await mod<LoadDto[]>('POST', '/loads/stream', { loadIds: ids.loads });
    expect(merged.status).toBe(200);
    const streamIds = new Set(merged.body.map((l) => l.streamId));
    expect(streamIds.size).toBe(1);
    expect([...streamIds][0]).not.toBeNull();
  });

  it('потік не дає конфліктів: розклад публікується, заняття створені для кожної групи', async () => {
    const res = await mod('POST', `/schedules/${ids.scheduleId}/publish`, {});
    expect(res.status).toBe(200);
    app.clock.today = () => '2026-09-14';
    const list = await teacher<LessonItemDto[]>('GET', '/lessons?from=2026-09-14&to=2026-09-14');
    expect(list.body).toHaveLength(3);
    expect(new Set(list.body.map((l) => l.streamId)).size).toBe(1);
    expect(list.body[0]?.streamId).not.toBeNull();
  });

  it('деталь заняття показує всі групи потоку тієї ж пари; чужий викладач їх не бачить', async () => {
    const list = await teacher<LessonItemDto[]>('GET', '/lessons?from=2026-09-14&to=2026-09-14');
    const first = list.body[0];
    const detail = await teacher<LessonDetailDto>('GET', `/lessons/${first?.id ?? ''}`);
    expect(detail.body.stream.map((s) => s.group.name)).toEqual(['КІт-31', 'КІт-32', 'КІт-33']);
    expect(detail.body.stream.map((s) => s.lessonId)).toContain(first?.id);
    expect((await teacher2('GET', `/lessons/${first?.id ?? ''}`)).status).toBeGreaterThanOrEqual(
      403,
    );
  });

  it('вихід із потоку: група виходить; коли лишається одна — потік розпускається', async () => {
    const left = await mod<LoadDto>('DELETE', `/loads/${ids.loads[0]}/stream`);
    expect(left.body.streamId).toBeNull();
    const rest = await mod<{ items: LoadDto[] }>('GET', `/loads?semesterId=${ids.semesterId}`);
    const members = rest.body.items.filter((l) => ids.loads.includes(l.id) && l.streamId !== null);
    expect(members).toHaveLength(2);
    await mod('DELETE', `/loads/${ids.loads[1]}/stream`);
    const after = await mod<{ items: LoadDto[] }>('GET', `/loads?semesterId=${ids.semesterId}`);
    expect(after.body.items.filter((l) => l.streamId !== null)).toHaveLength(0);
  });
});
