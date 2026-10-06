import { describe, expect, it } from 'vitest';

import { riskReasons } from './risk.js';

describe('riskReasons', () => {
  it('низький бал: нижче третини шкали', () => {
    expect(riskReasons({ average: 3.9, absencePercent: 0, scale: 'TWELVE' })).toEqual([
      'LOW_GRADE',
    ]);
    expect(riskReasons({ average: 4, absencePercent: 0, scale: 'TWELVE' })).toEqual([]);
  });
  it('шкала враховується: 5-бальна', () => {
    expect(riskReasons({ average: 1.6, absencePercent: 0, scale: 'FIVE' })).toEqual(['LOW_GRADE']);
    expect(riskReasons({ average: 2, absencePercent: 0, scale: 'FIVE' })).toEqual([]);
  });
  it('пропуски: понад 30%, на порозі — ні', () => {
    expect(riskReasons({ average: 9, absencePercent: 30.5, scale: 'TWELVE' })).toEqual([
      'ABSENCES',
    ]);
    expect(riskReasons({ average: 9, absencePercent: 30, scale: 'TWELVE' })).toEqual([]);
  });
  it('обидві причини; без оцінок бал не рахується', () => {
    expect(riskReasons({ average: 2, absencePercent: 50, scale: 'TWELVE' })).toEqual([
      'LOW_GRADE',
      'ABSENCES',
    ]);
    expect(riskReasons({ average: null, absencePercent: 0, scale: 'TWELVE' })).toEqual([]);
  });
});
