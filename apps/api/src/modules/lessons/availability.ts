import { findFreeSlots, teachingDays, type FreeSlot, type SemesterInput } from '@ge/domain';

import { conflict } from '../../errors.js';
import { dateOf, isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { semesterScope } from '../semesters/repo.js';

export interface MovableLesson {
  id: string;
  teacherId: string;
  load: { semesterId: string; groupId: string; subgroupId: string | null };
}

/** Календар семестру як вхід доменних функцій. */
export async function semesterInputOf(
  ctx: AuthContext,
  semesterId: string,
): Promise<SemesterInput | null> {
  const s = await ctx.db.semester.findFirst({
    where: { id: semesterId, ...semesterScope(ctx.organization.id) },
    include: { periods: { where: { deletedAt: null } } },
  });
  if (!s) return null;
  return {
    startDate: isoOf(s.startDate),
    endDate: isoOf(s.endDate),
    firstWeekParity: s.firstWeekParity,
    parityAfterBreak: s.parityAfterBreak,
    periods: s.periods.map((p) => ({
      kind: p.kind,
      startDate: isoOf(p.startDate),
      endDate: isoOf(p.endDate),
      course: p.course,
    })),
  };
}

/**
 * Вільні слоти для заняття у вікні дат: навчальні дні семестру, де вільні викладач і група.
 * Саме заняття (id) зі зайнятих виключається.
 */
export async function freeSlotsFor(
  ctx: AuthContext,
  lesson: MovableLesson,
  window: { from: string; to: string },
): Promise<FreeSlot[]> {
  const semester = await semesterInputOf(ctx, lesson.load.semesterId);
  if (!semester) return [];

  const group = await ctx.db.group.findFirst({
    where: { id: lesson.load.groupId },
    select: { course: true },
  });
  const dates = teachingDays(semester, group?.course).filter(
    (d) => d >= window.from && d <= window.to,
  );
  if (dates.length === 0) return [];

  const [bells, rooms, lessons] = await Promise.all([
    ctx.db.bellTime.findMany({ where: { deletedAt: null }, orderBy: { pairNumber: 'asc' } }),
    ctx.db.room.findMany({ where: { deletedAt: null } }),
    ctx.db.lesson.findMany({
      where: {
        id: { not: lesson.id },
        deletedAt: null,
        status: { notIn: ['CANCELLED', 'MOVED'] },
        date: { gte: dateOf(dates[0] ?? window.from), lte: dateOf(dates.at(-1) ?? window.to) },
        load: { semester: semesterScope(ctx.organization.id) },
      },
      include: { load: { select: { groupId: true, subgroupId: true } } },
    }),
  ]);

  return findFreeSlots({
    dates,
    pairNumbers: bells.map((b) => b.pairNumber),
    roomIds: rooms.map((r) => r.id),
    busy: lessons.map((l) => ({
      date: isoOf(l.date),
      pairNumber: l.pairNumber,
      teacherId: l.teacherId,
      groupId: l.load.groupId,
      subgroupId: l.load.subgroupId,
      roomId: l.roomId,
    })),
    lesson: {
      teacherId: lesson.teacherId,
      groupId: lesson.load.groupId,
      subgroupId: lesson.load.subgroupId,
    },
  });
}

/** Перевіряє, що на дату й пару вільні викладач і група (і аудиторія, якщо вказана). */
export async function assertSlotFree(
  ctx: AuthContext,
  lesson: MovableLesson,
  target: { date: string; pairNumber: number; roomId: string | null },
): Promise<void> {
  const free = await freeSlotsFor(ctx, lesson, { from: target.date, to: target.date });
  const slot = free.find((s) => s.pairNumber === target.pairNumber);
  if (!slot) {
    throw conflict(
      'SLOT_NOT_FREE',
      'На цей час викладач або група зайняті, або це не навчальний день',
    );
  }
  if (target.roomId !== null && !slot.freeRoomIds.includes(target.roomId)) {
    throw conflict('ROOM_BUSY', 'Аудиторія на цей час зайнята');
  }
}
