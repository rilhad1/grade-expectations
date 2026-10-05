import { z } from 'zod';

import { uuidSchema } from '../common.js';
import { ControlForm, LessonKind } from '../enums.js';
import { gradingRulesSchema } from '../gradingRules.js';

import { clientIdSchema, versionSchema } from './common.js';

export const hoursProgressDtoSchema = z.object({
  planned: z.number(),
  held: z.number(),
  forecast: z.number(),
  deficit: z.number(),
  extraPairsNeeded: z.number().int(),
});
export type HoursProgressDto = z.infer<typeof hoursProgressDtoSchema>;

export const loadDtoSchema = z.object({
  id: uuidSchema,
  semesterId: uuidSchema,
  kind: LessonKind.schema,
  plannedHours: z.number().int(),
  controlForm: ControlForm.schema,
  gradingRules: gradingRulesSchema,
  discipline: z.object({
    id: uuidSchema,
    title: z.string(),
    shortTitle: z.string(),
    color: z.string(),
  }),
  group: z.object({ id: uuidSchema, name: z.string() }),
  subgroup: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  teacher: z.object({ id: uuidSchema, fullName: z.string() }),
  /** Вичитка годин: план / факт / прогноз. */
  hours: hoursProgressDtoSchema,
  version: z.number().int(),
});
export type LoadDto = z.infer<typeof loadDtoSchema>;

export const loadListQuerySchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  semesterId: uuidSchema,
  groupId: uuidSchema.optional(),
  teacherId: uuidSchema.optional(),
});

export const createLoadSchema = z.object({
  id: clientIdSchema,
  semesterId: uuidSchema,
  disciplineId: uuidSchema,
  groupId: uuidSchema,
  subgroupId: uuidSchema.nullable().default(null),
  teacherId: uuidSchema,
  kind: LessonKind.schema,
  plannedHours: z.number().int().positive().max(1000),
  controlForm: ControlForm.schema,
  /** Якщо не задано — значення за замовчуванням зі шкалою дисципліни. */
  gradingRules: gradingRulesSchema.optional(),
});

export const updateLoadSchema = z
  .object({
    teacherId: uuidSchema,
    plannedHours: z.number().int().positive().max(1000),
    controlForm: ControlForm.schema,
    gradingRules: gradingRulesSchema,
  })
  .partial()
  .extend(versionSchema.shape);

export type CreateLoadInput = z.infer<typeof createLoadSchema>;
export type UpdateLoadInput = z.infer<typeof updateLoadSchema>;
