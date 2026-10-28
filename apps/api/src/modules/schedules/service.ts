import {
  assignTopics,
  detectScheduleConflicts,
  diffDays,
  generateLessons,
  type ExistingLesson,
  type LoadInput,
  type ScheduleSlotInput,
  type SemesterInput,
} from '@ge/domain';
import {
  uuidv7,
  type ConflictDto,
  type CreateScheduleInput,
  type CreateSlotInput,
  type LessonItemDto,
  type PublishResult,
  type ScheduleDetailDto,
  type ScheduleDto,
  type SlotDto,
  type UpdateSlotInput,
} from '@ge/shared';
import type { Prisma } from '@prisma/client';

import { conflict, notFound, unprocessable } from '../../errors.js';
import { dateOf, definedOnly, isoOf, isoOrNull, newId } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { findSemester, semesterScope } from '../semesters/repo.js';

const scheduleScope = (organizationId: string) =>
  ({
    semester: semesterScope(organizationId),
    deletedAt: null,
  }) satisfies Prisma.ScheduleWhereInput;

const PAIR_HOURS = 2;
const isModerator = (ctx: AuthContext) => ctx.roles.includes('MODERATOR');

type SlotRow = Prisma.ScheduleSlotGetPayload<object>;
const slotDto = (s: SlotRow): SlotDto => ({
  id: s.id,
  scheduleId: s.scheduleId,
  loadId: s.loadId,
  weekday: s.weekday,
  pairNumber: s.pairNumber,
  parity: s.parity,
  roomId: s.roomId,
  validFrom: isoOf(s.validFrom),
  validTo: isoOrNull(s.validTo),
  version: s.version,
});

const slotInput = (s: SlotDto): ScheduleSlotInput => ({
  id: s.id,
  loadId: s.loadId,
  weekday: s.weekday,
  pairNumber: s.pairNumber,
  parity: s.parity,
  roomId: s.roomId,
  validFrom: s.validFrom,
  validTo: s.validTo,
});

/** Відбиток слотів для порівняння версій розкладу (без id). */
const signature = (slots: readonly SlotDto[]): string =>
  JSON.stringify(
    slots
      .map((s) => [s.loadId, s.weekday, s.pairNumber, s.parity, s.roomId, s.validFrom, s.validTo])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );

async function loadSchedule(ctx: AuthContext, id: string) {
  const row = await ctx.db.schedule.findFirst({
    where: { id, ...scheduleScope(ctx.organization.id) },
    include: { slots: { where: { deletedAt: null }, orderBy: { id: 'asc' } } },
  });
  if (!row) return null;
  // Викладач бачить лише опубліковані версії
  if (!isModerator(ctx) && row.status !== 'PUBLISHED') return null;
  return row;
}

async function latestPublishedSlots(ctx: AuthContext, semesterId: string, excludeId?: string) {
  return ctx.db.schedule.findFirst({
    where: {
      semesterId,
      status: 'PUBLISHED',
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
    orderBy: { revision: 'desc' },
    include: { slots: { where: { deletedAt: null } } },
  });
}

async function toScheduleDto(
  ctx: AuthContext,
  row: NonNullable<Awaited<ReturnType<typeof loadSchedule>>>,
): Promise<ScheduleDto> {
  const slots = row.slots.map(slotDto);
  let changed = false;
  if (row.status === 'DRAFT') {
    const published = await latestPublishedSlots(ctx, row.semesterId);
    changed = signature(slots) !== signature((published?.slots ?? []).map(slotDto));
  }
  return {
    id: row.id,
    semesterId: row.semesterId,
    revision: row.revision,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    slotCount: slots.length,
    changedFromPublished: changed,
    version: row.version,
  };
}

// ── Версії розкладу ──────────────────────────────────
export async function listSchedules(ctx: AuthContext, semesterId: string): Promise<ScheduleDto[]> {
  const rows = await ctx.db.schedule.findMany({
    where: {
      ...scheduleScope(ctx.organization.id),
      semesterId,
      ...(!isModerator(ctx) && { status: 'PUBLISHED' as const }),
    },
    orderBy: { revision: 'desc' },
    include: { slots: { where: { deletedAt: null } } },
  });
  return Promise.all(rows.map((r) => toScheduleDto(ctx, r)));
}

export async function getSchedule(ctx: AuthContext, id: string): Promise<ScheduleDetailDto> {
  const row = await loadSchedule(ctx, id);
  if (!row) throw notFound('Розклад не знайдено');
  return { ...(await toScheduleDto(ctx, row)), slots: row.slots.map(slotDto) };
}

/** Статус версії розкладу для перевірки прав (schedule:read). */
export async function scheduleStatusOf(ctx: AuthContext, id: string) {
  const row = await ctx.db.schedule.findFirst({
    where: { id, ...scheduleScope(ctx.organization.id) },
  });
  if (!row) throw notFound('Розклад не знайдено');
  return row.status;
}

async function requireEditableDraft(ctx: AuthContext, id: string) {
  const row = await ctx.db.schedule.findFirst({
    where: { id, ...scheduleScope(ctx.organization.id) },
    include: { semester: true },
  });
  if (!row) throw notFound('Розклад не знайдено');
  if (row.status !== 'DRAFT')
    throw conflict(
      'SCHEDULE_PUBLISHED',
      'Опубліковану версію не можна змінювати; створіть чернетку',
    );
  if (row.semester.status === 'CLOSED')
    throw conflict('SEMESTER_CLOSED', 'Закритий семестр доступний лише для читання');
  return row;
}

export async function createSchedule(
  ctx: AuthContext,
  input: CreateScheduleInput,
): Promise<ScheduleDetailDto> {
  const semester = await findSemester(ctx.db, ctx.organization.id, input.semesterId);
  if (!semester) throw notFound('Семестр не знайдено');
  if (semester.status === 'CLOSED')
    throw conflict('SEMESTER_CLOSED', 'Закритий семестр доступний лише для читання');

  const existingDraft = await ctx.db.schedule.findFirst({
    where: { semesterId: semester.id, status: 'DRAFT', deletedAt: null },
  });
  if (existingDraft) throw conflict('DRAFT_EXISTS', 'У семестрі вже є чернетка розкладу');

  const source = input.copyFromScheduleId
    ? await ctx.db.schedule.findFirst({
        where: { id: input.copyFromScheduleId, semesterId: semester.id, deletedAt: null },
        include: { slots: { where: { deletedAt: null } } },
      })
    : await latestPublishedSlots(ctx, semester.id);
  if (input.copyFromScheduleId && !source) throw notFound('Версію для копіювання не знайдено');

  const last = await ctx.db.schedule.findFirst({
    where: { semesterId: semester.id },
    orderBy: { revision: 'desc' },
  });
  const id = newId(input.id);
  await ctx.db.$transaction(async (tx) => {
    await tx.schedule.create({
      data: { id, semesterId: semester.id, revision: (last?.revision ?? 0) + 1, status: 'DRAFT' },
    });
    if (source) {
      await tx.scheduleSlot.createMany({
        data: source.slots.map((s) => ({
          id: uuidv7(),
          scheduleId: id,
          loadId: s.loadId,
          weekday: s.weekday,
          pairNumber: s.pairNumber,
          parity: s.parity,
          roomId: s.roomId,
          validFrom: s.validFrom,
          validTo: s.validTo,
        })),
      });
    }
  });
  return getSchedule(ctx, id);
}

export async function discardSchedule(ctx: AuthContext, id: string): Promise<void> {
  await requireEditableDraft(ctx, id);
  const now = new Date();
  await ctx.db.$transaction(async (tx) => {
    await tx.scheduleSlot.updateMany({
      where: { scheduleId: id, deletedAt: null },
      data: { deletedAt: now, version: { increment: 1 } },
    });
    await tx.schedule.update({
      where: { id },
      data: { deletedAt: now, version: { increment: 1 } },
    });
  });
}

// ── Слоти ────────────────────────────────────────────
async function validateSlotRefs(
  ctx: AuthContext,
  semesterId: string,
  refs: {
    loadId?: string | undefined;
    pairNumber?: number | undefined;
    roomId?: string | null | undefined;
  },
) {
  if (refs.loadId !== undefined) {
    const load = await ctx.db.teachingLoad.findFirst({
      where: { id: refs.loadId, semesterId, deletedAt: null },
    });
    if (!load)
      throw unprocessable('LOAD_NOT_IN_SEMESTER', 'Навантаження не належить цьому семестру');
  }
  if (refs.pairNumber !== undefined) {
    const bell = await ctx.db.bellTime.findFirst({
      where: { pairNumber: refs.pairNumber, deletedAt: null },
    });
    if (!bell)
      throw unprocessable('UNKNOWN_PAIR', `Пари №${refs.pairNumber} немає в розкладі дзвінків`);
  }
  if (refs.roomId) {
    const room = await ctx.db.room.findFirst({ where: { id: refs.roomId, deletedAt: null } });
    if (!room) throw unprocessable('ROOM_NOT_FOUND', 'Аудиторію не знайдено');
  }
}

export async function createSlot(
  ctx: AuthContext,
  scheduleId: string,
  input: CreateSlotInput,
): Promise<SlotDto> {
  const schedule = await requireEditableDraft(ctx, scheduleId);
  await validateSlotRefs(ctx, schedule.semesterId, input);
  const validFrom = input.validFrom ?? isoOf(schedule.semester.startDate);
  if (input.validTo !== null && input.validTo < validFrom)
    throw unprocessable('INVALID_RANGE', 'validFrom пізніше за validTo');

  const row = await ctx.db.scheduleSlot.create({
    data: {
      id: newId(input.id),
      scheduleId,
      loadId: input.loadId,
      weekday: input.weekday,
      pairNumber: input.pairNumber,
      parity: input.parity,
      roomId: input.roomId,
      validFrom: dateOf(validFrom),
      validTo: input.validTo === null ? null : dateOf(input.validTo),
    },
  });
  return slotDto(row);
}

async function slotWithSchedule(ctx: AuthContext, id: string) {
  const slot = await ctx.db.scheduleSlot.findFirst({
    where: { id, deletedAt: null, schedule: scheduleScope(ctx.organization.id) },
  });
  if (!slot) throw notFound('Слот не знайдено');
  return { slot, schedule: await requireEditableDraft(ctx, slot.scheduleId) };
}

export async function updateSlot(
  ctx: AuthContext,
  id: string,
  input: UpdateSlotInput,
): Promise<SlotDto> {
  const { slot, schedule } = await slotWithSchedule(ctx, id);
  await validateSlotRefs(ctx, schedule.semesterId, {
    pairNumber: input.pairNumber,
    roomId: input.roomId,
  });

  const { version, validFrom, validTo, ...rest } = input;
  const nextFrom = validFrom ?? isoOf(slot.validFrom);
  const nextTo = validTo === undefined ? isoOrNull(slot.validTo) : validTo;
  if (nextTo !== null && nextTo < nextFrom)
    throw unprocessable('INVALID_RANGE', 'validFrom пізніше за validTo');

  const { count } = await ctx.db.scheduleSlot.updateMany({
    where: { id, version, deletedAt: null },
    data: {
      ...definedOnly(rest),
      ...(validFrom !== undefined && { validFrom: dateOf(validFrom) }),
      ...(validTo !== undefined && { validTo: validTo === null ? null : dateOf(validTo) }),
      version: { increment: 1 },
    },
  });
  if (count === 0)
    throw conflict('VERSION_CONFLICT', 'Слот змінено на іншому пристрої; оновіть дані');
  const row = await ctx.db.scheduleSlot.findFirst({ where: { id } });
  if (!row) throw notFound('Слот не знайдено');
  return slotDto(row);
}

export async function deleteSlot(ctx: AuthContext, id: string): Promise<void> {
  await slotWithSchedule(ctx, id);
  await ctx.db.scheduleSlot.update({
    where: { id },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
}

// ── Конфлікти ────────────────────────────────────────
async function semesterContext(ctx: AuthContext, semesterId: string) {
  const semester = await findSemester(ctx.db, ctx.organization.id, semesterId);
  if (!semester) throw notFound('Семестр не знайдено');
  const loads = await ctx.db.teachingLoad.findMany({
    where: { semesterId, deletedAt: null },
    include: { group: { select: { course: true } } },
  });
  const input: SemesterInput = {
    startDate: isoOf(semester.startDate),
    endDate: isoOf(semester.endDate),
    firstWeekParity: semester.firstWeekParity,
    parityAfterBreak: semester.parityAfterBreak,
    periods: semester.periods.map((p) => ({
      kind: p.kind,
      startDate: isoOf(p.startDate),
      endDate: isoOf(p.endDate),
      course: p.course,
    })),
  };
  const loadInputs: LoadInput[] = loads.map((l) => ({
    id: l.id,
    groupId: l.groupId,
    subgroupId: l.subgroupId,
    teacherId: l.teacherId,
    kind: l.kind,
    plannedHours: l.plannedHours,
    controlForm: l.controlForm,
    streamId: l.streamId,
    course: l.group.course,
  }));
  return { semester, input, loads: loadInputs };
}

/** Курс групи кожного навантаження: сесія й практика одного курсу не блокують інші. */
const coursesOf = (loads: readonly LoadInput[]): Map<string, number> =>
  new Map(loads.flatMap((l) => (l.course === undefined ? [] : [[l.id, l.course] as const])));

/** Години, які дає розклад за навантаженням, рахуються з реального календаря семестру (канікули, парність). */
function hoursConflicts(
  slots: readonly SlotDto[],
  loads: readonly LoadInput[],
  semester: SemesterInput,
  revision: number,
): ConflictDto[] {
  const { create } = generateLessons(
    semester,
    { version: revision, slots: slots.map(slotInput) },
    [],
    { loadCourses: coursesOf(loads) },
  );
  const scheduled = new Map<string, number>();
  for (const lesson of create)
    scheduled.set(lesson.loadId, (scheduled.get(lesson.loadId) ?? 0) + PAIR_HOURS);

  return loads.flatMap((load): ConflictDto[] => {
    const hours = scheduled.get(load.id) ?? 0;
    if (hours <= load.plannedHours) return [];
    return [
      {
        type: 'HOURS_EXCEEDED',
        slotIds: slots.filter((s) => s.loadId === load.id).map((s) => s.id),
        loadIds: [load.id],
        message: `У розкладі ${hours} год, а за навантаженням ${load.plannedHours} год`,
      },
    ];
  });
}

function conflictsOf(
  slots: readonly SlotDto[],
  loads: readonly LoadInput[],
  semester: SemesterInput,
  revision: number,
): ConflictDto[] {
  return [
    ...detectScheduleConflicts(slots.map(slotInput), loads),
    ...hoursConflicts(slots, loads, semester, revision),
  ];
}

export async function getConflicts(ctx: AuthContext, scheduleId: string): Promise<ConflictDto[]> {
  const schedule = await getSchedule(ctx, scheduleId);
  const { input, loads } = await semesterContext(ctx, schedule.semesterId);
  return conflictsOf(schedule.slots, loads, input, schedule.revision);
}

// ── Публікація ───────────────────────────────────────
async function markedLessonIds(ctx: AuthContext, lessonIds: string[]): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();
  const [att, grades] = await Promise.all([
    ctx.db.attendance.findMany({
      where: { lessonId: { in: lessonIds } },
      select: { lessonId: true },
      distinct: ['lessonId'],
    }),
    ctx.db.grade.findMany({
      where: { lessonId: { in: lessonIds } },
      select: { lessonId: true },
      distinct: ['lessonId'],
    }),
  ]);
  return new Set([
    ...att.map((a) => a.lessonId),
    ...grades.flatMap((g) => (g.lessonId ? [g.lessonId] : [])),
  ]);
}

/**
 * Публікація: рахує різницю «створено / скасовано / без змін», блокується конфліктами,
 * позначає версію опублікованою й генерує заняття з шаблону та календаря семестру.
 */
export async function publishSchedule(
  ctx: AuthContext,
  scheduleId: string,
  dryRun: boolean,
): Promise<PublishResult> {
  const draft = await requireEditableDraft(ctx, scheduleId);
  const detail = await getSchedule(ctx, scheduleId);
  const { input, loads } = await semesterContext(ctx, draft.semesterId);

  const conflicts = conflictsOf(detail.slots, loads, input, draft.revision);

  const lessonRows = await ctx.db.lesson.findMany({
    where: { load: { semesterId: draft.semesterId }, deletedAt: null },
  });
  const marks = await markedLessonIds(
    ctx,
    lessonRows.map((l) => l.id),
  );
  const existing: ExistingLesson[] = lessonRows.map((l) => ({
    id: l.id,
    loadId: l.loadId,
    slotId: l.slotId,
    date: isoOf(l.date),
    pairNumber: l.pairNumber,
    status: l.status,
    hasMarks: marks.has(l.id),
    manuallyEdited: l.manuallyEdited,
  }));

  const plan = generateLessons(
    input,
    { version: draft.revision, slots: detail.slots.map(slotInput) },
    existing,
    {
      today: ctx.today(),
      loadCourses: coursesOf(loads),
    },
  );
  const loadById = new Map(loads.map((l) => [l.id, l]));
  const teachers = new Set(
    detail.slots.flatMap((s) =>
      loadById.get(s.loadId) ? [loadById.get(s.loadId)?.teacherId] : [],
    ),
  );

  const result: PublishResult = {
    dryRun,
    create: plan.create.length,
    cancel: plan.cancel.length,
    keep: plan.keep.length,
    teachers: teachers.size,
    conflicts,
  };
  if (dryRun) return result;

  if (conflicts.length > 0) {
    throw unprocessable(
      'SCHEDULE_HAS_CONFLICTS',
      `У розкладі є конфлікти (${conflicts.length}); виправте їх перед публікацією`,
    );
  }

  await ctx.db.$transaction(async (tx) => {
    await tx.schedule.update({
      where: { id: scheduleId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedById: ctx.user.id,
        version: { increment: 1 },
      },
    });

    if (plan.cancel.length > 0) {
      await tx.lesson.updateMany({
        where: { id: { in: plan.cancel } },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    }
    const rows = plan.create.map((l) => ({
      id: uuidv7(),
      loadId: l.loadId,
      slotId: l.slotId,
      teacherId: loadById.get(l.loadId)?.teacherId ?? '',
      scheduleVersion: l.scheduleVersion,
      date: dateOf(l.date),
      pairNumber: l.pairNumber,
      roomId: l.roomId,
      hours: 2,
    }));
    // Унікальний індекс (loadId, date, pairNumber) не знає про м'яке видалення: такі заняття відновлюємо
    const keyOf = (r: { loadId: string; date: Date; pairNumber: number }) =>
      `${r.loadId}|${isoOf(r.date)}|${String(r.pairNumber)}`;
    const trashed =
      rows.length === 0
        ? []
        : await tx.lesson.findMany({
            where: {
              deletedAt: { not: null },
              OR: rows.map((r) => ({ loadId: r.loadId, date: r.date, pairNumber: r.pairNumber })),
            },
            select: { id: true, loadId: true, date: true, pairNumber: true },
          });
    const revive = new Map(trashed.map((t) => [keyOf(t), t.id]));
    for (const r of rows) {
      const reviveId = revive.get(keyOf(r));
      if (reviveId === undefined) continue;
      await tx.lesson.update({
        where: { id: reviveId },
        data: {
          slotId: r.slotId,
          teacherId: r.teacherId,
          scheduleVersion: r.scheduleVersion,
          roomId: r.roomId,
          hours: r.hours,
          status: 'PLANNED',
          manuallyEdited: false,
          deletedAt: null,
          version: { increment: 1 },
        },
      });
    }
    await tx.lesson.createMany({ data: rows.filter((r) => !revive.has(keyOf(r))) });
  });

  await assignTopicsForLoads(ctx, [...new Set(plan.create.map((l) => l.loadId))]);
  return result;
}

/** Теми з тематичного плану розкладаються по заняттях навантаження по черзі (лише ті, що не правилися вручну). */
export async function assignTopicsForLoads(ctx: AuthContext, loadIds: string[]): Promise<void> {
  for (const loadId of loadIds) {
    const load = await ctx.db.teachingLoad.findFirst({ where: { id: loadId } });
    if (!load) continue;
    const program = await ctx.db.disciplineProgram.findFirst({
      where: { disciplineId: load.disciplineId, deletedAt: null },
      orderBy: { edition: 'desc' },
      include: {
        topics: { where: { deletedAt: null, kind: load.kind }, orderBy: { order: 'asc' } },
      },
    });
    if (!program || program.topics.length === 0) continue;

    const lessons = await ctx.db.lesson.findMany({
      where: { loadId, deletedAt: null, status: { notIn: ['CANCELLED', 'MOVED'] } },
      orderBy: [{ date: 'asc' }, { pairNumber: 'asc' }],
    });
    const assigned = new Map(
      assignTopics(
        lessons.map((l) => ({ id: l.id, hours: l.hours })),
        program.topics.map((t) => ({ id: t.id, hours: t.hours })),
      ).map((a) => [a.lessonId, a.topicId]),
    );
    for (const lesson of lessons) {
      const topicId = assigned.get(lesson.id) ?? null;
      // Заплановані заняття переприсвоюються; проведені без теми лише доповнюються (історію не перезаписуємо)
      const assignable =
        lesson.status === 'PLANNED' || (lesson.status === 'HELD' && lesson.topicId === null);
      if (
        assignable &&
        !lesson.manuallyEdited &&
        lesson.topicText === null &&
        lesson.topicId !== topicId
      ) {
        await ctx.db.lesson.update({
          where: { id: lesson.id },
          data: { topicId, version: { increment: 1 } },
        });
      }
    }
  }
}

// ── Заняття (календар) ───────────────────────────────
const MAX_RANGE_DAYS = 100;

export async function listLessons(
  ctx: AuthContext,
  filter: {
    from: string;
    to: string;
    semesterId?: string | undefined;
    teacherId?: string | undefined;
    groupId?: string | undefined;
  },
): Promise<LessonItemDto[]> {
  if (filter.to < filter.from)
    throw unprocessable('INVALID_RANGE', 'Початок періоду пізніше за кінець');
  if (diffDays(filter.to, filter.from) > MAX_RANGE_DAYS) {
    throw unprocessable('RANGE_TOO_LARGE', `Період не може перевищувати ${MAX_RANGE_DAYS} днів`);
  }
  // Викладач бачить лише власні заняття
  const teacherId = isModerator(ctx) ? filter.teacherId : ctx.user.id;

  const rows = await ctx.db.lesson.findMany({
    where: {
      deletedAt: null,
      date: { gte: dateOf(filter.from), lte: dateOf(filter.to) },
      load: {
        semester: semesterScope(ctx.organization.id),
        deletedAt: null,
        ...(filter.semesterId !== undefined && { semesterId: filter.semesterId }),
        ...(filter.groupId !== undefined && { groupId: filter.groupId }),
      },
      ...(teacherId !== undefined && { teacherId }),
    },
    include: {
      load: { include: { discipline: true, group: true, subgroup: true } },
      room: true,
      teacher: { select: { id: true, fullName: true } },
      topic: true,
    },
    orderBy: [{ date: 'asc' }, { pairNumber: 'asc' }, { id: 'asc' }],
  });

  return rows.map((l) => ({
    id: l.id,
    loadId: l.loadId,
    date: isoOf(l.date),
    pairNumber: l.pairNumber,
    hours: l.hours,
    status: l.status,
    kind: l.load.kind,
    topic: l.topicText ?? l.topic?.title ?? null,
    homework: l.homework,
    note: l.note,
    manuallyEdited: l.manuallyEdited,
    streamId: l.load.streamId,
    discipline: {
      id: l.load.discipline.id,
      title: l.load.discipline.title,
      shortTitle: l.load.discipline.shortTitle,
      color: l.load.discipline.color,
    },
    group: { id: l.load.group.id, name: l.load.group.name },
    subgroup: l.load.subgroup ? { id: l.load.subgroup.id, name: l.load.subgroup.name } : null,
    room: l.room ? { id: l.room.id, name: l.room.name } : null,
    teacher: l.teacher,
    version: l.version,
  }));
}
