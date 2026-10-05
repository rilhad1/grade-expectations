import type { IsoDate } from '@ge/shared';

const MS_PER_DAY = 86_400_000;

export function parseIsoDate(value: IsoDate): number {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function formatIsoDate(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return formatIsoDate(parseIsoDate(value) + days * MS_PER_DAY);
}

/** 1 = понеділок … 7 = неділя */
export function isoWeekday(value: IsoDate): number {
  const day = new Date(parseIsoDate(value)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function mondayOf(value: IsoDate): IsoDate {
  return addDays(value, 1 - isoWeekday(value));
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((parseIsoDate(a) - parseIsoDate(b)) / MS_PER_DAY);
}

export function inRange(date: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return date >= from && date <= to;
}

/** Усі дати від from до to включно. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}
