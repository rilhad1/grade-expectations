import { describe, expect, it } from 'vitest';

import { convertScale } from './convertScale.js';

describe('convertScale', () => {
  it.each([
    [12, 5],
    [10, 5],
    [9, 4],
    [7, 4],
    [6, 3],
    [4, 3],
    [3, 2],
    [1, 2],
  ])('12-бальна %i → 5-бальна %i', (value, expected) => {
    expect(convertScale(value, 'TWELVE', 'FIVE')).toBe(expected);
  });

  it('та сама шкала повертає значення', () => {
    expect(convertScale(7, 'TWELVE', 'TWELVE')).toBe(7);
  });

  it('значення поза таблицею або відсутня таблиця → null', () => {
    expect(convertScale(0, 'TWELVE', 'FIVE')).toBeNull();
    expect(convertScale(13, 'TWELVE', 'FIVE')).toBeNull();
    expect(convertScale(80, 'HUNDRED', 'TWELVE')).toBeNull();
  });

  it('використовує власну таблицю закладу', () => {
    const table = [
      { from: 'HUNDRED', to: 'TWELVE', ranges: [{ min: 90, max: 100, to: 12 }] },
    ] as const;
    expect(convertScale(95, 'HUNDRED', 'TWELVE', table)).toBe(12);
  });
});
