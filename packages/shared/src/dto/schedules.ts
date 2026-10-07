import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '../common.js';
import { LessonKind, LessonStatus, ScheduleStatus, SlotParity } from '../enums.js';

import { clientIdSchema, versionSchema } from './common.js';

export const scheduleDtoSchema = z.object({
  id: uuidSchema,
  semesterId: uuidSchema,
  revision: z.number().int(),
  status: ScheduleStatus.schema,
  publishedAt: z.iso.datetime().nullable(),
  slotCount: z.number().int(),
  /** Для чернетки: відрізняється від останньої опублікованої версії («Є неопубліковані зміни»). */
  changedFromPublished: z.boolean(),
  version: z.number().int(),
});
export type ScheduleDto = z.infer<typeof scheduleDtoSchema>;

export const slotDtoSchema = z.object({
  id: uuidSchema,
  scheduleId: uuidSchema,
  loadId: uuidSchema,
  weekday: z.number().int().min(1).max(6),
  pairNumber: z.number().int().min(1),
  parity: SlotParity.schema,
  roomId: uuidSchema.nullable(),
  validFrom: isoDateSchema,
  validTo: isoDateSchema.nullable(),
  version: z.number().int(),
});
export type SlotDto = z.infer<typeof slotDtoSchema>;

export const scheduleDetailDtoSchema = scheduleDtoSchema.extend({ slots: z.array(slotDtoSchema) });
export type ScheduleDetailDto = z.infer<typeof scheduleDetailDtoSchema>;

export const scheduleListQuerySchema = z.object({ semesterId: uuidSchema });

export const createScheduleSchema = z.object({
  id: clientIdSchema,
  semesterId: uuidSchema,
  /** Скопіювати слоти з цієї версії; за замовчуванням — з останньої опублікованої (якщо є). */
  copyFromScheduleId: uuidSchema.optional(),
});

// Значення за замовчуванням — лише у схемі створення (у Zod 4 .partial() їх не прибирає).
const slotFields = z.object({
  weekday: z.number().int().min(1).max(6),
  pairNumber: z.number().int().min(1).max(12),
  parity: SlotParity.schema,
  roomId: uuidSchema.nullable(),
  validFrom: isoDateSchema,
  validTo: isoDateSchema.nullable(),
});
export const createSlotSchema = slotFields.extend({
  id: clientIdSchema,
  loadId: uuidSchema,
  parity: SlotParity.schema.default('EVERY'),
  roomId: uuidSchema.nullable().default(null),
  validFrom: isoDateSchema.optional(),
  validTo: isoDateSchema.nullable().default(null),
});
export const updateSlotSchema = slotFields.partial().extend(versionSchema.shape);

export const conflictDtoSchema = z.object({
  type: z.enum(['TEACHER_BUSY', 'ROOM_BUSY', 'GROUP_BUSY', 'HOURS_EXCEEDED']),
  slotIds: z.array(uuidSchema),
  loadIds: z.array(uuidSchema),
  message: z.string(),
});
export type ConflictDto = z.infer<typeof conflictDtoSchema>;

export const publishSchema = z.object({ dryRun: z.boolean().default(false) });
export const publishResultSchema = z.object({
  dryRun: z.boolean(),
  /** Скільки занять буде створено / скасовано / лишиться без змін. */
  create: z.number().int(),
  cancel: z.number().int(),
  keep: z.number().int(),
  /** Скільком викладачам з'являться пари. */
  teachers: z.number().int(),
  conflicts: z.array(conflictDtoSchema),
});
export type PublishResult = z.infer<typeof publishResultSchema>;

// ── Заняття (календар) ───────────────────────────────
export const lessonItemDtoSchema = z.object({
  id: uuidSchema,
  loadId: uuidSchema,
  date: isoDateSchema,
  pairNumber: z.number().int(),
  hours: z.number().int(),
  status: LessonStatus.schema,
  kind: LessonKind.schema,
  topic: z.string().nullable(),
  homework: z.string().nullable(),
  note: z.string().nullable(),
  manuallyEdited: z.boolean(),
  /** Потік лекцій: заняття з однаковим streamId, датою й парою — одна пара для кількох груп. */
  streamId: uuidSchema.nullable().default(null),
  discipline: z.object({
    id: uuidSchema,
    title: z.string(),
    shortTitle: z.string(),
    color: z.string(),
  }),
  group: z.object({ id: uuidSchema, name: z.string() }),
  subgroup: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  room: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  teacher: z.object({ id: uuidSchema, fullName: z.string() }),
  version: z.number().int(),
});
export type LessonItemDto = z.infer<typeof lessonItemDtoSchema>;

export const lessonListQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  semesterId: uuidSchema.optional(),
  teacherId: uuidSchema.optional(),
  groupId: uuidSchema.optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
