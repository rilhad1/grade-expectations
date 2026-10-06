import type { GradingRules } from '@ge/shared';

export const WEIGHT_KINDS = ['ORAL', 'PRACTICE', 'LAB', 'TEST'] as const;

/** Підсумок плану: сума годин тем проти годин навантаження. */
export function planBalance(
  topics: readonly { hours: number }[],
  plannedHours: number,
): { total: number; diff: number } {
  const total = topics.reduce((s, t) => s + t.hours, 0);
  return { total, diff: total - plannedHours };
}

/** Переставляє елемент списку (для кнопок «вище/нижче»); межі ігноруються. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
}

/** Ваги з форми (рядки) у правила; порожні й некоректні значення відкидаються. */
export function weightsFromForm(
  form: Partial<Record<(typeof WEIGHT_KINDS)[number], string>>,
): GradingRules['weights'] {
  const weights: GradingRules['weights'] = {};
  for (const kind of WEIGHT_KINDS) {
    const raw = form[kind]?.replace(',', '.');
    const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
    if (Number.isFinite(n) && n > 0) weights[kind] = n;
  }
  return weights;
}
