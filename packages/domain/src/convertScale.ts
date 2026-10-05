import type { Scale } from '@ge/shared';

export interface ScaleRange {
  min: number;
  max: number;
  to: number;
}

export interface ScaleConversion {
  from: Scale;
  to: Scale;
  ranges: readonly ScaleRange[];
}

/** Таблиці переведення — це дані, а не код: у закладах вони різняться. */
export const defaultScaleTable: readonly ScaleConversion[] = [
  {
    from: 'TWELVE',
    to: 'FIVE',
    ranges: [
      { min: 10, max: 12, to: 5 },
      { min: 7, max: 9, to: 4 },
      { min: 4, max: 6, to: 3 },
      { min: 1, max: 3, to: 2 },
    ],
  },
];

/**
 * Переводить значення між шкалами за таблицею.
 * Повертає null, якщо таблиці немає або значення поза діапазонами.
 */
export function convertScale(
  value: number,
  from: Scale,
  to: Scale,
  table: readonly ScaleConversion[] = defaultScaleTable,
): number | null {
  if (from === to) return value;
  const conversion = table.find((c) => c.from === from && c.to === to);
  const range = conversion?.ranges.find((r) => value >= r.min && value <= r.max);
  return range?.to ?? null;
}
