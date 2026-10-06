import { create } from 'zustand';

import { db, type NoticeRecord } from './db';

export interface SyncState {
  /** Є зв'язок із сервером (за подіями браузера й результатами останніх запитів). */
  online: boolean;
  syncing: boolean;
  /** Скільки змін ще не відправлено на сервер. */
  pending: number;
  lastSyncAt: string | null;
  /** auth — сесія завершилась, потрібен новий вхід; server — сервер відповідає помилкою. */
  problem: 'auth' | 'server' | null;
  notices: NoticeRecord[];
}

export const useSyncStore = create<SyncState>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  lastSyncAt: null,
  problem: null,
  notices: [],
}));

// Стан зв'язку відстежується з моменту завантаження модуля, а не лише після старту синхронізації
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.setState({ online: true });
  });
  window.addEventListener('offline', () => {
    useSyncStore.setState({ online: false });
  });
}

/** Перечитує лічильники з локальної бази. */
export async function refreshSyncStatus(): Promise<void> {
  const [pending, notices] = await Promise.all([
    db.outbox.count(),
    db.notices.orderBy('createdAt').toArray(),
  ]);
  useSyncStore.setState({ pending, notices });
}

export async function dismissNotices(): Promise<void> {
  await db.notices.clear();
  await refreshSyncStatus();
}
