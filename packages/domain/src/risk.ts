import type { Scale } from '@ge/shared';

import { SCALE_RANGE } from './moduleProposal.js';

export type RiskReason = 'LOW_GRADE' | 'ABSENCES';

/** Поріг низького балу — третина шкали (4 з 12, ≈1,7 з 5). */
export const LOW_GRADE_FRACTION = 1 / 3;
/** Поріг пропусків для зони ризику, % (концепт: понад 30%). */
export const RISK_ABSENCE_PERCENT = 30;

/**
 * Чому студент у «зоні ризику»: низький середній бал або багато неповажних пропусків.
 * TODO(OQ-19): пороги ризику уточнити за положенням закладу; зараз — за концептом.
 */
export function riskReasons(input: {
  average: number | null;
  absencePercent: number;
  scale: Scale;
}): RiskReason[] {
  const reasons: RiskReason[] = [];
  const { max } = SCALE_RANGE[input.scale];
  if (input.average !== null && input.average < max * LOW_GRADE_FRACTION) reasons.push('LOW_GRADE');
  if (input.absencePercent > RISK_ABSENCE_PERCENT) reasons.push('ABSENCES');
  return reasons;
}
