import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '../common.js';
import { ParityAfterBreak, PeriodKind, SemesterStatus, WeekParity } from '../enums.js';

import { clientIdSchema, versionSchema } from './common.js';

// ── Навчальний рік ───────────────────────────────────
export const academicYearDtoSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  version: z.number().int(),
});
export type AcademicYearDto = z.infer<typeof academicYearDtoSchema>;

const yearFields = z.object({
  title: z.string().trim().min(1).max(50),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});
const endAfterStart = (v: { startDate: string; endDate: string }) => v.startDate <= v.endDate;
const rangeMessage = { message: 'Початок пізніше за кінець', path: ['endDate'] };

export const createAcademicYearSchema = yearFields
  .extend({ id: clientIdSchema })
  .refine(endAfterStart, rangeMessage);
export const updateAcademicYearSchema = yearFields.partial().extend(versionSchema.shape);

// ── Період семестру ──────────────────────────────────
export const periodInputSchema = z
  .object({
    kind: PeriodKind.schema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    title: z.string().trim().max(100).nullable().default(null),
  })
  .refine(endAfterStart, rangeMessage);
export type PeriodInput = z.infer<typeof periodInputSchema>;

export const periodDtoSchema = z.object({
  id: uuidSchema,
  kind: PeriodKind.schema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  title: z.string().nullable(),
});

// ── Семестр ──────────────────────────────────────────
export const semesterDtoSchema = z.object({
  id: uuidSchema,
  academicYearId: uuidSchema,
  number: z.number().int(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  firstWeekParity: WeekParity.schema,
  parityAfterBreak: ParityAfterBreak.schema,
  status: SemesterStatus.schema,
  periods: z.array(periodDtoSchema),
  version: z.number().int(),
});
export type SemesterFullDto = z.infer<typeof semesterDtoSchema>;

// Значення за замовчуванням — лише у схемі створення: у Zod 4 .partial() їх не прибирає,
// і PATCH без поля скидав би його (наприклад, стирав періоди семестру).
const semesterFields = z.object({
  number: z.union([z.literal(1), z.literal(2)]),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  firstWeekParity: WeekParity.schema,
  parityAfterBreak: ParityAfterBreak.schema,
  periods: z.array(periodInputSchema),
});

export const createSemesterSchema = semesterFields
  .extend({
    id: clientIdSchema,
    academicYearId: uuidSchema,
    parityAfterBreak: ParityAfterBreak.schema.default('CONTINUE'),
    periods: z.array(periodInputSchema).default([]),
  })
  .refine(endAfterStart, rangeMessage);

export const updateSemesterSchema = semesterFields
  .omit({ number: true })
  .partial()
  .extend(versionSchema.shape);

export const semesterListQuerySchema = z.object({
  academicYearId: uuidSchema.optional(),
  status: SemesterStatus.schema.optional(),
});

/** Результат копіювання навантаження й шаблону розкладу з іншого семестру. */
export const cloneSemesterResultSchema = z.object({
  copiedLoads: z.number().int(),
  copiedSlots: z.number().int(),
  skipped: z.array(
    z.object({
      sourceLoadId: uuidSchema,
      reason: z.enum(['GROUP_NOT_PROMOTED', 'SUBGROUP_MISSING']),
    }),
  ),
});
export type CloneSemesterResult = z.infer<typeof cloneSemesterResultSchema>;

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
export type CreateSemesterInput = z.infer<typeof createSemesterSchema>;
export type UpdateSemesterInput = z.infer<typeof updateSemesterSchema>;
