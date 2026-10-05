import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '../common.js';
import { LessonKind, RequestStatus } from '../enums.js';

import { clientIdSchema } from './common.js';

export const rescheduleRequestDtoSchema = z.object({
  id: uuidSchema,
  lessonId: uuidSchema,
  status: RequestStatus.schema,
  reason: z.string(),
  proposedDate: isoDateSchema,
  proposedPair: z.number().int(),
  proposedRoomId: uuidSchema.nullable(),
  resolverComment: z.string().nullable(),
  createdAt: z.iso.datetime(),
  requestedBy: z.object({ id: uuidSchema, fullName: z.string() }),
  resolvedBy: z.object({ id: uuidSchema, fullName: z.string() }).nullable(),
  lesson: z.object({
    date: isoDateSchema,
    pairNumber: z.number().int(),
    kind: LessonKind.schema,
    discipline: z.object({
      id: uuidSchema,
      title: z.string(),
      shortTitle: z.string(),
      color: z.string(),
    }),
    group: z.object({ id: uuidSchema, name: z.string() }),
    subgroup: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  }),
  version: z.number().int(),
});
export type RescheduleRequestDto = z.infer<typeof rescheduleRequestDtoSchema>;

export const createRescheduleRequestSchema = z.object({
  id: clientIdSchema,
  lessonId: uuidSchema,
  proposedDate: isoDateSchema,
  proposedPair: z.number().int().min(1).max(12),
  proposedRoomId: uuidSchema.nullable().default(null),
  reason: z.string().trim().min(3).max(1000),
});

export const requestListQuerySchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: RequestStatus.schema.optional(),
});

/** Деканат може погодити запит «як є» або обрати інший вільний слот. */
export const approveRequestSchema = z.object({
  comment: z.string().trim().max(1000).nullable().default(null),
  date: isoDateSchema.optional(),
  pairNumber: z.number().int().min(1).max(12).optional(),
  roomId: uuidSchema.nullable().optional(),
});
export const rejectRequestSchema = z.object({ comment: z.string().trim().min(1).max(1000) });

export const freeSlotDtoSchema = z.object({
  date: isoDateSchema,
  pairNumber: z.number().int(),
  freeRoomIds: z.array(uuidSchema),
});
export type FreeSlotDto = z.infer<typeof freeSlotDtoSchema>;

export const freeSlotsQuerySchema = z.object({
  /** За замовчуванням ±7 днів навколо бажаної дати. */
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

// ── Винятки для окремих занять ───────────────────────
export const cancelLessonSchema = z.object({
  reason: z.string().trim().max(500).nullable().default(null),
});
export const substituteLessonSchema = z.object({ teacherId: uuidSchema });
export const createExtraLessonSchema = z.object({
  id: clientIdSchema,
  loadId: uuidSchema,
  date: isoDateSchema,
  pairNumber: z.number().int().min(1).max(12),
  roomId: uuidSchema.nullable().default(null),
});

export type CreateRescheduleRequestInput = z.infer<typeof createRescheduleRequestSchema>;
export type ApproveRequestInput = z.infer<typeof approveRequestSchema>;
export type CreateExtraLessonInput = z.infer<typeof createExtraLessonSchema>;
