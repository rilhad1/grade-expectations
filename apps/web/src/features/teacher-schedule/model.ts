import { addDays, mondayOf } from '@ge/domain';
import type { LessonItemDto } from '@ge/shared';

/** Понеділок тижня, що містить дату. */
export const weekStartOf = (date: string): string => mondayOf(date);
export const shiftWeek = (weekStart: string, weeks: number): string =>
  addDays(weekStart, weeks * 7);
export const weekEnd = (weekStart: string): string => addDays(weekStart, 5); // субота
export const weekDays = (weekStart: string): string[] =>
  Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));

/** Заняття клітинки «день × пара». */
export function lessonsAt(
  lessons: readonly LessonItemDto[],
  date: string,
  pair: number,
): LessonItemDto[] {
  return lessons.filter((l) => l.date === date && l.pairNumber === pair);
}

/** Запит на перенесення можна подати лише на майбутнє заплановане заняття. */
export function canRequestMove(
  lesson: Pick<LessonItemDto, 'status' | 'date'>,
  today: string,
): boolean {
  return lesson.status === 'PLANNED' && lesson.date >= today;
}
