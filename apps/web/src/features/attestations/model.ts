import { parseFinal } from '@ge/domain';
import type { AttestationStudent, GradingRules, Scale } from '@ge/shared';

import type { ResultInput } from '../../api/attestations';

/** Поточне значення поля: чернетка, збережена оцінка або пропозиція системи. */
export const fieldValue = (
  student: Pick<AttestationStudent, 'proposal' | 'result'>,
  draft: string | undefined,
): string => draft ?? student.result?.final ?? student.proposal.text;

export type RowState = 'confirmed' | 'edited' | 'proposed';

export function rowState(
  student: Pick<AttestationStudent, 'proposal' | 'result'>,
  draft: string | undefined,
): RowState {
  if (student.result?.confirmed) return 'confirmed';
  return fieldValue(student, draft) === student.proposal.text ? 'proposed' : 'edited';
}

/** Помилка введеної оцінки або null, якщо значення коректне. */
export function fieldError(scale: Scale, value: string): string | null {
  const parsed = parseFinal(scale, value);
  return parsed.ok ? null : parsed.reason;
}

/** Підтвердження одного студента значенням поля. */
export function confirmInput(
  student: Pick<AttestationStudent, 'enrollmentId' | 'proposal' | 'result'>,
  draft: string | undefined,
  comment?: string,
): ResultInput {
  const text = comment ?? student.result?.comment ?? null;
  return {
    enrollmentId: student.enrollmentId,
    final: fieldValue(student, draft),
    comment: text === '' ? null : text,
    confirmed: true,
  };
}

/** Зняття підтвердження: значення лишається, поле знову редагується. */
export function reopenInput(
  student: Pick<AttestationStudent, 'enrollmentId' | 'result'>,
): ResultInput {
  return {
    enrollmentId: student.enrollmentId,
    final: student.result?.final ?? null,
    comment: student.result?.comment ?? null,
    confirmed: false,
  };
}

/** «Прийняти всі пропозиції»: усі непідтверджені студенти отримують оцінку за пропозицією системи. */
export function acceptAllInputs(
  students: readonly AttestationStudent[],
  drafts: Readonly<Record<string, string>>,
  comments: Readonly<Record<string, string>> = {},
): ResultInput[] {
  return students
    .filter((s) => !s.result?.confirmed)
    .map((s) => confirmInput(s, drafts[s.enrollmentId], comments[s.enrollmentId]));
}

const WEIGHT_NAMES = {
  TEST: 'контрольні',
  PRACTICE: 'практичні',
  LAB: 'лабораторні',
  ORAL: 'усні',
} as const;

const fmtWeight = (w: number): string => String(w).replace('.', ',');

/** Правило розрахунку пропонованої оцінки зрозумілою мовою (за правилами навантаження). */
export function rulesSummary(
  rules: Pick<GradingRules, 'weights' | 'minGrades' | 'maxUnexcusedAbsencePercent'>,
): string {
  const weights = (Object.keys(WEIGHT_NAMES) as (keyof typeof WEIGHT_NAMES)[])
    .map((k) => `${WEIGHT_NAMES[k]} ×${fmtWeight(rules.weights[k] ?? 1)}`)
    .join(', ');
  return `Зважене середнє всіх оцінок за період: ${weights}. Округлення до цілого (8,5 → 9). Пропонується «н/а», якщо оцінок менше ${String(rules.minGrades)} або неповажних пропусків понад ${String(rules.maxUnexcusedAbsencePercent)}%. Фінальну оцінку ставите ви.`;
}

export const confirmedCount = (students: readonly Pick<AttestationStudent, 'result'>[]): number =>
  students.filter((s) => s.result?.confirmed).length;
