import { describe, expect, it } from 'vitest';

import { isoDateSchema } from './common.js';
import { scheduleSlotSchema, semesterSchema } from './entities.js';
import { defaultGradingRules, gradingRulesSchema } from './gradingRules.js';
import { uuidv7 } from './uuid.js';

describe('isoDateSchema', () => {
  it('приймає коректну дату', () => {
    expect(isoDateSchema.safeParse('2026-10-05').success).toBe(true);
  });
  it.each(['2026-02-30', '2026-13-01', '05.10.2026', '2026-1-1'])('відхиляє %s', (v) => {
    expect(isoDateSchema.safeParse(v).success).toBe(false);
  });
});

describe('gradingRulesSchema', () => {
  it('значення за замовчуванням валідні', () => {
    expect(gradingRulesSchema.safeParse(defaultGradingRules).success).toBe(true);
  });
  it('відхиляє від’ємну вагу й поріг понад 100%', () => {
    expect(
      gradingRulesSchema.safeParse({ ...defaultGradingRules, weights: { TEST: -1 } }).success,
    ).toBe(false);
    expect(
      gradingRulesSchema.safeParse({ ...defaultGradingRules, maxUnexcusedAbsencePercent: 120 })
        .success,
    ).toBe(false);
  });
});

describe('semesterSchema / scheduleSlotSchema', () => {
  it('семестр: початок не пізніше за кінець', () => {
    const base = {
      id: uuidv7(),
      academicYearId: uuidv7(),
      number: 1,
      firstWeekParity: 'TOP',
      parityAfterBreak: 'CONTINUE',
    };
    expect(
      semesterSchema.safeParse({ ...base, startDate: '2026-09-01', endDate: '2026-12-28' }).success,
    ).toBe(true);
    expect(
      semesterSchema.safeParse({ ...base, startDate: '2026-12-28', endDate: '2026-09-01' }).success,
    ).toBe(false);
  });

  it('слот: weekday 1..6, validFrom ≤ validTo', () => {
    const base = {
      id: uuidv7(),
      scheduleId: uuidv7(),
      loadId: uuidv7(),
      pairNumber: 1,
      parity: 'EVERY',
      roomId: null,
      validFrom: '2026-09-01',
      validTo: null,
    };
    expect(scheduleSlotSchema.safeParse({ ...base, weekday: 6 }).success).toBe(true);
    expect(scheduleSlotSchema.safeParse({ ...base, weekday: 7 }).success).toBe(false);
    expect(
      scheduleSlotSchema.safeParse({ ...base, weekday: 1, validTo: '2026-08-01' }).success,
    ).toBe(false);
  });
});
