import {
  pullResponseSchema,
  pushResponseSchema,
  uuidv7,
  type PullResponse,
  type PushResponse,
  type SyncOp,
} from '@ge/shared';

import { ApiError, get, post } from '../api/http';

import { applyOps } from './applyOp';
import { clearOfflineData, db, getMeta, setMeta } from './db';
import { isNetworkError } from './network';
import { setSubmitHook } from './outbox';
import { refreshSyncStatus, useSyncStore } from './syncStore';

export interface SyncApi {
  push: (ops: SyncOp[]) => Promise<PushResponse>;
  pull: (since: string | undefined) => Promise<PullResponse>;
}

export const httpSyncApi: SyncApi = {
  push: (ops) => post('/sync/push', { ops }, pushResponseSchema),
  pull: (since) =>
    get(
      `/sync/pull${since === undefined ? '' : `?since=${encodeURIComponent(since)}`}`,
      pullResponseSchema,
    ),
};

const BATCH = 100;
const INTERVAL_MS = 20_000;

/** Відмови, про які користувач має знати. */
function noticeFor(status: 'rejected' | 'superseded', message: string | undefined) {
  return {
    id: uuidv7(),
    kind: status,
    message:
      message ??
      (status === 'rejected'
        ? 'Зміну не збережено на сервері'
        : 'Зміну замінено новішою з іншого пристрою'),
    createdAt: new Date().toISOString(),
  } as const;
}

/** Відправляє чергу пачками. Повертає true, якщо хоч одна зміна не діяла так, як задумано. */
async function pushPending(api: SyncApi): Promise<{ diverged: boolean; pushed: number }> {
  let diverged = false;
  let pushed = 0;
  for (;;) {
    const rows = await db.outbox.orderBy('seq').limit(BATCH).toArray();
    if (rows.length === 0) return { diverged, pushed };

    let response: PushResponse;
    try {
      response = await api.push(rows.map((r) => r.op));
    } catch (error) {
      // Некоректна зміна не має блокувати чергу назавжди: відправляємо по одній
      if (!(error instanceof ApiError) || ![400, 422].includes(error.status) || rows.length === 1) {
        if (error instanceof ApiError && [400, 422].includes(error.status)) {
          await db.outbox.bulkDelete(rows.map((r) => r.seq as number));
          await db.notices.add(noticeFor('rejected', 'Некоректну зміну відхилено сервером'));
          diverged = true;
          continue;
        }
        throw error;
      }
      response = { results: [] };
      for (const row of rows) {
        try {
          response.results.push(...(await api.push([row.op])).results);
        } catch (single) {
          if (!(single instanceof ApiError) || ![400, 422].includes(single.status)) throw single;
          response.results.push({
            opId: row.opId,
            status: 'rejected',
            message: 'Некоректну зміну відхилено сервером',
          });
        }
      }
    }

    const done = new Set(response.results.map((r) => r.opId));
    pushed += done.size;
    await db.transaction('rw', db.outbox, db.notices, async () => {
      await db.outbox.bulkDelete(rows.filter((r) => done.has(r.opId)).map((r) => r.seq as number));
      for (const result of response.results) {
        if (result.status === 'rejected') {
          await db.notices.add(noticeFor('rejected', result.message));
          diverged = true;
        } else if (result.code === 'SUPERSEDED') {
          await db.notices.add(noticeFor('superseded', result.message));
          diverged = true;
        }
      }
    });
    if (done.size === 0) return { diverged, pushed }; // сервер нічого не повернув: уникаємо вічного циклу
  }
}

/** Оновлює локальну копію: ще не відправлені зміни накладаються поверх серверного стану. */
async function pullChanges(api: SyncApi, full: boolean): Promise<number> {
  const since = full ? undefined : await getMeta<string>('cursor');
  const response = await api.pull(since);

  await db.transaction('rw', db.lessons, db.outbox, db.meta, async () => {
    const pending = await db.outbox.orderBy('seq').toArray();
    const byLesson = new Map<string, SyncOp[]>();
    for (const row of pending)
      byLesson.set(row.lessonId, [...(byLesson.get(row.lessonId) ?? []), row.op]);

    await db.lessons.bulkPut(
      response.lessons.map((detail) => ({
        id: detail.id,
        date: detail.date,
        detail: applyOps(detail, byLesson.get(detail.id) ?? []),
      })),
    );
    if (response.removedLessonIds.length > 0)
      await db.lessons.bulkDelete(response.removedLessonIds);
    if (since === undefined) {
      // Повний знімок: заняття поза вікном (і зникли з розкладу) без черги змін прибираються
      const keep = new Set(response.lessons.map((l) => l.id));
      const stale = (await db.lessons.toArray())
        .filter((l) => !keep.has(l.id) && !byLesson.has(l.id))
        .map((l) => l.id);
      await db.lessons.bulkDelete(stale);
    }
    await db.meta.put({ key: 'cache:bells', value: response.bells });
    await db.meta.put({ key: 'cursor', value: response.cursor });
  });
  return response.lessons.length + response.removedLessonIds.length;
}

async function syncOnce(api: SyncApi): Promise<void> {
  useSyncStore.setState({ syncing: true });
  try {
    const { diverged, pushed } = await pushPending(api);
    const pulled = await pullChanges(api, diverged);
    if (pushed > 0 || pulled > 0) onSynced();
    useSyncStore.setState({
      // Запит міг завершитися вже після втрати зв'язку: довіряємо й стану браузера
      online: navigator.onLine,
      problem: null,
      lastSyncAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isNetworkError(error)) useSyncStore.setState({ online: false });
    else if (error instanceof ApiError && error.status === 401)
      useSyncStore.setState({ problem: 'auth' });
    else useSyncStore.setState({ problem: 'server' });
  } finally {
    useSyncStore.setState({ syncing: false });
    await refreshSyncStatus();
  }
}

let onSynced: () => void = () => undefined;
/** Після відправки чи отримання змін інтерфейс має перечитати заняття. */
export function setOnSynced(hook: () => void): void {
  onSynced = hook;
}

let running: Promise<void> | null = null;
let again = false;

/** Один синхронізатор одночасно; зміни, що з'явилися під час роботи, відправляються наступним колом. */
export function runSync(api: SyncApi = httpSyncApi): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce(api);
      // `again` виставляється з паралельних викликів runSync, поки триває syncOnce
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } while (again && useSyncStore.getState().online);
  })().finally(() => {
    running = null;
  });
  return running;
}

function requestSync(): void {
  if (navigator.onLine) void runSync();
}
setSubmitHook(requestSync);

/** Прив'язує локальну базу до користувача: інший користувач — чиста база. */
export async function bindUser(userId: string): Promise<void> {
  const stored = await getMeta<string>('userId');
  if (stored !== undefined && stored !== userId) await clearOfflineData();
  await setMeta('userId', userId);
}

/** Запускає фонову синхронізацію: за подіями мережі, поверненням на вкладку й таймером. */
export function startSync(): () => void {
  const onOnline = () => {
    void runSync();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') requestSync();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  // У фоновій вкладці таймер не буди: сервер (Render/Neon) засинає, якщо його не смикати.
  // Невідправлені зміни все одно йдуть, щоб нічого не лежало в черзі.
  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') requestSync();
    else
      void db.outbox.count().then((n) => {
        if (n > 0) requestSync();
      });
  }, INTERVAL_MS);

  useSyncStore.setState({ online: navigator.onLine });
  void refreshSyncStatus();
  requestSync();
  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(timer);
  };
}

/**
 * Вихід з акаунта: спершу намагаємось відправити накопичене; якщо не вдалося, користувач
 * вирішує, чи втратити незбережені зміни. Повертає false, якщо вихід скасовано.
 */
export async function prepareLogout(confirm: (pending: number) => boolean): Promise<boolean> {
  if (navigator.onLine) await runSync();
  const pending = await db.outbox.count();
  if (pending > 0 && !confirm(pending)) return false;
  await clearOfflineData();
  await refreshSyncStatus();
  return true;
}
