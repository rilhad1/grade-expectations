import type { LessonItemDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import { canRequestMove, lessonsAt, shiftWeek, weekDays, weekEnd, weekStartOf } from './model';

describe('тиждень', () => {
  it('понеділок тижня й зсув на тиждень', () => {
    expect(weekStartOf('2026-10-07')).toBe('2026-10-05'); // середа
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05'); // неділя
    expect(shiftWeek('2026-10-05', 1)).toBe('2026-10-12');
    expect(shiftWeek('2026-10-05', -2)).toBe('2026-09-21');
  });
  it('дні тижня Пн–Сб', () => {
    expect(weekDays('2026-10-05')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
    expect(weekEnd('2026-10-05')).toBe('2026-10-10');
  });
});

describe('заняття', () => {
  const l = (date: string, pairNumber: number, status = 'PLANNED') =>
    ({ id: `${date}${pairNumber}`, date, pairNumber, status }) as LessonItemDto;
  it('вибір за днем і парою', () => {
    const all = [l('2026-10-05', 2), l('2026-10-05', 3), l('2026-10-06', 2)];
    expect(lessonsAt(all, '2026-10-05', 2).map((x) => x.id)).toEqual(['2026-10-052']);
    expect(lessonsAt(all, '2026-10-07', 1)).toEqual([]);
  });
  it('запит на перенесення: лише майбутні заплановані', () => {
    expect(canRequestMove(l('2026-10-12', 2), '2026-10-06')).toBe(true);
    expect(canRequestMove(l('2026-10-06', 2), '2026-10-06')).toBe(true);
    expect(canRequestMove(l('2026-10-05', 2), '2026-10-06')).toBe(false);
    expect(canRequestMove(l('2026-10-12', 2, 'HELD'), '2026-10-06')).toBe(false);
    expect(canRequestMove(l('2026-10-12', 2, 'CANCELLED'), '2026-10-06')).toBe(false);
  });
});
