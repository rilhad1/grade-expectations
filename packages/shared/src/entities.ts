import { z } from 'zod';

import { isoDateSchema, uuidSchema } from './common.js';
import {
  AttendanceStatus,
  ControlForm,
  GradeKind,
  LessonKind,
  LessonStatus,
  ParityAfterBreak,
  PeriodKind,
  SlotParity,
  WeekParity,
} from './enums.js';
import { gradingRulesSchema } from './gradingRules.js';

// DTO-схеми: спільні для api і web. Службові поля синхронізації додаються окремо (syncFieldsSchema).

export const semesterPeriodSchema = z.object({
  id: uuidSchema,
  kind: PeriodKind.schema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  title: z.string().nullable().default(null),
});

export const semesterSchema = z
  .object({
    id: uuidSchema,
    academicYearId: uuidSchema,
    number: z.union([z.literal(1), z.literal(2)]),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    firstWeekParity: WeekParity.schema,
    parityAfterBreak: ParityAfterBreak.schema,
    periods: z.array(semesterPeriodSchema).default([]),
  })
  .refine((s) => s.startDate <= s.endDate, { message: 'Початок семестру пізніше за кінець' });
export type SemesterDto = z.infer<typeof semesterSchema>;

export const teachingLoadSchema = z.object({
  id: uuidSchema,
  semesterId: uuidSchema,
  disciplineId: uuidSchema,
  groupId: uuidSchema,
  subgroupId: uuidSchema.nullable(),
  teacherId: uuidSchema,
  kind: LessonKind.schema,
  plannedHours: z.number().int().positive(),
  controlForm: ControlForm.schema,
  gradingRules: gradingRulesSchema,
});
export type TeachingLoadDto = z.infer<typeof teachingLoadSchema>;

export const scheduleSlotSchema = z
  .object({
    id: uuidSchema,
    scheduleId: uuidSchema,
    loadId: uuidSchema,
    weekday: z.number().int().min(1).max(6),
    pairNumber: z.number().int().min(1),
    parity: SlotParity.schema,
    roomId: uuidSchema.nullable(),
    validFrom: isoDateSchema,
    validTo: isoDateSchema.nullable(),
  })
  .refine((s) => s.validTo === null || s.validFrom <= s.validTo, {
    message: 'validFrom пізніше за validTo',
  });
export type ScheduleSlotDto = z.infer<typeof scheduleSlotSchema>;

export const lessonSchema = z.object({
  id: uuidSchema,
  loadId: uuidSchema,
  slotId: uuidSchema.nullable(),
  teacherId: uuidSchema,
  scheduleVersion: z.number().int().nullable(),
  date: isoDateSchema,
  pairNumber: z.number().int().min(1),
  roomId: uuidSchema.nullable(),
  hours: z.number().int().positive(),
  status: LessonStatus.schema,
  topicId: uuidSchema.nullable(),
  topicText: z.string().nullable(),
  homework: z.string().nullable(),
  note: z.string().nullable(),
  manuallyEdited: z.boolean(),
});
export type LessonDto = z.infer<typeof lessonSchema>;

export const attendanceSchema = z.object({
  lessonId: uuidSchema,
  enrollmentId: uuidSchema,
  status: AttendanceStatus.schema,
});
export type AttendanceDto = z.infer<typeof attendanceSchema>;

export const gradeSchema = z.object({
  id: uuidSchema,
  enrollmentId: uuidSchema,
  lessonId: uuidSchema.nullable(),
  assessmentId: uuidSchema.nullable(),
  kind: GradeKind.schema,
  value: z.number().int().min(0),
  comment: z.string().nullable(),
});
export type GradeDto = z.infer<typeof gradeSchema>;
