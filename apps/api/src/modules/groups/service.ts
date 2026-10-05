import { parseStudentList, promoteGroupName } from '@ge/domain';
import {
  uuidv7,
  type CreateEnrollmentInput,
  type CreateGroupInput,
  type CreateStudentInput,
  type CreateSubgroupInput,
  type EnrollmentDto,
  type GroupDetailDto,
  type GroupDto,
  type ImportStudentsInput,
  type ImportStudentsResult,
  type PromoteGroupsInput,
  type PromoteGroupsResult,
  type StudentDto,
  type SubgroupDto,
  type UpdateEnrollmentInput,
  type UpdateGroupInput,
  type UpdateStudentInput,
  type UpdateSubgroupInput,
} from '@ge/shared';
import type { Prisma } from '@prisma/client';

import { conflict, notFound, unprocessable } from '../../errors.js';
import {
  dateOf,
  definedOnly,
  isoOf,
  isoOrNull,
  newId,
  pageArgs,
  toPage,
  versionedUpdate,
} from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';

const groupScope = (organizationId: string) =>
  ({ cohort: { organizationId }, deletedAt: null }) satisfies Prisma.GroupWhereInput;
const studentScope = { deletedAt: null } satisfies Prisma.StudentWhereInput;
const activeCount = {
  _count: { select: { enrollments: { where: { deletedAt: null, status: 'ACTIVE' as const } } } },
};

type GroupWithCount = Prisma.GroupGetPayload<{ include: typeof activeCount }>;
const groupDto = (g: GroupWithCount): GroupDto => ({
  id: g.id,
  cohortId: g.cohortId,
  academicYearId: g.academicYearId,
  name: g.name,
  course: g.course,
  studentCount: g._count.enrollments,
  version: g.version,
});

// ── Групи ────────────────────────────────────────────
export async function listGroups(
  ctx: AuthContext,
  filter: { academicYearId?: string | undefined; cursor?: string | undefined; limit: number },
) {
  const rows = await ctx.db.group.findMany({
    where: {
      ...groupScope(ctx.organization.id),
      ...(filter.academicYearId !== undefined && { academicYearId: filter.academicYearId }),
    },
    include: activeCount,
    ...pageArgs(filter.cursor, filter.limit),
  });
  const page = toPage(rows, filter.limit);
  return { items: page.items.map(groupDto), nextCursor: page.nextCursor };
}

async function loadGroupDto(ctx: AuthContext, id: string): Promise<GroupDto | null> {
  const row = await ctx.db.group.findFirst({
    where: { id, ...groupScope(ctx.organization.id) },
    include: activeCount,
  });
  return row ? groupDto(row) : null;
}

export async function getGroup(ctx: AuthContext, id: string): Promise<GroupDetailDto> {
  const row = await ctx.db.group.findFirst({
    where: { id, ...groupScope(ctx.organization.id) },
    include: {
      ...activeCount,
      enrollments: {
        where: { deletedAt: null },
        include: { student: true },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      },
      subgroups: {
        where: { deletedAt: null },
        include: { members: { where: { deletedAt: null } } },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!row) throw notFound('Групу не знайдено');
  return {
    ...groupDto(row),
    enrollments: row.enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      fromDate: isoOf(e.fromDate),
      toDate: isoOrNull(e.toDate),
      version: e.version,
      student: {
        id: e.student.id,
        lastName: e.student.lastName,
        firstName: e.student.firstName,
        middleName: e.student.middleName,
        version: e.student.version,
      },
    })),
    subgroups: row.subgroups.map((s) => ({
      id: s.id,
      groupId: s.groupId,
      name: s.name,
      enrollmentIds: s.members.map((m) => m.enrollmentId),
      version: s.version,
    })),
  };
}

export async function createGroup(ctx: AuthContext, input: CreateGroupInput): Promise<GroupDto> {
  const { id, ...data } = input;
  const cohort = await ctx.db.cohort.findFirst({ where: { id: data.cohortId, deletedAt: null } });
  const year = await ctx.db.academicYear.findFirst({
    where: { id: data.academicYearId, deletedAt: null },
  });
  if (!cohort || !year) throw notFound('Потік або навчальний рік не знайдено');
  const groupId = newId(id);
  await ctx.db.group.create({ data: { ...data, id: groupId } });
  const dto = await loadGroupDto(ctx, groupId);
  if (!dto) throw notFound('Групу не знайдено');
  return dto;
}

export async function updateGroup(
  ctx: AuthContext,
  id: string,
  input: UpdateGroupInput,
): Promise<GroupDto> {
  const { version, ...data } = input;
  return versionedUpdate({
    update: () =>
      ctx.db.group.updateMany({
        where: { id, version, ...groupScope(ctx.organization.id) },
        data: { ...definedOnly(data), version: { increment: 1 } },
      }),
    load: () => loadGroupDto(ctx, id),
    what: 'Групу',
  });
}

export async function deleteGroup(ctx: AuthContext, id: string): Promise<void> {
  const loads = await ctx.db.teachingLoad.count({ where: { groupId: id, deletedAt: null } });
  if (loads > 0) throw conflict('GROUP_HAS_LOADS', 'У групи є навантаження; спершу приберіть їх');
  const { count } = await ctx.db.group.updateMany({
    where: { id, ...groupScope(ctx.organization.id) },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
  if (count === 0) throw notFound('Групу не знайдено');
}

// ── Підгрупи ─────────────────────────────────────────
async function requireGroup(ctx: AuthContext, id: string) {
  const group = await ctx.db.group.findFirst({ where: { id, ...groupScope(ctx.organization.id) } });
  if (!group) throw notFound('Групу не знайдено');
  return group;
}

async function assertEnrollmentsInGroup(ctx: AuthContext, groupId: string, ids: readonly string[]) {
  if (ids.length === 0) return;
  const found = await ctx.db.enrollment.count({
    where: { id: { in: [...ids] }, groupId, deletedAt: null },
  });
  if (found !== new Set(ids).size) {
    throw unprocessable('ENROLLMENT_NOT_IN_GROUP', 'Студенти мають бути зараховані в цю групу');
  }
}

async function loadSubgroupDto(ctx: AuthContext, id: string): Promise<SubgroupDto | null> {
  const s = await ctx.db.subgroup.findFirst({
    where: { id, deletedAt: null, group: groupScope(ctx.organization.id) },
    include: { members: { where: { deletedAt: null } } },
  });
  return s
    ? {
        id: s.id,
        groupId: s.groupId,
        name: s.name,
        enrollmentIds: s.members.map((m) => m.enrollmentId),
        version: s.version,
      }
    : null;
}

export async function createSubgroup(
  ctx: AuthContext,
  groupId: string,
  input: CreateSubgroupInput,
): Promise<SubgroupDto> {
  await requireGroup(ctx, groupId);
  await assertEnrollmentsInGroup(ctx, groupId, input.enrollmentIds);
  const id = newId(input.id);
  await ctx.db.subgroup.create({
    data: {
      id,
      groupId,
      name: input.name,
      members: { create: input.enrollmentIds.map((enrollmentId) => ({ enrollmentId })) },
    },
  });
  const dto = await loadSubgroupDto(ctx, id);
  if (!dto) throw notFound('Підгрупу не знайдено');
  return dto;
}

export async function updateSubgroup(
  ctx: AuthContext,
  id: string,
  input: UpdateSubgroupInput,
): Promise<SubgroupDto> {
  const current = await loadSubgroupDto(ctx, id);
  if (!current) throw notFound('Підгрупу не знайдено');
  if (input.enrollmentIds)
    await assertEnrollmentsInGroup(ctx, current.groupId, input.enrollmentIds);

  await ctx.db.$transaction(async (tx) => {
    const { count } = await tx.subgroup.updateMany({
      where: { id, version: input.version, deletedAt: null },
      data: { ...(input.name !== undefined && { name: input.name }), version: { increment: 1 } },
    });
    if (count === 0)
      throw conflict('VERSION_CONFLICT', 'Підгрупу змінено на іншому пристрої; оновіть дані');
    if (input.enrollmentIds) {
      // Склад підгрупи замінюється повністю
      await tx.subgroupMember.deleteMany({ where: { subgroupId: id } });
      await tx.subgroupMember.createMany({
        data: [...new Set(input.enrollmentIds)].map((enrollmentId) => ({
          subgroupId: id,
          enrollmentId,
        })),
      });
    }
  });
  const dto = await loadSubgroupDto(ctx, id);
  if (!dto) throw notFound('Підгрупу не знайдено');
  return dto;
}

export async function deleteSubgroup(ctx: AuthContext, id: string): Promise<void> {
  const loads = await ctx.db.teachingLoad.count({ where: { subgroupId: id, deletedAt: null } });
  if (loads > 0)
    throw conflict('SUBGROUP_HAS_LOADS', 'У підгрупи є навантаження; спершу приберіть їх');
  const { count } = await ctx.db.subgroup.updateMany({
    where: { id, deletedAt: null, group: groupScope(ctx.organization.id) },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
  if (count === 0) throw notFound('Підгрупу не знайдено');
}

// ── Переведення на наступний курс ────────────────────
export async function promoteGroups(
  ctx: AuthContext,
  input: PromoteGroupsInput,
): Promise<PromoteGroupsResult> {
  const toYear = await ctx.db.academicYear.findFirst({
    where: { id: input.toAcademicYearId, deletedAt: null },
  });
  if (!toYear) throw notFound('Навчальний рік не знайдено');

  const result: PromoteGroupsResult = { promoted: [], skipped: [] };

  await ctx.db.$transaction(async (tx) => {
    for (const item of input.groups) {
      const source = await tx.group.findFirst({
        where: { id: item.groupId, ...groupScope(ctx.organization.id) },
        include: {
          academicYear: true,
          enrollments: { where: { deletedAt: null, status: 'ACTIVE' } },
          subgroups: {
            where: { deletedAt: null },
            include: { members: { where: { deletedAt: null } } },
          },
        },
      });
      if (!source) throw notFound('Групу не знайдено');

      const next = promoteGroupName(source.name);
      const name = item.newName ?? next?.name;
      if (name === undefined) {
        result.skipped.push({ groupId: source.id, reason: 'NAME_NOT_PROMOTABLE' });
        continue;
      }
      if (source.course >= 9) {
        result.skipped.push({ groupId: source.id, reason: 'LAST_COURSE' });
        continue;
      }
      const existing = await tx.group.findFirst({
        where: { cohortId: source.cohortId, academicYearId: toYear.id, deletedAt: null },
      });
      if (existing) {
        result.skipped.push({ groupId: source.id, reason: 'ALREADY_PROMOTED' });
        continue;
      }

      const newGroupId = uuidv7();
      await tx.group.create({
        data: {
          id: newGroupId,
          cohortId: source.cohortId,
          academicYearId: toYear.id,
          name,
          course: next?.course ?? source.course + 1,
        },
      });

      const excluded = new Set(item.excludeStudentIds);
      const moving = source.enrollments.filter((e) => !excluded.has(e.studentId));
      const enrollmentMap = new Map<string, string>();
      for (const e of moving) {
        const newEnrollmentId = uuidv7();
        enrollmentMap.set(e.id, newEnrollmentId);
        await tx.enrollment.create({
          data: {
            id: newEnrollmentId,
            studentId: e.studentId,
            groupId: newGroupId,
            status: 'ACTIVE',
            fromDate: toYear.startDate,
          },
        });
      }
      // Історія: попередні зарахування закриваються датою кінця старого року
      await tx.enrollment.updateMany({
        where: { id: { in: moving.map((e) => e.id) }, toDate: null },
        data: { toDate: source.academicYear.endDate, version: { increment: 1 } },
      });

      for (const sub of source.subgroups) {
        const newSubId = uuidv7();
        await tx.subgroup.create({
          data: {
            id: newSubId,
            groupId: newGroupId,
            name: sub.name,
            members: {
              create: sub.members.flatMap((m) => {
                const enrollmentId = enrollmentMap.get(m.enrollmentId);
                return enrollmentId ? [{ enrollmentId }] : [];
              }),
            },
          },
        });
      }
      result.promoted.push({
        fromGroupId: source.id,
        toGroupId: newGroupId,
        name,
        students: moving.length,
      });
    }
  });

  return result;
}

// ── Студенти ─────────────────────────────────────────
const studentInclude = {
  enrollments: {
    where: { deletedAt: null },
    include: { group: { select: { name: true } } },
    orderBy: { fromDate: 'desc' as const },
  },
};

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;
const studentDto = (s: StudentRow): StudentDto => ({
  id: s.id,
  lastName: s.lastName,
  firstName: s.firstName,
  middleName: s.middleName,
  note: s.note,
  enrollments: s.enrollments.map((e) => ({
    id: e.id,
    groupId: e.groupId,
    groupName: e.group.name,
    status: e.status,
  })),
  version: s.version,
});

export async function listStudents(
  ctx: AuthContext,
  filter: {
    cursor?: string | undefined;
    limit: number;
    q?: string | undefined;
    groupId?: string | undefined;
  },
) {
  const rows = await ctx.db.student.findMany({
    where: {
      ...studentScope,
      ...(filter.q !== undefined && {
        OR: [
          { lastName: { contains: filter.q, mode: 'insensitive' } },
          { firstName: { contains: filter.q, mode: 'insensitive' } },
        ],
      }),
      ...(filter.groupId !== undefined && {
        enrollments: { some: { groupId: filter.groupId, deletedAt: null } },
      }),
    },
    include: studentInclude,
    ...pageArgs(filter.cursor, filter.limit),
  });
  const page = toPage(rows, filter.limit);
  return { items: page.items.map(studentDto), nextCursor: page.nextCursor };
}

async function loadStudent(ctx: AuthContext, id: string) {
  return ctx.db.student.findFirst({ where: { id, ...studentScope }, include: studentInclude });
}

export async function createStudent(
  ctx: AuthContext,
  input: CreateStudentInput,
): Promise<StudentDto> {
  const { id, groupId, fromDate, ...data } = input;
  if (groupId !== undefined) await requireGroup(ctx, groupId);
  const studentId = newId(id);
  await ctx.db.$transaction(async (tx) => {
    await tx.student.create({
      data: { ...data, id: studentId, organizationId: ctx.organization.id },
    });
    if (groupId !== undefined) {
      await tx.enrollment.create({
        data: { id: uuidv7(), studentId, groupId, fromDate: dateOf(fromDate ?? isoOf(new Date())) },
      });
    }
  });
  const row = await loadStudent(ctx, studentId);
  if (!row) throw notFound('Студента не знайдено');
  return studentDto(row);
}

export async function updateStudent(
  ctx: AuthContext,
  id: string,
  input: UpdateStudentInput,
): Promise<StudentDto> {
  const { version, ...data } = input;
  const row = await versionedUpdate({
    update: () =>
      ctx.db.student.updateMany({
        where: { id, version, ...studentScope },
        data: { ...definedOnly(data), version: { increment: 1 } },
      }),
    load: () => loadStudent(ctx, id),
    what: 'Студента',
  });
  return studentDto(row);
}

export async function deleteStudent(ctx: AuthContext, id: string): Promise<void> {
  const { count } = await ctx.db.student.updateMany({
    where: { id, ...studentScope },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
  if (count === 0) throw notFound('Студента не знайдено');
}

// ── Зарахування ──────────────────────────────────────
const enrollmentDto = (e: {
  id: string;
  studentId: string;
  groupId: string;
  status: EnrollmentDto['status'];
  fromDate: Date;
  toDate: Date | null;
  version: number;
}): EnrollmentDto => ({
  id: e.id,
  studentId: e.studentId,
  groupId: e.groupId,
  status: e.status,
  fromDate: isoOf(e.fromDate),
  toDate: isoOrNull(e.toDate),
  version: e.version,
});

export async function createEnrollment(
  ctx: AuthContext,
  input: CreateEnrollmentInput,
): Promise<EnrollmentDto> {
  const student = await ctx.db.student.findFirst({
    where: { id: input.studentId, ...studentScope },
  });
  if (!student) throw notFound('Студента не знайдено');
  await requireGroup(ctx, input.groupId);
  const row = await ctx.db.enrollment.create({
    data: {
      id: newId(input.id),
      studentId: input.studentId,
      groupId: input.groupId,
      fromDate: dateOf(input.fromDate),
    },
  });
  return enrollmentDto(row);
}

export async function updateEnrollment(
  ctx: AuthContext,
  id: string,
  input: UpdateEnrollmentInput,
): Promise<EnrollmentDto> {
  const { version, toDate, ...rest } = input;
  const scope = { student: { organizationId: ctx.organization.id }, deletedAt: null };
  const row = await versionedUpdate({
    update: () =>
      ctx.db.enrollment.updateMany({
        where: { id, version, ...scope },
        data: {
          ...definedOnly(rest),
          ...(toDate !== undefined && { toDate: toDate === null ? null : dateOf(toDate) }),
          version: { increment: 1 },
        },
      }),
    load: () => ctx.db.enrollment.findFirst({ where: { id, ...scope } }),
    what: 'Зарахування',
  });
  return enrollmentDto(row);
}

// ── Імпорт списку студентів ──────────────────────────
export async function importStudents(
  ctx: AuthContext,
  input: ImportStudentsInput,
): Promise<ImportStudentsResult> {
  await requireGroup(ctx, input.groupId);

  const parsed = input.text !== undefined ? parseStudentList(input.text) : { rows: [], errors: [] };
  const rows =
    input.rows?.map((r, i) => ({
      line: i + 1,
      lastName: r.lastName,
      firstName: r.firstName,
      middleName: r.middleName,
    })) ?? parsed.rows;
  const errors = parsed.errors;

  const inGroup = await ctx.db.enrollment.findMany({
    where: { groupId: input.groupId, deletedAt: null },
    include: { student: true },
  });
  const key = (l: string, f: string, m: string | null) => `${l}|${f}|${m ?? ''}`.toLowerCase();
  const existing = new Set(
    inGroup.map((e) => key(e.student.lastName, e.student.firstName, e.student.middleName)),
  );

  const seen = new Set<string>();
  const preview = rows.map((r) => {
    const k = key(r.lastName, r.firstName, r.middleName);
    const duplicate = existing.has(k) || seen.has(k);
    seen.add(k);
    return { ...r, duplicate };
  });

  if (input.dryRun) {
    return { dryRun: true, rows: preview, errors, created: 0 };
  }
  if (errors.length > 0) {
    throw unprocessable('IMPORT_HAS_ERRORS', 'Виправте помилки у списку перед імпортом');
  }

  const fresh = preview.filter((r) => !r.duplicate);
  await ctx.db.$transaction(async (tx) => {
    for (const r of fresh) {
      const studentId = uuidv7();
      await tx.student.create({
        data: {
          id: studentId,
          organizationId: ctx.organization.id,
          lastName: r.lastName,
          firstName: r.firstName,
          middleName: r.middleName,
        },
      });
      await tx.enrollment.create({
        data: { id: uuidv7(), studentId, groupId: input.groupId, fromDate: dateOf(input.fromDate) },
      });
    }
  });
  return { dryRun: false, rows: preview, errors, created: fresh.length };
}
