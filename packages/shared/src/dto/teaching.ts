import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '../common.js';
import {
  AttendanceStatus,
  AttestationKind,
  ControlForm,
  EnrollmentStatus,
  GradeKind,
  LessonKind,
  PeriodKind,
  Scale,
} from '../enums.js';
import { gradingRulesSchema } from '../gradingRules.js';

import { clientIdSchema, versionSchema } from './common.js';
import { loadDtoSchema } from './loads.js';
import { lessonItemDtoSchema } from './schedules.js';

// ── Оцінки ───────────────────────────────────────────
export const gradeEntrySchema = z.object({
  id: uuidSchema,
  kind: GradeKind.schema,
  value: z.number().int(),
  comment: z.string().nullable(),
  version: z.number().int(),
});
export type GradeEntry = z.infer<typeof gradeEntrySchema>;

export const createGradeSchema = z.object({
  id: clientIdSchema,
  enrollmentId: uuidSchema,
  kind: GradeKind.schema,
  value: z.number().int().min(0).max(100),
  comment: z.string().trim().max(500).nullable().default(null),
});
export const updateGradeSchema = z
  .object({
    kind: GradeKind.schema,
    value: z.number().int().min(0).max(100),
    comment: z.string().trim().max(500).nullable(),
  })
  .partial()
  .extend(versionSchema.shape);

// ── Заняття «На парі» ────────────────────────────────
export const rosterEntrySchema = z.object({
  enrollmentId: uuidSchema,
  studentId: uuidSchema,
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  /** Відмітка; без запису вважається «присутній». */
  attendance: AttendanceStatus.schema,
  marked: z.boolean(),
  grades: z.array(gradeEntrySchema),
});
export type RosterEntry = z.infer<typeof rosterEntrySchema>;

export const lessonDetailDtoSchema = lessonItemDtoSchema.extend({
  scale: Scale.schema,
  roster: z.array(rosterEntrySchema),
  /** Для проведеного заняття: до якого моменту можна скасувати завершення (10 хв). */
  undoUntil: z.iso.datetime().nullable(),
  /** Усі заняття цього потоку тієї ж пари (разом із цим); порожньо, якщо заняття не в потоці. */
  stream: z
    .array(
      z.object({ lessonId: uuidSchema, group: z.object({ id: uuidSchema, name: z.string() }) }),
    )
    .default([]),
});
export type LessonDetailDto = z.infer<typeof lessonDetailDtoSchema>;

export const updateLessonSchema = z
  .object({
    topicText: z.string().trim().max(500).nullable(),
    topicId: uuidSchema.nullable(),
    homework: z.string().trim().max(1000).nullable(),
    note: z.string().trim().max(1000).nullable(),
  })
  .partial()
  .extend(versionSchema.shape);

export const attendanceMarksSchema = z.object({
  marks: z
    .array(z.object({ enrollmentId: uuidSchema, status: AttendanceStatus.schema }))
    .min(1)
    .max(200),
});

// ── Журнал ───────────────────────────────────────────
export const gradebookCellSchema = z.object({
  attendance: AttendanceStatus.schema.nullable(),
  grades: z.array(gradeEntrySchema),
});
export type GradebookCell = z.infer<typeof gradebookCellSchema>;

export const studentSummarySchema = z.object({
  average: z.number().nullable(),
  gradesCount: z.number().int(),
  absences: z.object({
    unexcused: z.number().int(),
    excused: z.number().int(),
    late: z.number().int(),
  }),
  absencePercent: z.number(),
  heldLessons: z.number().int(),
  proposal: z.object({ value: z.union([z.number(), z.literal('NA')]), explanation: z.string() }),
  risk: z.array(z.enum(['LOW_GRADE', 'ABSENCES'])),
});
export type StudentSummary = z.infer<typeof studentSummarySchema>;

// ── Колонки оцінювання (практичні, модулі) ────────────
/** Вид колонки: практична/лабораторна чи модуль (контрольна). */
export const assessmentKindSchema = z.enum(['LAB', 'TEST']);
export const assessmentDtoSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  kind: z.enum(['TEST', 'LAB', 'SELF_STUDY', 'DIRECTOR_TEST']),
  maxScore: z.int(),
  /** До якої атестації належить колонка; null — без прив'язки. */
  attestationKind: AttestationKind.schema.nullable(),
  version: z.int().default(0),
});
export type AssessmentDto = z.infer<typeof assessmentDtoSchema>;

export const createAssessmentSchema = z.object({
  id: clientIdSchema,
  title: z.string().trim().min(1).max(60),
  kind: assessmentKindSchema.default('LAB'),
  attestationKind: AttestationKind.schema.nullable().default(null),
});
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    kind: assessmentKindSchema,
    attestationKind: AttestationKind.schema.nullable(),
  })
  .partial()
  .extend(versionSchema.shape);
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export const setAssessmentGradeSchema = z.object({
  value: z.number().int().min(0).max(100),
  comment: z.string().trim().max(500).nullable().default(null),
});
export type SetAssessmentGradeInput = z.infer<typeof setAssessmentGradeSchema>;

export const assessmentGradeDtoSchema = z.object({
  id: uuidSchema,
  value: z.int(),
  comment: z.string().nullable(),
  version: z.int(),
});
export type AssessmentGradeDto = z.infer<typeof assessmentGradeDtoSchema>;

export const gradebookDtoSchema = z.object({
  load: z.object({
    id: uuidSchema,
    kind: LessonKind.schema,
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
  }),
  lessons: z.array(
    z.object({
      id: uuidSchema,
      date: isoDateSchema,
      pairNumber: z.number().int(),
      kind: LessonKind.schema,
      status: z.enum(['PLANNED', 'HELD', 'SUBSTITUTED']),
      topic: z.string().nullable(),
    }),
  ),
  students: z.array(
    z.object({
      enrollmentId: uuidSchema,
      studentId: uuidSchema,
      lastName: z.string(),
      firstName: z.string(),
      middleName: z.string().nullable(),
      enrollmentStatus: EnrollmentStatus.schema,
      cells: z.record(uuidSchema, gradebookCellSchema),
      /** Оцінки колонок оцінювання (практичні, модулі): assessmentId → оцінка. */
      assessmentGrades: z.record(uuidSchema, assessmentGradeDtoSchema).default({}),
      summary: studentSummarySchema,
    }),
  ),
  /** Колонки оцінювання журналу: окремі від занять (без прив'язки до дат). */
  assessments: z.array(assessmentDtoSchema).default([]),
  /** Періоди атестацій і сесії (межі в журналі). */
  periods: z.array(
    z.object({ kind: PeriodKind.schema, startDate: isoDateSchema, endDate: isoDateSchema }),
  ),
});
export type GradebookDto = z.infer<typeof gradebookDtoSchema>;

export const gradebookQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

// ── Тематичний план і правила оцінювання ─────────────
export const topicDtoSchema = z.object({
  id: uuidSchema,
  order: z.number().int(),
  title: z.string(),
  hours: z.number().int(),
  kind: LessonKind.schema,
});
export type TopicDto = z.infer<typeof topicDtoSchema>;

export const topicPlanDtoSchema = z.object({
  programId: uuidSchema.nullable(),
  edition: z.string().nullable(),
  /** Вид занять навантаження: тема має той самий вид. */
  loadKind: LessonKind.schema,
  topics: z.array(topicDtoSchema),
});
export type TopicPlanDto = z.infer<typeof topicPlanDtoSchema>;

export const replaceTopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        id: clientIdSchema,
        title: z.string().trim().min(1).max(300),
        hours: z.number().int().min(1).max(100),
      }),
    )
    .max(200),
});

export const updateGradingRulesSchema = z.object({ rules: gradingRulesSchema });

// ── «Сьогодні» ───────────────────────────────────────
export const todayDtoSchema = z.object({
  date: isoDateSchema,
  lessons: z.array(
    lessonItemDtoSchema.extend({ marked: z.number().int(), total: z.number().int() }),
  ),
  attestations: z.array(
    z.object({
      kind: AttestationKind.schema,
      dateFrom: isoDateSchema,
      dateTo: isoDateSchema,
      daysUntil: z.number().int(),
      groups: z.array(z.string()),
    }),
  ),
  risk: z.array(
    z.object({
      enrollmentId: uuidSchema,
      loadId: uuidSchema,
      lastName: z.string(),
      firstName: z.string(),
      group: z.string(),
      discipline: z.string(),
      reasons: z.array(z.enum(['LOW_GRADE', 'ABSENCES'])),
      average: z.number().nullable(),
      absencePercent: z.number(),
    }),
  ),
  hours: z.array(loadDtoSchema),
});
export type TodayDto = z.infer<typeof todayDtoSchema>;

export type CreateGradeInput = z.infer<typeof createGradeSchema>;
export type UpdateGradeInput = z.infer<typeof updateGradeSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type AttendanceMarksInput = z.infer<typeof attendanceMarksSchema>;
