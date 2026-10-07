import {
  uuidv7,
  type CloneSemesterResult,
  type CreateAcademicYearInput,
  type CreateSemesterInput,
  type PeriodInput,
  type SemesterFullDto,
  type UpdateAcademicYearInput,
  type UpdateSemesterInput,
} from '@ge/shared';

import { conflict, notFound, unprocessable } from '../../errors.js';
import { dateOf, isoOf, newId, toPage, versionedUpdate } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';

import * as repo from './repo.js';

type CreateYear = CreateAcademicYearInput;
type UpdateYear = UpdateAcademicYearInput;
type CreateSemester = CreateSemesterInput;
type UpdateSemester = UpdateSemesterInput;

const yearDto = (y: NonNullable<Awaited<ReturnType<typeof repo.findYear>>>) => ({
  id: y.id,
  title: y.title,
  startDate: isoOf(y.startDate),
  endDate: isoOf(y.endDate),
  version: y.version,
});

export function semesterDto(s: repo.SemesterRow): SemesterFullDto {
  return {
    id: s.id,
    academicYearId: s.academicYearId,
    number: s.number,
    startDate: isoOf(s.startDate),
    endDate: isoOf(s.endDate),
    firstWeekParity: s.firstWeekParity,
    parityAfterBreak: s.parityAfterBreak,
    status: s.status,
    periods: s.periods.map((p) => ({
      id: p.id,
      kind: p.kind,
      startDate: isoOf(p.startDate),
      endDate: isoOf(p.endDate),
      title: p.title,
      course: p.course,
    })),
    version: s.version,
  };
}

/** Періоди мають лежати всередині семестру. */
function assertPeriodsInside(start: string, end: string, periods: readonly PeriodInput[]): void {
  const outside = periods.find((p) => p.startDate < start || p.endDate > end);
  if (outside) {
    throw unprocessable(
      'PERIOD_OUT_OF_RANGE',
      `Період ${outside.startDate}…${outside.endDate} виходить за межі семестру`,
    );
  }
}

// ── Роки ─────────────────────────────────────────────
export async function listYears(ctx: AuthContext, cursor: string | undefined, limit: number) {
  const page = toPage(await repo.listYears(ctx.db, cursor, limit), limit);
  return { items: page.items.map(yearDto), nextCursor: page.nextCursor };
}

export async function createYear(ctx: AuthContext, input: CreateYear) {
  const created = await repo.createYear(ctx.db, ctx.organization.id, {
    ...input,
    id: newId(input.id),
  });
  return yearDto(created);
}

export async function updateYear(ctx: AuthContext, id: string, input: UpdateYear) {
  const { version, ...data } = input;
  const row = await versionedUpdate({
    update: () => repo.updateYearVersioned(ctx.db, id, version, data),
    load: () => repo.findYear(ctx.db, id),
    what: 'Навчальний рік',
  });
  return yearDto(row);
}

// ── Семестри ─────────────────────────────────────────
export async function listSemesters(
  ctx: AuthContext,
  filter: Parameters<typeof repo.listSemesters>[2],
) {
  return (await repo.listSemesters(ctx.db, ctx.organization.id, filter)).map(semesterDto);
}

export async function getSemester(ctx: AuthContext, id: string) {
  const row = await repo.findSemester(ctx.db, ctx.organization.id, id);
  if (!row) throw notFound('Семестр не знайдено');
  return semesterDto(row);
}

export async function createSemester(ctx: AuthContext, input: CreateSemester) {
  const year = await repo.findYear(ctx.db, input.academicYearId);
  if (!year) throw notFound('Навчальний рік не знайдено');
  assertPeriodsInside(input.startDate, input.endDate, input.periods);

  const id = newId(input.id);
  await ctx.db.semester.create({
    data: {
      id,
      academicYearId: year.id,
      number: input.number,
      startDate: dateOf(input.startDate),
      endDate: dateOf(input.endDate),
      firstWeekParity: input.firstWeekParity,
      parityAfterBreak: input.parityAfterBreak,
      periods: {
        create: input.periods.map((p) => ({
          id: uuidv7(),
          kind: p.kind,
          startDate: dateOf(p.startDate),
          endDate: dateOf(p.endDate),
          title: p.title,
          course: p.course,
        })),
      },
    },
  });
  return getSemester(ctx, id);
}

export async function updateSemester(ctx: AuthContext, id: string, input: UpdateSemester) {
  const current = await repo.findSemester(ctx.db, ctx.organization.id, id);
  if (!current) throw notFound('Семестр не знайдено');
  if (current.status === 'CLOSED') {
    throw conflict('SEMESTER_CLOSED', 'Закритий семестр доступний лише для читання');
  }

  const { version, periods, ...fields } = input;
  const start = fields.startDate ?? isoOf(current.startDate);
  const end = fields.endDate ?? isoOf(current.endDate);
  if (start > end) throw unprocessable('INVALID_RANGE', 'Початок семестру пізніше за кінець');
  assertPeriodsInside(
    start,
    end,
    periods ??
      current.periods.map((p) => ({
        kind: p.kind,
        startDate: isoOf(p.startDate),
        endDate: isoOf(p.endDate),
        title: p.title,
        course: p.course,
      })),
  );

  await ctx.db.$transaction(async (tx) => {
    const { count } = await tx.semester.updateMany({
      where: { id, version, deletedAt: null },
      data: {
        ...(fields.startDate !== undefined && { startDate: dateOf(fields.startDate) }),
        ...(fields.endDate !== undefined && { endDate: dateOf(fields.endDate) }),
        ...(fields.firstWeekParity !== undefined && { firstWeekParity: fields.firstWeekParity }),
        ...(fields.parityAfterBreak !== undefined && { parityAfterBreak: fields.parityAfterBreak }),
        version: { increment: 1 },
      },
    });
    if (count === 0)
      throw conflict('VERSION_CONFLICT', 'Семестр змінено на іншому пристрої; оновіть дані');

    if (periods) {
      // Набір періодів замінюється повністю; старі позначаються видаленими (м'яке видалення)
      await tx.semesterPeriod.updateMany({
        where: { semesterId: id, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await tx.semesterPeriod.createMany({
        data: periods.map((p) => ({
          id: uuidv7(),
          semesterId: id,
          kind: p.kind,
          startDate: dateOf(p.startDate),
          endDate: dateOf(p.endDate),
          title: p.title,
          course: p.course,
        })),
      });
    }
  });
  return getSemester(ctx, id);
}

/** Активним може бути лише один семестр коледжу. */
export async function activateSemester(ctx: AuthContext, id: string) {
  const row = await repo.findSemester(ctx.db, ctx.organization.id, id);
  if (!row) throw notFound('Семестр не знайдено');
  if (row.status !== 'DRAFT')
    throw conflict('SEMESTER_NOT_DRAFT', 'Активувати можна лише чернетку');

  const active = await ctx.db.semester.findFirst({
    where: { ...repo.semesterScope(ctx.organization.id), status: 'ACTIVE' },
  });
  if (active) throw conflict('ACTIVE_SEMESTER_EXISTS', 'Спершу закрийте поточний активний семестр');

  await ctx.db.semester.update({
    where: { id },
    data: { status: 'ACTIVE', version: { increment: 1 } },
  });
  return getSemester(ctx, id);
}

/** Закритий семестр — архів, лише читання. */
export async function closeSemester(ctx: AuthContext, id: string) {
  const row = await repo.findSemester(ctx.db, ctx.organization.id, id);
  if (!row) throw notFound('Семестр не знайдено');
  if (row.status !== 'ACTIVE')
    throw conflict('SEMESTER_NOT_ACTIVE', 'Закрити можна лише активний семестр');

  await ctx.db.semester.update({
    where: { id },
    data: { status: 'CLOSED', version: { increment: 1 } },
  });
  return getSemester(ctx, id);
}

/**
 * Майстер «Новий семестр», крок копіювання: навантаження з обраного семестру (групи мапляться
 * на групи цього навчального року через потік) і шаблон розкладу як чернетка.
 */
export async function cloneSemester(
  ctx: AuthContext,
  targetId: string,
  sourceId: string,
): Promise<CloneSemesterResult> {
  if (targetId === sourceId)
    throw unprocessable('SAME_SEMESTER', 'Не можна копіювати семестр сам у себе');
  const target = await repo.findSemester(ctx.db, ctx.organization.id, targetId);
  const source = await repo.findSemester(ctx.db, ctx.organization.id, sourceId);
  if (!target || !source) throw notFound('Семестр не знайдено');
  if (target.status !== 'DRAFT')
    throw conflict('SEMESTER_NOT_DRAFT', 'Копіювати можна лише в чернетку');

  const existing = await ctx.db.teachingLoad.count({
    where: { semesterId: targetId, deletedAt: null },
  });
  if (existing > 0) throw conflict('SEMESTER_NOT_EMPTY', 'У цільовому семестрі вже є навантаження');

  const sourceLoads = await ctx.db.teachingLoad.findMany({
    where: { semesterId: sourceId, deletedAt: null },
    include: { group: true, subgroup: true },
    orderBy: { id: 'asc' },
  });
  const targetGroups = await ctx.db.group.findMany({
    where: { academicYearId: target.academicYearId, deletedAt: null },
    include: { subgroups: { where: { deletedAt: null } } },
  });

  const result: CloneSemesterResult = { copiedLoads: 0, copiedSlots: 0, skipped: [] };
  const loadIdMap = new Map<string, string>();

  await ctx.db.$transaction(async (tx) => {
    for (const load of sourceLoads) {
      // Та сама навчальна група: у межах одного року; інакше — група цього ж потоку в цільовому році
      const group =
        source.academicYearId === target.academicYearId
          ? targetGroups.find((g) => g.id === load.groupId)
          : targetGroups.find((g) => g.cohortId === load.group.cohortId);
      if (!group) {
        result.skipped.push({ sourceLoadId: load.id, reason: 'GROUP_NOT_PROMOTED' });
        continue;
      }
      let subgroupId: string | null = null;
      if (load.subgroup) {
        const sub = group.subgroups.find((s) => s.name === load.subgroup?.name);
        if (!sub) {
          result.skipped.push({ sourceLoadId: load.id, reason: 'SUBGROUP_MISSING' });
          continue;
        }
        subgroupId = sub.id;
      }

      const newLoadId = uuidv7();
      loadIdMap.set(load.id, newLoadId);
      await tx.teachingLoad.create({
        data: {
          id: newLoadId,
          semesterId: targetId,
          disciplineId: load.disciplineId,
          groupId: group.id,
          subgroupId,
          teacherId: load.teacherId,
          kind: load.kind,
          plannedHours: load.plannedHours,
          controlForm: load.controlForm,
          gradingRules: load.gradingRules ?? {},
        },
      });
      result.copiedLoads += 1;
    }

    // Шаблон розкладу: остання опублікована версія, інакше остання за номером
    const schedules = await tx.schedule.findMany({
      where: { semesterId: sourceId, deletedAt: null },
      orderBy: { revision: 'desc' },
      include: { slots: { where: { deletedAt: null } } },
    });
    const template = schedules.find((s) => s.status === 'PUBLISHED') ?? schedules[0];
    if (!template) return;

    const last = await tx.schedule.findFirst({
      where: { semesterId: targetId },
      orderBy: { revision: 'desc' },
    });
    const scheduleId = uuidv7();
    await tx.schedule.create({
      data: {
        id: scheduleId,
        semesterId: targetId,
        revision: (last?.revision ?? 0) + 1,
        status: 'DRAFT',
      },
    });
    const slots = template.slots.flatMap((slot) => {
      const loadId = loadIdMap.get(slot.loadId);
      return loadId
        ? [
            {
              id: uuidv7(),
              scheduleId,
              loadId,
              weekday: slot.weekday,
              pairNumber: slot.pairNumber,
              parity: slot.parity,
              roomId: slot.roomId,
              validFrom: target.startDate,
              validTo: null,
            },
          ]
        : [];
    });
    await tx.scheduleSlot.createMany({ data: slots });
    result.copiedSlots = slots.length;
  });

  return result;
}
