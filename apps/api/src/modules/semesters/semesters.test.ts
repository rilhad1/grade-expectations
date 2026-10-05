import {
  uuidv7,
  type SemesterFullDto,
  type AcademicYearDto,
  type CloneSemesterResult,
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
let otherOrgId = '';
let mod: ReturnType<typeof client>;
let teacher: ReturnType<typeof client>;
let otherMod: ReturnType<typeof client>;
let teacherId = '';
let year: AcademicYearDto;

const period = (kind: string, startDate: string, endDate: string) => ({ kind, startDate, endDate });
const semesterPayload = (academicYearId: string, over: object = {}) => ({
  academicYearId,
  number: 1,
  startDate: '2026-09-01',
  endDate: '2026-12-28',
  firstWeekParity: 'TOP',
  periods: [period('HOLIDAY', '2026-10-26', '2026-11-01')],
  ...over,
});

beforeAll(async () => {
  app = await buildTestApp();
  const org = await createOrganization(prisma, 'sem', { mod: ['MODERATOR'], teacher: ['TEACHER'] });
  const other = await createOrganization(prisma, 'sem-other', { mod: ['MODERATOR'] });
  orgId = org.organizationId;
  otherOrgId = other.organizationId;
  teacherId = org.users['teacher']?.id ?? '';
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  otherMod = client(app, await login(app, other.users['mod']?.email ?? ''));

  const created = await mod<AcademicYearDto>('POST', '/academic-years', {
    title: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
  });
  year = created.body;
});

afterAll(async () => {
  await deleteOrganization(prisma, orgId);
  await deleteOrganization(prisma, otherOrgId);
  await prisma.$disconnect();
  await app.close();
});

describe('навчальні роки', () => {
  it('модератор створює рік; id може задати клієнт', async () => {
    const id = uuidv7();
    const res = await mod<AcademicYearDto>('POST', '/academic-years', {
      id,
      title: '2027/2028',
      startDate: '2027-09-01',
      endDate: '2028-06-30',
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(id);
    expect(res.body.version).toBe(0);
  });

  it('викладач бачить роки, але не створює (403 problem+json)', async () => {
    expect((await teacher('GET', '/academic-years')).status).toBe(200);
    const res = await teacher('POST', '/academic-years', {
      title: 'x',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
    });
    expect(res.status).toBe(403);
    expect(res.contentType).toContain('application/problem+json');
  });

  it('некоректний діапазон дат → 400', async () => {
    const res = await mod('POST', '/academic-years', {
      title: 'x',
      startDate: '2027-01-01',
      endDate: '2026-01-01',
    });
    expect(res.status).toBe(400);
  });

  it('оновлення з правильною версією збільшує version, із застарілою → 409', async () => {
    const ok = await mod<AcademicYearDto>('PATCH', `/academic-years/${year.id}`, {
      title: '2026–2027',
      version: year.version,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.version).toBe(year.version + 1);
    const stale = await mod<{ code: string }>('PATCH', `/academic-years/${year.id}`, {
      title: 'ще раз',
      version: year.version,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
    year = ok.body;
  });

  it('пагінація курсором', async () => {
    const first = await mod<{ items: AcademicYearDto[]; nextCursor: string | null }>(
      'GET',
      '/academic-years?limit=1',
    );
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toBe(first.body.items[0]?.id);
    const second = await mod<{ items: AcademicYearDto[] }>(
      'GET',
      `/academic-years?limit=1&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.items[0]?.id).not.toBe(first.body.items[0]?.id);
  });

  it('чужий коледж не бачить і не змінює рік (404)', async () => {
    expect(
      (await otherMod<{ items: unknown[] }>('GET', '/academic-years')).body.items,
    ).toHaveLength(0);
    const res = await otherMod('PATCH', `/academic-years/${year.id}`, {
      title: 'злам',
      version: year.version,
    });
    expect(res.status).toBe(404);
  });
});

describe('семестри', () => {
  let semester: SemesterFullDto;

  it('створення з періодами; відповідь містить періоди у порядку дат', async () => {
    const res = await mod<SemesterFullDto>(
      'POST',
      '/semesters',
      semesterPayload(year.id, {
        periods: [
          period('EXAM_SESSION', '2026-12-21', '2026-12-28'),
          period('HOLIDAY', '2026-10-26', '2026-11-01'),
        ],
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.periods.map((p) => p.kind)).toEqual(['HOLIDAY', 'EXAM_SESSION']);
    semester = res.body;
  });

  it('другий семестр з тим самим номером у році → 409', async () => {
    const res = await mod<{ code: string }>('POST', '/semesters', semesterPayload(year.id));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE');
  });

  it('період поза межами семестру → 422', async () => {
    const res = await mod<{ code: string }>(
      'POST',
      '/semesters',
      semesterPayload(year.id, {
        number: 2,
        periods: [period('HOLIDAY', '2026-08-01', '2026-08-10')],
      }),
    );
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PERIOD_OUT_OF_RANGE');
  });

  it('рік іншого коледжу → 404', async () => {
    const res = await otherMod('POST', '/semesters', semesterPayload(year.id, { number: 2 }));
    expect(res.status).toBe(404);
  });

  it('оновлення замінює набір періодів і піднімає версію', async () => {
    const res = await mod<SemesterFullDto>('PATCH', `/semesters/${semester.id}`, {
      version: semester.version,
      firstWeekParity: 'BOTTOM',
      periods: [period('DAY_OFF', '2026-10-14', '2026-10-14')],
    });
    expect(res.status).toBe(200);
    expect(res.body.firstWeekParity).toBe('BOTTOM');
    expect(res.body.periods).toHaveLength(1);
    expect(res.body.version).toBe(semester.version + 1);
    semester = res.body;
  });

  it('застаріла версія → 409', async () => {
    const res = await mod('PATCH', `/semesters/${semester.id}`, {
      version: 0,
      firstWeekParity: 'TOP',
    });
    expect(res.status).toBe(409);
  });

  it('викладач бачить семестр, але не змінює', async () => {
    expect((await teacher('GET', `/semesters/${semester.id}`)).status).toBe(200);
    expect(
      (await teacher('PATCH', `/semesters/${semester.id}`, { version: semester.version })).status,
    ).toBe(403);
  });

  it('чужий коледж не бачить семестр', async () => {
    expect((await otherMod('GET', `/semesters/${semester.id}`)).status).toBe(404);
    expect((await otherMod<unknown[]>('GET', '/semesters')).body).toHaveLength(0);
  });

  it('життєвий цикл: активація → закриття, лише один активний', async () => {
    const second = await mod<SemesterFullDto>(
      'POST',
      '/semesters',
      semesterPayload(year.id, {
        number: 2,
        startDate: '2027-02-01',
        endDate: '2027-06-20',
        periods: [],
      }),
    );

    expect(
      (await mod<SemesterFullDto>('POST', `/semesters/${semester.id}/activate`)).body.status,
    ).toBe('ACTIVE');

    const second1 = await mod<{ code: string }>('POST', `/semesters/${second.body.id}/activate`);
    expect(second1.status).toBe(409);
    expect(second1.body.code).toBe('ACTIVE_SEMESTER_EXISTS');

    expect((await mod('POST', `/semesters/${second.body.id}/close`)).status).toBe(409); // чернетку закрити не можна

    expect(
      (await mod<SemesterFullDto>('POST', `/semesters/${semester.id}/close`)).body.status,
    ).toBe('CLOSED');

    const edit = await mod<{ code: string }>('PATCH', `/semesters/${semester.id}`, {
      version: 99,
      firstWeekParity: 'TOP',
    });
    expect(edit.status).toBe(409);
    expect(edit.body.code).toBe('SEMESTER_CLOSED');
    expect((await mod('POST', `/semesters/${semester.id}/activate`)).status).toBe(409);

    // після закриття можна активувати наступний
    expect(
      (await mod<SemesterFullDto>('POST', `/semesters/${second.body.id}/activate`)).body.status,
    ).toBe('ACTIVE');
    const list = await mod<SemesterFullDto[]>('GET', `/semesters?status=ACTIVE`);
    expect(list.body.map((s) => s.id)).toEqual([second.body.id]);
  });
});

describe('копіювання семестру (майстер «Новий семестр»)', () => {
  it('копіює навантаження в групи нового року через потік і створює чернетку розкладу', async () => {
    // Сид-дані: минулий рік, група ПДт-11, навантаження і слот; новий рік, група ПДт-21 того ж потоку
    const oldYearId = uuidv7();
    const newYearId = uuidv7();
    const oldSem = uuidv7();
    const newSem = uuidv7();
    const cohortId = uuidv7();
    const oldGroup = uuidv7();
    const newGroup = uuidv7();
    const orphanGroup = uuidv7();
    const disciplineId = uuidv7();
    const loadOk = uuidv7();
    const loadOrphan = uuidv7();
    const scheduleId = uuidv7();

    await prisma.academicYear.createMany({
      data: [
        {
          id: oldYearId,
          organizationId: orgId,
          title: '2025/2026',
          startDate: new Date('2025-09-01'),
          endDate: new Date('2026-06-30'),
        },
        {
          id: newYearId,
          organizationId: orgId,
          title: '2027/2028 (копія)',
          startDate: new Date('2027-09-01'),
          endDate: new Date('2028-06-30'),
        },
      ],
    });
    await prisma.semester.createMany({
      data: [
        {
          id: oldSem,
          academicYearId: oldYearId,
          number: 1,
          startDate: new Date('2025-09-01'),
          endDate: new Date('2025-12-28'),
          firstWeekParity: 'TOP',
          status: 'CLOSED',
        },
        {
          id: newSem,
          academicYearId: newYearId,
          number: 1,
          startDate: new Date('2027-09-01'),
          endDate: new Date('2027-12-28'),
          firstWeekParity: 'TOP',
        },
      ],
    });
    await prisma.cohort.create({
      data: { id: cohortId, organizationId: orgId, specialty: 'ПЗ', entryYear: 2025 },
    });
    const orphanCohort = uuidv7();
    await prisma.cohort.create({
      data: { id: orphanCohort, organizationId: orgId, specialty: 'ПЗ-2', entryYear: 2022 },
    });
    await prisma.group.createMany({
      data: [
        { id: oldGroup, cohortId, academicYearId: oldYearId, name: 'ПДт-11', course: 1 },
        { id: newGroup, cohortId, academicYearId: newYearId, name: 'ПДт-21', course: 2 },
        {
          id: orphanGroup,
          cohortId: orphanCohort,
          academicYearId: oldYearId,
          name: 'ІПЗ-41',
          course: 4,
        }, // випускна: не переводиться
      ],
    });
    await prisma.discipline.create({
      data: {
        id: disciplineId,
        organizationId: orgId,
        title: 'Інформатика',
        shortTitle: 'Інф',
        color: '#000',
      },
    });
    const rules = { scale: 'TWELVE' };
    await prisma.teachingLoad.createMany({
      data: [
        {
          id: loadOk,
          semesterId: oldSem,
          disciplineId,
          groupId: oldGroup,
          teacherId,
          kind: 'LECTURE',
          plannedHours: 32,
          controlForm: 'EXAM',
          gradingRules: rules,
        },
        {
          id: loadOrphan,
          semesterId: oldSem,
          disciplineId,
          groupId: orphanGroup,
          teacherId,
          kind: 'LECTURE',
          plannedHours: 16,
          controlForm: 'CREDIT',
          gradingRules: rules,
        },
      ],
    });
    await prisma.schedule.create({
      data: { id: scheduleId, semesterId: oldSem, revision: 1, status: 'PUBLISHED' },
    });
    await prisma.scheduleSlot.createMany({
      data: [
        {
          id: uuidv7(),
          scheduleId,
          loadId: loadOk,
          weekday: 1,
          pairNumber: 2,
          parity: 'EVERY',
          validFrom: new Date('2025-09-01'),
        },
        {
          id: uuidv7(),
          scheduleId,
          loadId: loadOrphan,
          weekday: 2,
          pairNumber: 1,
          parity: 'TOP',
          validFrom: new Date('2025-09-01'),
        },
      ],
    });

    const res = await mod<CloneSemesterResult>('POST', `/semesters/${newSem}/clone-from/${oldSem}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ copiedLoads: 1, copiedSlots: 1 });
    expect(res.body.skipped).toEqual([{ sourceLoadId: loadOrphan, reason: 'GROUP_NOT_PROMOTED' }]);

    const copied = await prisma.teachingLoad.findMany({ where: { semesterId: newSem } });
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({
      groupId: newGroup,
      teacherId,
      plannedHours: 32,
      controlForm: 'EXAM',
    });

    const schedule = await prisma.schedule.findFirst({
      where: { semesterId: newSem },
      include: { slots: true },
    });
    expect(schedule?.status).toBe('DRAFT');
    expect(schedule?.slots).toHaveLength(1);
    expect(schedule?.slots[0]?.validFrom.toISOString().slice(0, 10)).toBe('2027-09-01');

    // повторне копіювання заборонено: у семестрі вже є навантаження
    const again = await mod<{ code: string }>('POST', `/semesters/${newSem}/clone-from/${oldSem}`);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('SEMESTER_NOT_EMPTY');
  });

  it('копіювати сам у себе чи в не-чернетку не можна', async () => {
    const some = await mod<SemesterFullDto[]>('GET', '/semesters');
    const id = some.body[0]?.id ?? '';
    expect((await mod('POST', `/semesters/${id}/clone-from/${id}`)).status).toBe(422);
    const closed = some.body.find((s) => s.status === 'CLOSED');
    const draftTarget = closed?.id ?? '';
    expect(
      (await mod<{ code: string }>('POST', `/semesters/${draftTarget}/clone-from/${id}`)).status,
    ).toBe(409);
  });

  it('викладач не може копіювати', async () => {
    const some = await mod<SemesterFullDto[]>('GET', '/semesters');
    const [a, b] = some.body;
    expect((await teacher('POST', `/semesters/${a?.id}/clone-from/${b?.id}`)).status).toBe(403);
  });
});
