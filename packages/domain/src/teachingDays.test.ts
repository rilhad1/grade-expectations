import { describe, expect, it } from 'vitest';

import { teachingDays } from './teachingDays.js';
import type { SemesterInput } from './types.js';

const base: SemesterInput = {
  startDate: '2026-09-01',
  endDate: '2026-09-14',
  firstWeekParity: 'TOP',
  parityAfterBreak: 'CONTINUE',
  periods: [],
};

describe('teachingDays', () => {
  it('повертає Пн–Сб і пропускає неділі', () => {
    const days = teachingDays(base);
    expect(days).toHaveLength(12); // 1–14 вер: 14 днів мінус 2 неділі (6 і 13)
    expect(days).not.toContain('2026-09-06');
    expect(days).not.toContain('2026-09-13');
    expect(days).toContain('2026-09-05'); // субота
  });

  it('пропускає дні в періодах HOLIDAY, DAY_OFF, EXAM_SESSION, PRACTICE', () => {
    const days = teachingDays({
      ...base,
      periods: [
        { kind: 'HOLIDAY', startDate: '2026-09-02', endDate: '2026-09-02' },
        { kind: 'DAY_OFF', startDate: '2026-09-03', endDate: '2026-09-03' },
        { kind: 'EXAM_SESSION', startDate: '2026-09-04', endDate: '2026-09-04' },
        { kind: 'PRACTICE', startDate: '2026-09-05', endDate: '2026-09-05' },
      ],
    });
    expect(days.slice(0, 3)).toEqual(['2026-09-01', '2026-09-07', '2026-09-08']);
  });

  it('не пропускає періоди атестацій (вони навчальні)', () => {
    const days = teachingDays({
      ...base,
      periods: [{ kind: 'INTERIM_ATTESTATION', startDate: '2026-09-01', endDate: '2026-09-14' }],
    });
    expect(days).toHaveLength(12);
  });

  it('межі включно', () => {
    const days = teachingDays(base);
    expect(days[0]).toBe('2026-09-01');
    expect(days.at(-1)).toBe('2026-09-14');
  });
});
