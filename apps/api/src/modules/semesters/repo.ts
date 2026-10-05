import type { Prisma } from '@prisma/client';

import { dateOf, pageArgs } from '../../lib/db.js';
import type { TenantClient } from '../../plugins/tenant.js';

/** Семестр належить коледжу через навчальний рік. */
export const semesterScope = (organizationId: string) =>
  ({ academicYear: { organizationId }, deletedAt: null }) satisfies Prisma.SemesterWhereInput;

const withPeriods = {
  periods: { where: { deletedAt: null }, orderBy: { startDate: 'asc' as const } },
};

export type SemesterRow = NonNullable<Awaited<ReturnType<typeof findSemester>>>;

export const listYears = (db: TenantClient, cursor: string | undefined, limit: number) =>
  db.academicYear.findMany({ where: { deletedAt: null }, ...pageArgs(cursor, limit) });

export const findYear = (db: TenantClient, id: string) =>
  db.academicYear.findFirst({ where: { id, deletedAt: null } });

export const createYear = (
  db: TenantClient,
  organizationId: string,
  data: { id: string; title: string; startDate: string; endDate: string },
) =>
  db.academicYear.create({
    data: {
      id: data.id,
      title: data.title,
      startDate: dateOf(data.startDate),
      endDate: dateOf(data.endDate),
      organizationId,
    },
  });

export const updateYearVersioned = (
  db: TenantClient,
  id: string,
  version: number,
  data: {
    title?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
  },
) =>
  db.academicYear.updateMany({
    where: { id, version, deletedAt: null },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.startDate !== undefined && { startDate: dateOf(data.startDate) }),
      ...(data.endDate !== undefined && { endDate: dateOf(data.endDate) }),
      version: { increment: 1 },
    },
  });

export const listSemesters = (
  db: TenantClient,
  organizationId: string,
  filter: {
    academicYearId?: string | undefined;
    status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | undefined;
  },
) =>
  db.semester.findMany({
    where: {
      ...semesterScope(organizationId),
      ...(filter.academicYearId !== undefined && { academicYearId: filter.academicYearId }),
      ...(filter.status !== undefined && { status: filter.status }),
    },
    include: withPeriods,
    orderBy: { startDate: 'desc' },
  });

export const findSemester = (db: TenantClient, organizationId: string, id: string) =>
  db.semester.findFirst({
    where: { id, ...semesterScope(organizationId) },
    include: withPeriods,
  });
