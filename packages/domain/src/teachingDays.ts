import type { IsoDate, PeriodKind } from '@ge/shared';

import { eachDay, inRange, isoWeekday } from './dates.js';
import type { SemesterInput } from './types.js';

const NON_TEACHING: ReadonlySet<PeriodKind> = new Set([
  'HOLIDAY',
  'DAY_OFF',
  'EXAM_SESSION',
  'PRACTICE',
]);

/**
 * Дати семестру Пн–Сб без канікул, свят, вихідних, сесії та практики.
 * З `course` враховуються лише періоди цього курсу й спільні (без курсу); без нього — усі.
 */
export function teachingDays(semester: SemesterInput, course?: number): IsoDate[] {
  const blocked = semester.periods.filter(
    (p) =>
      NON_TEACHING.has(p.kind) && (course === undefined || p.course == null || p.course === course),
  );
  return eachDay(semester.startDate, semester.endDate).filter(
    (date) => isoWeekday(date) <= 6 && !blocked.some((p) => inRange(date, p.startDate, p.endDate)),
  );
}
