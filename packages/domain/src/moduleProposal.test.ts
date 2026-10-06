import type { GradingRules } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import {
  computeModuleProposal,
  computeSemesterAverage,
  weightedAverage,
} from './moduleProposal.js';
import type { AttendanceInput, GradeInput } from './types.js';

const rules: GradingRules = {
  scale: 'TWELVE',
  weights: { TEST: 2, LAB: 1.5, PRACTICE: 1, ORAL: 1 },
  minGrades: 3,
  maxUnexcusedAbsencePercent: 50,
  rounding: 'HALF_UP',
  missedTest: 'IGNORE',
};
const period = { from: '2026-09-01', to: '2026-10-15' };

const g = (
  value: number,
  kind: GradeInput['kind'] = 'ORAL',
  o: Partial<GradeInput> = {},
): GradeInput => ({
  kind,
  value,
  date: '2026-09-10',
  ...o,
});
const att = (status: AttendanceInput['status'], n = 1): AttendanceInput[] =>
  Array.from({ length: n }, () => ({ status, date: '2026-09-10' }));

describe('computeModuleProposal', () => {
  it('зважене середнє з поясненням', () => {
    // (8*1 + 10*2 + 6*1.5) / 4.5 = 37/4.5 = 8.22
    const r = computeModuleProposal(
      [g(8), g(10, 'TEST'), g(6, 'LAB')],
      att('PRESENT', 8),
      rules,
      period,
    );
    expect(r.value).toBe(8);
    expect(r.explanation).toBe('середнє 8,2 з 3 оцінок, пропуски 0%');
  });

  it('округлення 8,5 → 9 (HALF_UP)', () => {
    const r = computeModuleProposal([g(8), g(9), g(8), g(9)], [], rules, period);
    expect(r.value).toBe(9);
  });

  it('округлення нижче половини: 8,4 → 8', () => {
    const r = computeModuleProposal([g(8), g(8), g(8), g(8), g(10)], [], rules, period);
    expect(r.value).toBe(8); // 42/5 = 8,4
  });

  it('жодної оцінки → н/а', () => {
    const r = computeModuleProposal([], [], rules, period);
    expect(r.value).toBe('NA');
    expect(r.explanation).toContain('замало оцінок: 0 з 3');
  });

  it('рівно minGrades — достатньо, на одну менше — н/а', () => {
    expect(computeModuleProposal([g(7), g(7), g(7)], [], rules, period).value).toBe(7);
    expect(computeModuleProposal([g(7), g(7)], [], rules, period).value).toBe('NA');
  });

  it('пропуски рівно на порозі не дають н/а, понад поріг — дають', () => {
    const grades = [g(9), g(9), g(9)];
    const atThreshold = [...att('ABSENT', 5), ...att('PRESENT', 5)]; // 50%
    expect(computeModuleProposal(grades, atThreshold, rules, period).value).toBe(9);
    const over = [...att('ABSENT', 6), ...att('PRESENT', 5)]; // 54,5%
    const r = computeModuleProposal(grades, over, rules, period);
    expect(r.value).toBe('NA');
    expect(r.explanation).toContain('неповажні пропуски 55% понад 50%');
  });

  it('лише поважні пропуски не впливають', () => {
    const r = computeModuleProposal([g(9), g(9), g(9)], att('EXCUSED', 10), rules, period);
    expect(r.value).toBe(9);
    expect(r.explanation).toContain('пропуски 0%');
  });

  it('запізнення не вважається пропуском', () => {
    expect(computeModuleProposal([g(9), g(9), g(9)], att('LATE', 10), rules, period).value).toBe(9);
  });

  it('обидві причини н/а перелічуються разом', () => {
    const r = computeModuleProposal([g(9)], att('ABSENT', 4), rules, period);
    expect(r.explanation).toBe('замало оцінок: 1 з 3; неповажні пропуски 100% понад 50%');
  });

  it('ігнорує оцінки й відвідуваність поза періодом', () => {
    const r = computeModuleProposal(
      [g(9), g(9), g(9), g(1, 'ORAL', { date: '2026-08-01' })],
      att('PRESENT', 2),
      rules,
      period,
    );
    expect(r.value).toBe(9);
    expect(r.explanation).toContain('з 3 оцінок');
  });

  describe('missedTest', () => {
    const grades = [g(10), g(10), g(10, 'TEST', { missed: true })];
    it('IGNORE: пропущена контрольна не враховується', () => {
      const r = computeModuleProposal(grades, [], { ...rules, minGrades: 2 }, period);
      expect(r.value).toBe(10);
    });
    it('ZERO: рахується як 0 з вагою контрольної', () => {
      const r = computeModuleProposal(grades, [], { ...rules, missedTest: 'ZERO' }, period);
      // (10 + 10 + 0*2) / 4 = 5
      expect(r.value).toBe(5);
    });
  });

  it('вага за замовчуванням 1 для типу без явної ваги', () => {
    const r = computeModuleProposal([g(9, 'RETAKE'), g(9), g(9)], [], rules, period);
    expect(r.value).toBe(9);
  });

  it('обмежує результат діапазоном шкали', () => {
    const r = computeModuleProposal([g(15), g(15), g(15)], [], rules, period);
    expect(r.value).toBe(12);
    const five = computeModuleProposal([g(9), g(9), g(9)], [], { ...rules, scale: 'FIVE' }, period);
    expect(five.value).toBe(5);
  });

  it('множина в поясненні: «1 оцінки» за правилом відмінювання', () => {
    const r = computeModuleProposal([g(9)], [], { ...rules, minGrades: 1 }, period);
    expect(r.explanation).toBe('середнє 9 з 1 оцінки, пропуски 0%');
  });
});

describe('computeSemesterAverage', () => {
  it('рахує за весь семестр', () => {
    const grades = [
      g(10, 'ORAL', { date: '2026-09-02' }),
      g(8, 'ORAL', { date: '2026-12-01' }),
      g(9, 'ORAL', { date: '2026-11-01' }),
    ];
    const r = computeSemesterAverage(grades, [], rules, { from: '2026-09-01', to: '2026-12-28' });
    expect(r.value).toBe(9);
  });
});

describe('weightedAverage', () => {
  it('рахує зважене середнє й кількість оцінок', () => {
    // (8*1 + 10*2) / 3
    expect(weightedAverage([g(8), g(10, 'TEST')], rules)).toEqual({ average: 28 / 3, count: 2 });
  });
  it('порожній набір → null', () => {
    expect(weightedAverage([], rules)).toEqual({ average: null, count: 0 });
  });
  it('пропущена контрольна: ігнорується або нуль', () => {
    const grades = [g(10), g(10, 'TEST', { missed: true })];
    expect(weightedAverage(grades, rules)).toEqual({ average: 10, count: 1 });
    expect(weightedAverage(grades, { ...rules, missedTest: 'ZERO' })).toEqual({
      average: 10 / 3,
      count: 2,
    });
  });
});
