import type { LessonDetailDto, SyncOp } from '@ge/shared';
import Dexie, { type EntityTable } from 'dexie';

export interface LessonRecord {
  id: string;
  date: string;
  detail: LessonDetailDto;
}

export interface OutboxRecord {
  seq?: number;
  opId: string;
  lessonId: string;
  op: SyncOp;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

/** Повідомлення користувачу про результат синхронізації (відмови, програш у конфлікті). */
export interface NoticeRecord {
  id: string;
  kind: 'rejected' | 'superseded';
  message: string;
  createdAt: string;
}

/**
 * Локальна копія активного семестру на пристрої: заняття вікна ±2 тижні з відмітками й оцінками,
 * черга змін (outbox), службові значення (курсор, кеш довідників). Вихід з акаунта очищує все.
 */
class OfflineDb extends Dexie {
  lessons!: EntityTable<LessonRecord, 'id'>;
  outbox!: EntityTable<OutboxRecord, 'seq'>;
  meta!: EntityTable<MetaRecord, 'key'>;
  notices!: EntityTable<NoticeRecord, 'id'>;

  constructor() {
    super('ge-offline');
    this.version(1).stores({
      lessons: 'id, date',
      outbox: '++seq, opId, lessonId',
      meta: 'key',
      notices: 'id, createdAt',
    });
  }
}

export const db = new OfflineDb();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Повне очищення локальної бази (вихід з акаунта, зміна користувача). */
export async function clearOfflineData(): Promise<void> {
  await db.transaction('rw', [db.lessons, db.outbox, db.meta, db.notices], async () => {
    await Promise.all([db.lessons.clear(), db.outbox.clear(), db.meta.clear(), db.notices.clear()]);
  });
}
