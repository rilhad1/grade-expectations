import { describe, expect, it } from 'vitest';

import type { SemesterInput } from './types.js';
import { weekParity } from './weekParity.js';

const semester: SemesterInput = {
  startDate: '2026-09-01', // вівторок
  endDate: '2026-12-28',
  firstWeekParity: 'TOP',
  parityAfterBreak: 'CONTINUE',
  periods: [],
};

describe('weekParity', () => {
  it('перший тиждень (з понеділка 31 серпня) — верхній', () => {
    expect(weekParity('2026-08-31', semester)).toBe('TOP');
    expect(weekParity('2026-09-01', semester)).toBe('TOP');
    expect(weekParity('2026-09-06', semester)).toBe('TOP');
  });

  it('наступний тиждень — нижній', () => {
    expect(weekParity('2026-09-07', semester)).toBe('BOTTOM');
    expect(weekParity('2026-09-13', semester)).toBe('BOTTOM');
  });

  it('5 жовтня 2026 — нижній тиждень', () => {
    expect(weekParity('2026-10-05', semester)).toBe('BOTTOM');
  });

  it('враховує firstWeekParity = BOTTOM', () => {
    expect(weekParity('2026-09-01', { ...semester, firstWeekParity: 'BOTTOM' })).toBe('BOTTOM');
    expect(weekParity('2026-09-07', { ...semester, firstWeekParity: 'BOTTOM' })).toBe('TOP');
  });

  describe('після канікул', () => {
    // канікули 26 жовт – 1 лист (7 днів); перший робочий понеділок — 2 листопада
    const withBreak = (parityAfterBreak: 'CONTINUE' | 'RESTART'): SemesterInput => ({
      ...semester,
      parityAfterBreak,
      periods: [{ kind: 'HOLIDAY', startDate: '2026-10-26', endDate: '2026-11-01' }],
    });

    it('CONTINUE: чергування триває; 2 листопада — тиждень №9 (нижній)', () => {
      // тижні від 31.08: 2 листопада — 9-й тиждень (індекс 9) → BOTTOM
      expect(weekParity('2026-11-02', withBreak('CONTINUE'))).toBe('BOTTOM');
    });

    it('RESTART: перший тиждень після канікул знову має парність першого тижня', () => {
      expect(weekParity('2026-11-02', withBreak('RESTART'))).toBe('TOP');
      expect(weekParity('2026-11-09', withBreak('RESTART'))).toBe('BOTTOM');
    });

    it('RESTART не впливає на дати до канікул', () => {
      expect(weekParity('2026-10-05', withBreak('RESTART'))).toBe('BOTTOM');
    });

    it('RESTART: періоди інших видів (не HOLIDAY) відлік не скидають', () => {
      const other: SemesterInput = {
        ...semester,
        parityAfterBreak: 'RESTART',
        periods: [{ kind: 'EXAM_SESSION', startDate: '2026-10-12', endDate: '2026-10-25' }],
      };
      expect(weekParity('2026-10-26', other)).toBe(weekParity('2026-10-26', semester));
    });

    it('RESTART: коротке свято (менше 7 днів) відлік не скидає', () => {
      const short: SemesterInput = {
        ...semester,
        parityAfterBreak: 'RESTART',
        periods: [{ kind: 'HOLIDAY', startDate: '2026-10-14', endDate: '2026-10-14' }],
      };
      expect(weekParity('2026-10-19', short)).toBe(weekParity('2026-10-19', semester));
    });

    it('RESTART: канікули, що закінчуються посеред тижня, відкривають новий відлік з наступного понеділка того тижня', () => {
      const midweek: SemesterInput = {
        ...semester,
        parityAfterBreak: 'RESTART',
        periods: [{ kind: 'HOLIDAY', startDate: '2026-10-26', endDate: '2026-11-04' }],
      };
      expect(weekParity('2026-11-05', midweek)).toBe('TOP');
    });

    it('RESTART: два періоди канікул — діє останній, що закінчився до дати', () => {
      const two: SemesterInput = {
        ...semester,
        parityAfterBreak: 'RESTART',
        periods: [
          { kind: 'HOLIDAY', startDate: '2026-10-05', endDate: '2026-10-11' },
          { kind: 'HOLIDAY', startDate: '2026-11-02', endDate: '2026-11-08' },
        ],
      };
      expect(weekParity('2026-10-12', two)).toBe('TOP');
      expect(weekParity('2026-10-19', two)).toBe('BOTTOM');
      expect(weekParity('2026-11-09', two)).toBe('TOP');
    });
  });
});
