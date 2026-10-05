import type { CreateExtraLessonInput } from '@ge/shared';

import { conflict, notFound, unprocessable } from '../../errors.js';
import { dateOf, isoOf, newId } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { semesterScope } from '../semesters/repo.js';

import { assertSlotFree, semesterInputOf } from './availability.js';

async function findLesson(ctx: AuthContext, id: string) {
  const lesson = await ctx.db.lesson.findFirst({
    where: { id, deletedAt: null, load: { semester: semesterScope(ctx.organization.id) } },
    include: { load: true },
  });
  if (!lesson) throw notFound('Заняття не знайдено');
  return lesson;
}

/** Скасування одного заняття (шаблон розкладу не змінюється). */
export async function cancelLesson(
  ctx: AuthContext,
  id: string,
  reason: string | null,
): Promise<void> {
  const lesson = await findLesson(ctx, id);
  if (lesson.status !== 'PLANNED')
    throw conflict('LESSON_NOT_PLANNED', 'Скасувати можна лише заплановане заняття');
  await ctx.db.lesson.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      manuallyEdited: true,
      ...(reason !== null && { note: reason }),
      version: { increment: 1 },
    },
  });
}

/** Заміна викладача на одному занятті. */
export async function substituteLesson(
  ctx: AuthContext,
  id: string,
  teacherId: string,
): Promise<void> {
  const lesson = await findLesson(ctx, id);
  if (lesson.status !== 'PLANNED')
    throw conflict('LESSON_NOT_PLANNED', 'Замінити можна лише заплановане заняття');
  const teacher = await ctx.db.membership.findFirst({
    where: { userId: teacherId, deletedAt: null, roles: { has: 'TEACHER' } },
  });
  if (!teacher) throw unprocessable('NOT_A_TEACHER', 'Користувач не є викладачем цього коледжу');

  await assertSlotFree(
    ctx,
    { id, teacherId, load: lesson.load },
    { date: isoOf(lesson.date), pairNumber: lesson.pairNumber, roomId: null },
  );
  await ctx.db.lesson.update({
    where: { id },
    data: { teacherId, manuallyEdited: true, version: { increment: 1 } },
  });
}

/** Додаткова пара: заняття поза шаблоном розкладу. */
export async function createExtraLesson(
  ctx: AuthContext,
  input: CreateExtraLessonInput,
): Promise<string> {
  const load = await ctx.db.teachingLoad.findFirst({
    where: { id: input.loadId, deletedAt: null, semester: semesterScope(ctx.organization.id) },
  });
  if (!load) throw notFound('Навантаження не знайдено');
  const semester = await semesterInputOf(ctx, load.semesterId);
  if (!semester || input.date < semester.startDate || input.date > semester.endDate) {
    throw unprocessable('DATE_OUT_OF_SEMESTER', 'Дата виходить за межі семестру');
  }

  const id = newId(input.id);
  const target = { date: input.date, pairNumber: input.pairNumber, roomId: input.roomId };
  await assertSlotFree(ctx, { id, teacherId: load.teacherId, load }, target);

  const data = {
    loadId: load.id,
    slotId: null,
    teacherId: load.teacherId,
    date: dateOf(input.date),
    pairNumber: input.pairNumber,
    roomId: input.roomId,
    hours: 2,
    status: 'PLANNED' as const,
    manuallyEdited: true,
  };
  const occupant = await ctx.db.lesson.findFirst({
    where: { loadId: load.id, date: dateOf(input.date), pairNumber: input.pairNumber },
  });
  if (occupant && occupant.deletedAt === null && occupant.status !== 'CANCELLED') {
    throw conflict('DUPLICATE', 'На цей час у навантаження вже є заняття');
  }
  if (occupant) {
    await ctx.db.lesson.update({
      where: { id: occupant.id },
      data: { ...data, deletedAt: null, version: { increment: 1 } },
    });
    return occupant.id;
  }
  await ctx.db.lesson.create({ data: { id, ...data } });
  return id;
}
