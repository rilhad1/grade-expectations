import type { IsoDate, PeriodKind } from '@ge/shared';

import { eachDay, inRange, isoWeekday } from './dates.js';
import type { SemesterInput } from './types.js';

const NON_TEACHING: ReadonlySet<PeriodKind> = new Set([
  'HOLIDAY',
  'DAY_OFF',
  'EXAM_SESSION',
  'PRACTICE',
]);

/** Дати семестру Пн–Сб без канікул, свят, вихідних, сесії та практики. */
export function teachingDays(semester: SemesterInput): IsoDate[] {
  const blocked = semester.periods.filter((p) => NON_TEACHING.has(p.kind));
  return eachDay(semester.startDate, semester.endDate).filter(
    (date) => isoWeekday(date) <= 6 && !blocked.some((p) => inRange(date, p.startDate, p.endDate)),
  );
}
