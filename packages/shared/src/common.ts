import { z } from 'zod';

/** Дата без часу у форматі YYYY-MM-DD (і календарно коректна). */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Очікується дата у форматі YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Неіснуюча дата');
export type IsoDate = z.infer<typeof isoDateSchema>;

export const uuidSchema = z.uuid();

/** Службові поля синхронізації, присутні у кожній змінюваній сутності. */
export const syncFieldsSchema = z.object({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().nonnegative(),
  deletedAt: z.iso.datetime().nullable(),
});
export type SyncFields = z.infer<typeof syncFieldsSchema>;
