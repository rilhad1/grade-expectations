import { z } from 'zod';

import { uuidSchema } from '../common.js';

/** Курсорна пагінація: id — UUID v7, тож сортування за id збігається з порядком створення. */
export const pageQuerySchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: uuidSchema.nullable() });

/** Оптимістична перевірка версії для структурних даних (розклад, навантаження, довідники). */
export const versionSchema = z.object({ version: z.number().int().nonnegative() });

/** id генерує клієнт (UUID v7), щоб запис можна було створити офлайн. */
export const clientIdSchema = uuidSchema.optional();

export const idParamSchema = z.object({ id: uuidSchema });
