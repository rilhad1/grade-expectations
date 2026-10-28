import type {
  AcademicYearDto,
  CohortDto,
  EnrollmentDto,
  GroupDetailDto,
  GroupDto,
  ImportStudentsResult,
  PromoteGroupsResult,
  StudentDto,
  SubgroupDto,
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
let year1: AcademicYearDto;
let year2: AcademicYearDto;
let cohort: CohortDto;
let group: GroupDto;

type Page<T> = { items: T[]; nextCursor: string | null };

beforeAll(async () => {
  app = await buildTestApp();
  const org = await createOrganization(prisma, 'grp', { mod: ['MODERATOR'], teacher: ['TEACHER'] });
  const other = await createOrganization(prisma, 'grp-other', { mod: ['MODERATOR'] });
  orgs = [org.organizationId, other.organizationId];
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  otherMod = client(app, await login(app, other.users['mod']?.email ?? ''));

  year1 = (
    await mod<AcademicYearDto>('POST', '/academic-years', {
      title: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
    })
  ).body;
  year2 = (
    await mod<AcademicYearDto>('POST', '/academic-years', {
      title: '2027/2028',
      startDate: '2027-09-01',
      endDate: '2028-06-30',
    })
  ).body;
  cohort = (
    await mod<CohortDto>('POST', '/cohorts', {
      specialty: 'Програмне забезпечення',
      entryYear: 2026,
    })
  ).body;
  group = (
    await mod<GroupDto>('POST', '/groups', {
      cohortId: cohort.id,
      academicYearId: year1.id,
      name: 'ПДт-11',
      course: 1,
    })
  ).body;
});

afterAll(async () => {
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
});

describe('групи', () => {
  it('створення: унікальна назва в році, потік і рік мають належати коледжу', async () => {
    expect(group.studentCount).toBe(0);
    expect(
      (
        await mod('POST', '/groups', {
          cohortId: cohort.id,
          academicYearId: year1.id,
          name: 'ПДт-11',
          course: 1,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await otherMod('POST', '/groups', {
          cohortId: cohort.id,
          academicYearId: year1.id,
          name: 'X-11',
          course: 1,
        })
      ).status,
    ).toBe(404);
  });

  it('список з фільтром за роком; викладач читає, але не змінює', async () => {
    const list = await teacher<Page<GroupDto>>('GET', `/groups?academicYearId=${year1.id}`);
    expect(list.body.items.map((g) => g.name)).toEqual(['ПДт-11']);
    expect(
      (await teacher<Page<GroupDto>>('GET', `/groups?academicYearId=${year2.id}`)).body.items,
    ).toHaveLength(0);
    expect((await teacher('PATCH', `/groups/${group.id}`, { name: 'x', version: 0 })).status).toBe(
      403,
    );
  });

  it('оновлення за версією', async () => {
    const res = await mod<GroupDto>('PATCH', `/groups/${group.id}`, {
      name: 'ПДт-11а',
      version: group.version,
    });
    expect(res.body.name).toBe('ПДт-11а');
    group = res.body;
    expect((await mod('PATCH', `/groups/${group.id}`, { name: 'x', version: 0 })).status).toBe(409);
  });

  it('чужа група недоступна', async () => {
    expect((await otherMod('GET', `/groups/${group.id}`)).status).toBe(404);
  });
});

describe('студенти й зарахування', () => {
  it('створення з одночасним зарахуванням у групу', async () => {
    const res = await mod<StudentDto>('POST', '/students', {
      lastName: 'Коваленко',
      firstName: 'Анна',
      groupId: group.id,
      fromDate: '2026-09-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.enrollments).toMatchObject([
      { groupId: group.id, groupName: 'ПДт-11а', status: 'ACTIVE' },
    ]);
    const detail = await mod<GroupDetailDto>('GET', `/groups/${group.id}`);
    expect(detail.body.studentCount).toBe(1);
    expect(detail.body.enrollments[0]?.student.lastName).toBe('Коваленко');
  });

  it('студент без групи; пошук і фільтр за групою', async () => {
    await mod('POST', '/students', { lastName: 'Мельник', firstName: 'Остап' });
    const byQuery = await mod<Page<StudentDto>>('GET', '/students?q=мель');
    expect(byQuery.body.items.map((s) => s.lastName)).toEqual(['Мельник']);
    const byGroup = await mod<Page<StudentDto>>('GET', `/students?groupId=${group.id}`);
    expect(byGroup.body.items.map((s) => s.lastName)).toEqual(['Коваленко']);
  });

  it('зарахування: дублікат студента в групі → 409; зміна статусу відраховує зі складу', async () => {
    const all = await mod<Page<StudentDto>>('GET', '/students');
    const mel = all.body.items.find((s) => s.lastName === 'Мельник');
    const enr = await mod<EnrollmentDto>('POST', '/enrollments', {
      studentId: mel?.id,
      groupId: group.id,
      fromDate: '2026-09-01',
    });
    expect(enr.status).toBe(201);
    expect(
      (
        await mod('POST', '/enrollments', {
          studentId: mel?.id,
          groupId: group.id,
          fromDate: '2026-09-01',
        })
      ).status,
    ).toBe(409);

    const left = await mod<EnrollmentDto>('PATCH', `/enrollments/${enr.body.id}`, {
      status: 'EXPELLED',
      toDate: '2026-11-01',
      version: enr.body.version,
    });
    expect(left.body).toMatchObject({ status: 'EXPELLED', toDate: '2026-11-01' });
    expect((await mod<GroupDetailDto>('GET', `/groups/${group.id}`)).body.studentCount).toBe(1);
  });

  it('чужий студент недоступний', async () => {
    const all = await mod<Page<StudentDto>>('GET', '/students');
    const id = all.body.items[0]?.id;
    expect((await otherMod('PATCH', `/students/${id}`, { note: 'злам', version: 0 })).status).toBe(
      404,
    );
    expect((await otherMod<Page<StudentDto>>('GET', '/students')).body.items).toHaveLength(0);
    expect((await teacher('POST', '/students', { lastName: 'x', firstName: 'y' })).status).toBe(
      403,
    );
  });

  it('видалення студента — м’яке', async () => {
    const created = await mod<StudentDto>('POST', '/students', {
      lastName: 'Видалений',
      firstName: 'Тест',
    });
    expect((await mod('DELETE', `/students/${created.body.id}`)).status).toBe(204);
    const list = await mod<Page<StudentDto>>('GET', '/students?q=видал');
    expect(list.body.items).toHaveLength(0);
  });

  it('видалення студента прибирає його зарахування з групи', async () => {
    const created = await mod<StudentDto>('POST', '/students', {
      lastName: 'Зниклий',
      firstName: 'Зі Складу',
    });
    await mod('POST', '/enrollments', {
      studentId: created.body.id,
      groupId: group.id,
      fromDate: '2026-09-01',
    });
    const before = (await mod<GroupDetailDto>('GET', `/groups/${group.id}`)).body;
    expect(before.enrollments.some((e) => e.student.id === created.body.id)).toBe(true);
    expect((await mod('DELETE', `/students/${created.body.id}`)).status).toBe(204);
    const after = (await mod<GroupDetailDto>('GET', `/groups/${group.id}`)).body;
    expect(after.enrollments.some((e) => e.student.id === created.body.id)).toBe(false);
    expect(after.studentCount).toBe(before.studentCount - 1);
  });
});

describe('імпорт студентів', () => {
  let importGroup: GroupDto;
  beforeAll(async () => {
    importGroup = (
      await mod<GroupDto>('POST', '/groups', {
        cohortId: cohort.id,
        academicYearId: year1.id,
        name: 'ПДт-12',
        course: 1,
      })
    ).body;
  });

  const text =
    'Прізвище;Ім’я;По батькові\n1. Ткачук Ірина Олегівна\n2. Бондар Максим\n3. ткачук ірина олегівна';

  it('dryRun показує розібрані рядки та дублікати й нічого не створює', async () => {
    const res = await mod<ImportStudentsResult>('POST', '/students/import', {
      groupId: importGroup.id,
      fromDate: '2026-09-01',
      text,
    });
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.created).toBe(0);
    expect(res.body.rows.map((r) => [r.lastName, r.duplicate])).toEqual([
      ['Ткачук', false],
      ['Бондар', false],
      ['Ткачук', true],
    ]);
    expect((await mod<GroupDetailDto>('GET', `/groups/${importGroup.id}`)).body.studentCount).toBe(
      0,
    );
  });

  it('помилки розбору блокують запис (422), але видно у dryRun', async () => {
    const bad = 'Коваленко Анна\nМельник';
    const preview = await mod<ImportStudentsResult>('POST', '/students/import', {
      groupId: importGroup.id,
      fromDate: '2026-09-01',
      text: bad,
    });
    expect(preview.body.errors).toEqual([
      { line: 2, text: 'Мельник', code: 'NEED_LAST_AND_FIRST_NAME' },
    ]);
    const commit = await mod<{ code: string }>('POST', '/students/import', {
      groupId: importGroup.id,
      fromDate: '2026-09-01',
      text: bad,
      dryRun: false,
    });
    expect(commit.status).toBe(422);
    expect(commit.body.code).toBe('IMPORT_HAS_ERRORS');
  });

  it('commit створює студентів і зарахування без дублікатів; повтор нічого не додає', async () => {
    const res = await mod<ImportStudentsResult>('POST', '/students/import', {
      groupId: importGroup.id,
      fromDate: '2026-09-01',
      dryRun: false,
      text,
    });
    expect(res.body.created).toBe(2);
    expect((await mod<GroupDetailDto>('GET', `/groups/${importGroup.id}`)).body.studentCount).toBe(
      2,
    );
    const again = await mod<ImportStudentsResult>('POST', '/students/import', {
      groupId: importGroup.id,
      fromDate: '2026-09-01',
      dryRun: false,
      text,
    });
    expect(again.body.created).toBe(0);
  });

  it('приймає вже розібрані рядки (Excel на клієнті)', async () => {
    const res = await mod<ImportStudentsResult>('POST', '/students/import', {
      groupId: importGroup.id,
      fromDate: '2026-09-01',
      dryRun: false,
      rows: [{ lastName: 'Савчук', firstName: 'Олена' }],
    });
    expect(res.body.created).toBe(1);
  });

  it('вимагає text або rows; чужа група → 404; викладачу заборонено', async () => {
    expect(
      (await mod('POST', '/students/import', { groupId: importGroup.id, fromDate: '2026-09-01' }))
        .status,
    ).toBe(400);
    expect(
      (
        await otherMod('POST', '/students/import', {
          groupId: importGroup.id,
          fromDate: '2026-09-01',
          text,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await teacher('POST', '/students/import', {
          groupId: importGroup.id,
          fromDate: '2026-09-01',
          text,
        })
      ).status,
    ).toBe(403);
  });
});

describe('підгрупи', () => {
  it('склад підгруп замінюється, чужі зарахування відхиляються', async () => {
    const detail = await mod<GroupDetailDto>('GET', `/groups/${group.id}`);
    const enrollmentIds = detail.body.enrollments
      .filter((e) => e.status === 'ACTIVE')
      .map((e) => e.id);
    const other = (
      await mod<GroupDto>('POST', '/groups', {
        cohortId: cohort.id,
        academicYearId: year1.id,
        name: 'ПДт-13',
        course: 1,
      })
    ).body;
    const importedElsewhere = (
      await mod<StudentDto>('POST', '/students', {
        lastName: 'Інший',
        firstName: 'Тест',
        groupId: other.id,
        fromDate: '2026-09-01',
      })
    ).body;
    const foreign = importedElsewhere.enrollments[0]?.id;

    const bad = await mod<{ code: string }>('POST', `/groups/${group.id}/subgroups`, {
      name: '1 підгрупа',
      enrollmentIds: [foreign],
    });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe('ENROLLMENT_NOT_IN_GROUP');

    const sub = await mod<SubgroupDto>('POST', `/groups/${group.id}/subgroups`, {
      name: '1 підгрупа',
      enrollmentIds,
    });
    expect(sub.status).toBe(201);
    expect(sub.body.enrollmentIds).toEqual(enrollmentIds);
    const emptied = await mod<SubgroupDto>('PATCH', `/subgroups/${sub.body.id}`, {
      enrollmentIds: [],
      version: sub.body.version,
    });
    expect(emptied.body.enrollmentIds).toEqual([]);
    expect((await mod<GroupDetailDto>('GET', `/groups/${group.id}`)).body.subgroups).toHaveLength(
      1,
    );
    expect((await mod('DELETE', `/subgroups/${sub.body.id}`)).status).toBe(204);
  });
});

describe('переведення груп на наступний курс', () => {
  it('нова група з тими самими студентами, підгрупами та закриттям старих зарахувань', async () => {
    const src = (
      await mod<GroupDto>('POST', '/groups', {
        cohortId: cohort.id,
        academicYearId: year1.id,
        name: 'ІПЗ-21',
        course: 2,
      })
    ).body;
    const students: StudentDto[] = [];
    for (const [lastName, firstName] of [
      ['Один', 'А'],
      ['Два', 'Б'],
      ['Три', 'В'],
    ]) {
      students.push(
        (
          await mod<StudentDto>('POST', '/students', {
            lastName,
            firstName,
            groupId: src.id,
            fromDate: '2026-09-01',
          })
        ).body,
      );
    }
    const detail = await mod<GroupDetailDto>('GET', `/groups/${src.id}`);
    const byName = (n: string) =>
      detail.body.enrollments.find((e) => e.student.lastName === n)?.id ?? '';
    await mod('POST', `/groups/${src.id}/subgroups`, {
      name: '1 підгрупа',
      enrollmentIds: [byName('Один'), byName('Два')],
    });

    const res = await mod<PromoteGroupsResult>('POST', '/groups/promote', {
      toAcademicYearId: year2.id,
      groups: [{ groupId: src.id, excludeStudentIds: [students[2]?.id] }],
    });
    expect(res.status).toBe(200);
    expect(res.body.promoted).toMatchObject([{ fromGroupId: src.id, name: 'ІПЗ-31', students: 2 }]);

    const next = await mod<GroupDetailDto>('GET', `/groups/${res.body.promoted[0]?.toGroupId}`);
    expect(next.body).toMatchObject({ course: 3, academicYearId: year2.id, studentCount: 2 });
    expect(next.body.enrollments.map((e) => e.student.lastName).sort()).toEqual(['Два', 'Один']);
    expect(next.body.subgroups).toHaveLength(1);
    expect(next.body.subgroups[0]?.enrollmentIds).toHaveLength(2);

    // старе зарахування закрито датою завершення року, відрахований студент не рухався
    const old = await mod<GroupDetailDto>('GET', `/groups/${src.id}`);
    expect(old.body.enrollments.find((e) => e.student.lastName === 'Один')?.toDate).toBe(
      '2027-06-30',
    );
    expect(old.body.enrollments.find((e) => e.student.lastName === 'Три')?.toDate).toBeNull();

    // повторне переведення пропускається
    const again = await mod<PromoteGroupsResult>('POST', '/groups/promote', {
      toAcademicYearId: year2.id,
      groups: [{ groupId: src.id }],
    });
    expect(again.body.skipped).toEqual([{ groupId: src.id, reason: 'ALREADY_PROMOTED' }]);
  });

  it('назва без шаблону потребує newName; з newName переводиться', async () => {
    const odd = (
      await mod<GroupDto>('POST', '/groups', {
        cohortId: cohort.id,
        academicYearId: year1.id,
        name: 'Особлива',
        course: 1,
      })
    ).body;
    const cohort2 = (
      await mod<CohortDto>('POST', '/cohorts', { specialty: 'Інша', entryYear: 2020 })
    ).body;
    await prisma.group.update({ where: { id: odd.id }, data: { cohortId: cohort2.id } });
    const skipped = await mod<PromoteGroupsResult>('POST', '/groups/promote', {
      toAcademicYearId: year2.id,
      groups: [{ groupId: odd.id }],
    });
    expect(skipped.body.skipped).toEqual([{ groupId: odd.id, reason: 'NAME_NOT_PROMOTABLE' }]);
    const done = await mod<PromoteGroupsResult>('POST', '/groups/promote', {
      toAcademicYearId: year2.id,
      groups: [{ groupId: odd.id, newName: 'Особлива-2' }],
    });
    expect(done.body.promoted[0]?.name).toBe('Особлива-2');
  });

  it('викладачу переведення заборонене, чужа група → 404', async () => {
    expect(
      (
        await teacher('POST', '/groups/promote', {
          toAcademicYearId: year2.id,
          groups: [{ groupId: group.id }],
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await otherMod('POST', '/groups/promote', {
          toAcademicYearId: year2.id,
          groups: [{ groupId: group.id }],
        })
      ).status,
    ).toBe(404);
  });
});

describe('видалення групи', () => {
  it('група з навантаженням не видаляється', async () => {
    const g = (
      await mod<GroupDto>('POST', '/groups', {
        cohortId: cohort.id,
        academicYearId: year1.id,
        name: 'ЗАЙНЯТА-11',
        course: 1,
      })
    ).body;
    const semId = crypto.randomUUID();
    await prisma.semester.create({
      data: {
        id: semId,
        academicYearId: year1.id,
        number: 1,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-12-28'),
        firstWeekParity: 'TOP',
      },
    });
    const disc = crypto.randomUUID();
    const org = await prisma.academicYear.findUnique({ where: { id: year1.id } });
    await prisma.discipline.create({
      data: {
        id: disc,
        organizationId: org?.organizationId ?? '',
        title: 'Д',
        shortTitle: 'Д',
        color: '#000000',
      },
    });
    const teacherRow = await prisma.membership.findFirst({
      where: { organizationId: org?.organizationId ?? '', roles: { has: 'TEACHER' } },
    });
    await prisma.teachingLoad.create({
      data: {
        id: crypto.randomUUID(),
        semesterId: semId,
        disciplineId: disc,
        groupId: g.id,
        teacherId: teacherRow?.userId ?? '',
        kind: 'LECTURE',
        plannedHours: 32,
        controlForm: 'EXAM',
        gradingRules: {},
      },
    });
    const res = await mod<{ code: string }>('DELETE', `/groups/${g.id}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('GROUP_HAS_LOADS');
  });

  it('порожня група видаляється м’яко', async () => {
    const g = (
      await mod<GroupDto>('POST', '/groups', {
        cohortId: cohort.id,
        academicYearId: year1.id,
        name: 'ПОРОЖНЯ-11',
        course: 1,
      })
    ).body;
    expect((await mod('DELETE', `/groups/${g.id}`)).status).toBe(204);
    expect((await mod('GET', `/groups/${g.id}`)).status).toBe(404);
  });
});
