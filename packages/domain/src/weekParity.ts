import type { IsoDate, WeekParity } from '@ge/shared';

import { addDays, diffDays, mondayOf } from './dates.js';
import type { SemesterInput } from './types.js';

/**
 * Мінімальна тривалість (днів) періоду HOLIDAY, після якого працює parityAfterBreak.
 * Одиничні святкові дні відлік не скидають.
 * TODO(OQ-13): уточнити, які саме канікули скидають парність у закладі.
 */
export const MIN_BREAK_DAYS = 7;

const flip = (parity: WeekParity): WeekParity => (parity === 'TOP' ? 'BOTTOM' : 'TOP');

/** Понеділок тижня, з якого іде відлік парності для дати. */
function parityAnchor(date: IsoDate, semester: SemesterInput): IsoDate {
  const semesterAnchor = mondayOf(semester.startDate);
  if (semester.parityAfterBreak === 'CONTINUE') return semesterAnchor;

  let anchor = semesterAnchor;
  for (const period of semester.periods) {
    if (period.kind !== 'HOLIDAY') continue;
    if (diffDays(period.endDate, period.startDate) + 1 < MIN_BREAK_DAYS) continue;
    const resume = mondayOf(addDays(period.endDate, 1));
    if (resume <= date && resume > anchor) anchor = resume;
  }
  return anchor;
}

/** Верхній чи нижній тиждень для дати: відлік від понеділка першого тижня (або після канікул). */
export function weekParity(date: IsoDate, semester: SemesterInput): WeekParity {
  const anchor = parityAnchor(date, semester);
  const weeks = Math.floor(diffDays(date, anchor) / 7);
  const even = weeks % 2 === 0;
  return even ? semester.firstWeekParity : flip(semester.firstWeekParity);
}
