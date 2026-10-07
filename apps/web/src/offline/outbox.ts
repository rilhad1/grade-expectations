import { uuidv7, type LessonDetailDto, type SyncOp } from '@ge/shared';

import { applyOpToDetail, applyOps } from './applyOp';
import { db } from './db';
import { refreshSyncStatus } from './syncStore';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** Операція без службових полів: `opId` і `at` проставляє outbox. */
export type NewOp = DistributiveOmit<SyncOp, 'opId' | 'at'>;

let onSubmit: () => void = () => undefined;
/** Воркер синхронізації підписується, щоб відправляти зміни одразу, коли є мережа. */
export function setSubmitHook(hook: () => void): void {
  onSubmit = hook;
}

/**
 * Єдина точка запису на парі: зміна застосовується до локальної копії заняття й потрапляє в чергу
 * в одній транзакції Dexie — UI реагує миттєво, а на сервер зміна піде, щойно з'явиться зв'язок.
 */
export async function submitOp(input: NewOp): Promise<SyncOp> {
  const op = { ...input, opId: uuidv7(), at: new Date().toISOString() };
  const scope = opScope(op);
  await db.transaction('rw', db.lessons, db.outbox, async () => {
    if ('lessonId' in op) {
      const record = await db.lessons.get(op.lessonId);
      if (record) await db.lessons.put({ ...record, detail: applyOpToDetail(record.detail, op) });
    }
    await db.outbox.add({ opId: op.opId, lessonId: scope, op });
  });
  await refreshSyncStatus();
  onSubmit();
  return op;
}

/**
 * Область операції в черзі: заняття або колонка оцінювання. Зберігається в полі `lessonId`
 * запису outbox (воно ж індекс), тож операції однієї області легко відібрати.
 */
export const opScope = (op: SyncOp): string => ('lessonId' in op ? op.lessonId : op.assessmentId);

/** Операції заняття, що чекають на відправку (у порядку створення). */
export async function pendingOps(lessonId: string): Promise<SyncOp[]> {
  const rows = await db.outbox.where('lessonId').equals(lessonId).sortBy('seq');
  return rows.map((r) => r.op);
}

/** Стан сервера + ще не відправлені локальні зміни: те, що має бачити користувач. */
export async function rebaseOnPending(detail: LessonDetailDto): Promise<LessonDetailDto> {
  return applyOps(detail, await pendingOps(detail.id));
}
