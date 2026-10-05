import { z } from 'zod';

import { GradeKind, Scale } from './enums.js';

/**
 * Декларативні правила оцінювання навантаження (зберігаються як JSON у TeachingLoad.gradingRules).
 * Жодних довільних формул чи eval.
 */
export const gradingRulesSchema = z.object({
  scale: Scale.schema,
  weights: z.partialRecord(GradeKind.schema, z.number().positive()).default({}),
  minGrades: z.number().int().nonnegative(),
  maxUnexcusedAbsencePercent: z.number().min(0).max(100),
  rounding: z.literal('HALF_UP'),
  missedTest: z.enum(['IGNORE', 'ZERO']),
});
export type GradingRules = z.infer<typeof gradingRulesSchema>;

/** Значення за замовчуванням; TODO(OQ-1): узгодити з положенням закладу про оцінювання. */
export const defaultGradingRules: GradingRules = {
  scale: 'TWELVE',
  weights: { TEST: 2, LAB: 1.5, PRACTICE: 1, ORAL: 1 },
  minGrades: 3,
  maxUnexcusedAbsencePercent: 50,
  rounding: 'HALF_UP',
  missedTest: 'IGNORE',
};
