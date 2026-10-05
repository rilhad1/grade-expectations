import { uuidv7, type LoadDto, type SemesterFullDto } from '@ge/shared';
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
let ids = {
  teacher: '',
  teacher2: '',
  mod: '',
  yearId: '',
  semesterId: '',
  disciplineId: '',
  groupId: '',
  subgroupId: '',
};

type Page<T> = { items: T[]; nextCursor: string | null };

beforeAll(async () => {
  app = await buildTestApp();
  const org = await createOrganization(prisma, 'load', {
    mod: ['MODERATOR'],
    teacher: ['TEACHER'],
    teacher2: ['TEACHER'],
  });
  const other = await createOrganization(prisma, 'load-other', { mod: ['MODERATOR'] });
  orgs = [org.organizationId, other.organizationId];
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  teacher2 = client(app, await login(app, org.users['teacher2']?.email ?? ''));
  otherMod = client(app, await login(app, other.users['mod']?.email ?? ''));

  const year = await mod<{ id: string }>('POST', '/academic-years', {
    title: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
  });
  const sem = await mod<SemesterFullDto>('POST', '/semesters', {
    academicYearId: year.body.id,
    number: 1,
    startDate: '2026-09-01',
    endDate: '2026-12-28',
    firstWeekParity: 'TOP',
  });
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
  const sub = await mod<{ id: string }>('POST', `/groups/${group.body.id}/subgroups`, {
    name: '1 підгрупа',
  });
  const disc = await mod<{ id: string }>('POST', '/disciplines', {
    title: 'Інформатика',
    shortTitle: 'Інф',
    color: '#3B6EA5',
    defaultScale: 'FIVE',
  });
  ids = {
    teacher: org.users['teacher']?.id ?? '',
    teacher2: org.users['teacher2']?.id ?? '',
    mod: org.users['mod']?.id ?? '',
    yearId: year.body.id,
    semesterId: sem.body.id,
    disciplineId: disc.body.id,
    groupId: group.body.id,
    subgroupId: sub.body.id,
  };
});

afterAll(async () => {
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
});

const payload = (over: object = {}) => ({
  semesterId: ids.semesterId,
  disciplineId: ids.disciplineId,
  groupId: ids.groupId,
  teacherId: ids.teacher,
  kind: 'LECTURE',
  plannedHours: 32,
  controlForm: 'EXAM',
  ...over,
});

describe('навантаження', () => {
  let load: LoadDto;

  it('створення: правила оцінювання за замовчуванням зі шкалою дисципліни, розгорнуті назви, вичитка', async () => {
    const res = await mod<LoadDto>('POST', '/loads', payload());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kind: 'LECTURE',
      plannedHours: 32,
      controlForm: 'EXAM',
      discipline: { title: 'Інформатика', color: '#3B6EA5' },
      group: { name: 'ПДт-12' },
      subgroup: null,
      teacher: { id: ids.teacher },
      hours: { planned: 32, held: 0, forecast: 0, deficit: 32, extraPairsNeeded: 16 },
    });
    expect(res.body.gradingRules.scale).toBe('FIVE');
    load = res.body;
  });

  it('дублікат (той самий семестр/дисципліна/група/підгрупа/вид) → 409', async () => {
    const res = await mod<{ code: string }>('POST', '/loads', payload());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_LOAD');
  });

  it('інший вид занять або підгрупа — окреме навантаження (за OQ-8)', async () => {
    expect(
      (
        await mod(
          'POST',
          '/loads',
          payload({ kind: 'LAB', subgroupId: ids.subgroupId, plannedHours: 16 }),
        )
      ).status,
    ).toBe(201);
  });

  it('перевірки: викладач, підгрупа, рік групи, чужі дані', async () => {
    const notTeacher = await mod<{ code: string }>(
      'POST',
      '/loads',
      payload({ kind: 'PRACTICE', teacherId: ids.mod }),
    );
    expect(notTeacher.status).toBe(422);
    expect(notTeacher.body.code).toBe('NOT_A_TEACHER');

    const badSub = await mod<{ code: string }>(
      'POST',
      '/loads',
      payload({ kind: 'PRACTICE', subgroupId: uuidv7() }),
    );
    expect(badSub.body.code).toBe('SUBGROUP_NOT_IN_GROUP');

    const year2 = await mod<{ id: string }>('POST', '/academic-years', {
      title: '2027/2028',
      startDate: '2027-09-01',
      endDate: '2028-06-30',
    });
    const cohort = await mod<{ id: string }>('POST', '/cohorts', {
      specialty: 'Інше',
      entryYear: 2027,
    });
    const g2 = await mod<{ id: string }>('POST', '/groups', {
      cohortId: cohort.body.id,
      academicYearId: year2.body.id,
      name: 'ПДт-11',
      course: 1,
    });
    const mismatch = await mod<{ code: string }>(
      'POST',
      '/loads',
      payload({ groupId: g2.body.id, kind: 'SEMINAR' }),
    );
    expect(mismatch.body.code).toBe('GROUP_YEAR_MISMATCH');

    expect((await otherMod('POST', '/loads', payload({ kind: 'SEMINAR' }))).status).toBe(404);
  });

  it('викладач бачить лише власне навантаження і не змінює його', async () => {
    await mod(
      'POST',
      '/loads',
      payload({ kind: 'CONTROL', teacherId: ids.teacher2, plannedHours: 4 }),
    );
    const mine = await teacher<Page<LoadDto>>('GET', `/loads?semesterId=${ids.semesterId}`);
    expect(new Set(mine.body.items.map((l) => l.teacher.id))).toEqual(new Set([ids.teacher]));
    // навіть явний фільтр за іншим викладачем не відкриває чужого
    const sneaky = await teacher<Page<LoadDto>>(
      'GET',
      `/loads?semesterId=${ids.semesterId}&teacherId=${ids.teacher2}`,
    );
    expect(sneaky.body.items.every((l) => l.teacher.id === ids.teacher)).toBe(true);

    const all = await mod<Page<LoadDto>>('GET', `/loads?semesterId=${ids.semesterId}`);
    expect(all.body.items).toHaveLength(3);
    const foreign = all.body.items.find((l) => l.teacher.id === ids.teacher2);
    expect((await teacher('GET', `/loads/${foreign?.id}`)).status).toBe(404);
    expect((await teacher2('GET', `/loads/${foreign?.id}`)).status).toBe(200);
    expect(
      (await teacher('PATCH', `/loads/${load.id}`, { plannedHours: 10, version: load.version }))
        .status,
    ).toBe(403);
    expect((await teacher('POST', '/loads', payload({ kind: 'SEMINAR' }))).status).toBe(403);
  });

  it('оновлення за версією; зміна викладача переносить лише майбутні заплановані заняття', async () => {
    const past = uuidv7();
    const future = uuidv7();
    const held = uuidv7();
    await prisma.lesson.createMany({
      data: [
        {
          id: held,
          loadId: load.id,
          teacherId: ids.teacher,
          date: new Date('2026-09-07'),
          pairNumber: 1,
          status: 'HELD',
        },
        {
          id: past,
          loadId: load.id,
          teacherId: ids.teacher,
          date: new Date('2026-09-14'),
          pairNumber: 1,
          status: 'PLANNED',
        },
        {
          id: future,
          loadId: load.id,
          teacherId: ids.teacher,
          date: new Date('2099-09-14'),
          pairNumber: 1,
          status: 'PLANNED',
        },
      ],
    });
    const res = await mod<LoadDto>('PATCH', `/loads/${load.id}`, {
      teacherId: ids.teacher2,
      plannedHours: 40,
      version: load.version,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      plannedHours: 40,
      teacher: { id: ids.teacher2 },
      version: load.version + 1,
    });
    expect(res.body.hours).toMatchObject({ planned: 40, held: 2, forecast: 4 }); // 1 проведене + 1 майбутнє

    const teachers = Object.fromEntries(
      (await prisma.lesson.findMany({ where: { id: { in: [held, past, future] } } })).map((l) => [
        l.id,
        l.teacherId,
      ]),
    );
    expect(teachers).toEqual({ [held]: ids.teacher, [past]: ids.teacher, [future]: ids.teacher2 });

    expect(
      (await mod('PATCH', `/loads/${load.id}`, { plannedHours: 1, version: load.version })).status,
    ).toBe(409);
    expect(
      (await mod('PATCH', `/loads/${load.id}`, { teacherId: ids.mod, version: res.body.version }))
        .status,
    ).toBe(422);
    load = res.body;
  });

  it('видалення: заборонене, якщо є проведені заняття або слоти розкладу', async () => {
    const res = await mod<{ code: string }>('DELETE', `/loads/${load.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LOAD_HAS_LESSONS');

    const created = await mod<LoadDto>(
      'POST',
      '/loads',
      payload({ kind: 'SEMINAR', plannedHours: 8 }),
    );
    const sched = uuidv7();
    await prisma.schedule.create({ data: { id: sched, semesterId: ids.semesterId, revision: 1 } });
    await prisma.scheduleSlot.create({
      data: {
        id: uuidv7(),
        scheduleId: sched,
        loadId: created.body.id,
        weekday: 1,
        pairNumber: 1,
        validFrom: new Date('2026-09-01'),
      },
    });
    const inSchedule = await mod<{ code: string }>('DELETE', `/loads/${created.body.id}`);
    expect(inSchedule.body.code).toBe('LOAD_IN_SCHEDULE');

    await prisma.scheduleSlot.deleteMany({ where: { scheduleId: sched } });
    expect((await mod('DELETE', `/loads/${created.body.id}`)).status).toBe(204);
    expect((await mod('GET', `/loads/${created.body.id}`)).status).toBe(404);
  });

  it('закритий семестр: навантаження не створюється', async () => {
    await mod('POST', `/semesters/${ids.semesterId}/activate`);
    await mod('POST', `/semesters/${ids.semesterId}/close`);
    const res = await mod<{ code: string }>(
      'POST',
      '/loads',
      payload({ kind: 'SEMINAR', plannedHours: 2 }),
    );
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SEMESTER_CLOSED');
  });

  it('чужий коледж не бачить навантаження', async () => {
    expect(
      (await otherMod<Page<LoadDto>>('GET', `/loads?semesterId=${ids.semesterId}`)).body.items,
    ).toHaveLength(0);
  });
});
