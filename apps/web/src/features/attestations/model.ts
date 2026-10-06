import { parseFinal } from '@ge/domain';
import type { AttestationStudent, Scale } from '@ge/shared';

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
): ResultInput {
  return {
    enrollmentId: student.enrollmentId,
    final: fieldValue(student, draft),
    comment: student.result?.comment ?? null,
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
): ResultInput[] {
  return students
    .filter((s) => !s.result?.confirmed)
    .map((s) => confirmInput(s, drafts[s.enrollmentId]));
}

export const confirmedCount = (students: readonly Pick<AttestationStudent, 'result'>[]): number =>
  students.filter((s) => s.result?.confirmed).length;
