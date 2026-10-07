import type { GradebookDto, SyncOp } from '@ge/shared';

import { fetchGradebook } from '../api/teaching';
import { setAssessmentCell } from '../features/gradebook/model';

import { getMeta, setMeta, db } from './db';
import { isNetworkError } from './network';

type Range = { from?: string; to?: string };
const keyOf = (loadId: string, range: Range) =>
  `gradebook:${loadId}:${range.from ?? ''}:${range.to ?? ''}`;

/** Накладає оцінки колонок із черги, що ще не дійшли до сервера, поверх журналу. */
export function applyOpsToGradebook(dto: GradebookDto, ops: readonly SyncOp[]): GradebookDto {
  return ops.reduce((acc, op) => {
    if (op.type === 'assessment.grade.set')
      return setAssessmentCell(acc, op.enrollmentId, op.assessmentId, op.value);
    if (op.type === 'assessment.grade.clear')
      return setAssessmentCell(acc, op.enrollmentId, op.assessmentId, null);
    return acc;
  }, dto);
}

/** Непідтверджені оцінки колонок цього журналу (у порядку створення). */
export async function pendingAssessmentOps(dto: GradebookDto): Promise<SyncOp[]> {
  const ids = new Set(dto.assessments.map((a) => a.id));
  const rows = await db.outbox.orderBy('seq').toArray();
  return rows
    .map((r) => r.op)
    .filter(
      (op) =>
        (op.type === 'assessment.grade.set' || op.type === 'assessment.grade.clear') &&
        ids.has(op.assessmentId),
    );
}

/**
 * Журнал для екрана: з мережі (остання відповідь запам'ятовується) або, коли зв'язку немає,
 * з локальної копії; зміни з черги накладаються поверх, щоб користувач бачив власні оцінки.
 */
export async function loadGradebook(loadId: string, range: Range): Promise<GradebookDto> {
  const key = keyOf(loadId, range);
  let dto: GradebookDto;
  try {
    dto = await fetchGradebook(loadId, range);
    await setMeta(`cache:${key}`, dto).catch(() => undefined);
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const stored = await getMeta<GradebookDto>(`cache:${key}`);
    if (stored === undefined) throw error;
    dto = stored;
  }
  return applyOpsToGradebook(dto, await pendingAssessmentOps(dto));
}
