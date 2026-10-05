import type { GradingRules, Scale } from '@ge/shared';

import type { AttendanceInput, DateRange, GradeInput } from './types.js';

export type ModuleProposal =
  { value: number; explanation: string } | { value: 'NA'; explanation: string };

const SCALE_RANGE: Record<Scale, { min: number; max: number }> = {
  TWELVE: { min: 1, max: 12 },
  FIVE: { min: 1, max: 5 },
  HUNDRED: { min: 0, max: 100 },
  PASS_FAIL: { min: 0, max: 1 },
};

/** Округлення половини вгору (8,5 → 9); поправка на похибку double. */
const roundHalfUp = (x: number): number => Math.floor(x + 0.5 + 1e-9);

const fmt = (x: number): string => (Math.round(x * 10) / 10).toString().replace('.', ',');

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'оцінки';
  return 'оцінок';
}

/**
 * Пропонована оцінка модуля за період: зважене середнє, округлення до шкали.
 * «NA» (н/а), якщо оцінок менше minGrades або неповажних пропусків більше порогу.
 */
export function computeModuleProposal(
  grades: readonly GradeInput[],
  attendance: readonly AttendanceInput[],
  rules: GradingRules,
  period: DateRange,
): ModuleProposal {
  const inPeriod = (date: string) => date >= period.from && date <= period.to;

  const counted = grades
    .filter((g) => inPeriod(g.date))
    .flatMap((g) => {
      if (g.missed === true) return rules.missedTest === 'ZERO' ? [{ ...g, value: 0 }] : [];
      return [g];
    });

  const records = attendance.filter((a) => inPeriod(a.date));
  const unexcused = records.filter((a) => a.status === 'ABSENT').length;
  const absencePercent = records.length === 0 ? 0 : (unexcused / records.length) * 100;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const grade of counted) {
    const weight = rules.weights[grade.kind] ?? 1;
    weightedSum += grade.value * weight;
    weightTotal += weight;
  }
  const average = weightTotal === 0 ? null : weightedSum / weightTotal;
  const absenceText = `пропуски ${Math.round(absencePercent)}%`;

  const reasons: string[] = [];
  if (counted.length < rules.minGrades || average === null) {
    reasons.push(`замало оцінок: ${counted.length} з ${rules.minGrades}`);
  }
  if (absencePercent > rules.maxUnexcusedAbsencePercent) {
    reasons.push(
      `неповажні пропуски ${Math.round(absencePercent)}% понад ${rules.maxUnexcusedAbsencePercent}%`,
    );
  }
  if (reasons.length > 0 || average === null) {
    return { value: 'NA', explanation: reasons.join('; ') };
  }

  const { min, max } = SCALE_RANGE[rules.scale];
  const value = Math.min(max, Math.max(min, roundHalfUp(average)));
  return {
    value,
    explanation: `середнє ${fmt(average)} з ${counted.length} ${plural(counted.length)}, ${absenceText}`,
  };
}

/** Модуль AVERAGE: те саме зважене середнє, але за весь семестр. */
export function computeSemesterAverage(
  grades: readonly GradeInput[],
  attendance: readonly AttendanceInput[],
  rules: GradingRules,
  semester: DateRange,
): ModuleProposal {
  return computeModuleProposal(grades, attendance, rules, semester);
}
