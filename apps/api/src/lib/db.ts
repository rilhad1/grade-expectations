import { uuidv7 } from '@ge/shared';

import { conflict, notFound } from '../errors.js';

/** 'YYYY-MM-DD' → Date (UTC-північ) для колонок @db.Date. */
export const dateOf = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const isoOf = (date: Date): string => date.toISOString().slice(0, 10);
export const isoOrNull = (date: Date | null): string | null => (date ? isoOf(date) : null);

export const newId = (clientId?: string): string => clientId ?? uuidv7();

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Обрізає вибірку, отриману з take = limit + 1, і обчислює наступний курсор. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? last.id : null };
}

/** Аргументи Prisma для курсорної пагінації за id (UUID v7 — порядок створення). */
export const pageArgs = (cursor: string | undefined, limit: number) => ({
  orderBy: { id: 'asc' as const },
  take: limit + 1,
  ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
});

/**
 * Оптимістичне оновлення за версією: update() має робити updateMany з умовою version
 * і version: { increment: 1 }. 404, якщо запису немає; 409, якщо версія застаріла.
 */
export async function versionedUpdate<T>(opts: {
  update: () => Promise<{ count: number }>;
  load: () => Promise<T | null>;
  what: string;
}): Promise<T> {
  const { count } = await opts.update();
  const row = await opts.load();
  if (!row) throw notFound(`${opts.what} не знайдено`);
  if (count === 0) {
    throw conflict('VERSION_CONFLICT', `${opts.what} змінено на іншому пристрої; оновіть дані`);
  }
  return row;
}

/** Відкидає ключі зі значенням undefined (Prisma із exactOptionalPropertyTypes не приймає їх у data). */
export function definedOnly<T extends object>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}
