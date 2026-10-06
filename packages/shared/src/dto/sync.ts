import { z } from 'zod';

import { uuidSchema } from '../common.js';
import { AttendanceStatus, GradeKind } from '../enums.js';

import { bellDtoSchema } from './directory.js';
import { lessonDetailDtoSchema } from './teaching.js';

const base = {
  /** Ідентифікатор операції: повторна відправка не застосовується двічі. */
  opId: uuidSchema,
  /** Момент дії на пристрої (для «останній запис перемагає»). */
  at: z.iso.datetime(),
  lessonId: uuidSchema,
};

/** Операції «На парі», що накопичуються в outbox на пристрої, поки немає мережі. */
export const syncOpSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('attendance.set'),
    enrollmentId: uuidSchema,
    status: AttendanceStatus.schema,
  }),
  z.object({
    ...base,
    type: z.literal('grade.set'),
    enrollmentId: uuidSchema,
    gradeId: uuidSchema,
    kind: GradeKind.schema,
    value: z.number().int().min(0).max(100),
    comment: z.string().trim().max(500).nullable(),
  }),
  z.object({ ...base, type: z.literal('grade.delete'), gradeId: uuidSchema }),
  z.object({
    ...base,
    type: z.literal('lesson.info'),
    topicText: z.string().trim().max(500).nullable().optional(),
    homework: z.string().trim().max(1000).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
  }),
  z.object({ ...base, type: z.literal('lesson.finish') }),
  z.object({ ...base, type: z.literal('lesson.reopen') }),
]);
export type SyncOp = z.infer<typeof syncOpSchema>;

export const MAX_PUSH_OPS = 200;

export const pushRequestSchema = z.object({ ops: z.array(syncOpSchema).min(1).max(MAX_PUSH_OPS) });
export type PushRequest = z.infer<typeof pushRequestSchema>;

/**
 * applied — застосовано; skipped — не потрібно (вже так є або є новіший запис з іншого пристрою);
 * rejected — не можна застосувати ніколи (заняття скасовано, немає прав): користувач має про це знати.
 */
export const syncResultSchema = z.object({
  opId: uuidSchema,
  status: z.enum(['applied', 'skipped', 'rejected']),
  code: z.string().optional(),
  message: z.string().optional(),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

export const pushResponseSchema = z.object({ results: z.array(syncResultSchema) });
export type PushResponse = z.infer<typeof pushResponseSchema>;

export const pullQuerySchema = z.object({ since: z.iso.datetime().optional() });

export const pullResponseSchema = z.object({
  /** Курсор для наступного `since`: час початку цього запиту з невеликим запасом. */
  cursor: z.iso.datetime(),
  /** Вікно дат, яке покриває локальна копія. */
  window: z.object({ from: z.string(), to: z.string() }),
  bells: z.array(bellDtoSchema),
  lessons: z.array(lessonDetailDtoSchema),
  /** Заняття, що зникли з розкладу викладача (видалені). */
  removedLessonIds: z.array(uuidSchema),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;
