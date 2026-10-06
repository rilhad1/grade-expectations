import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '../common.js';
import { AttestationKind, ControlForm, EnrollmentStatus, LessonKind, Scale } from '../enums.js';

import { loadDtoSchema } from './loads.js';

export const attestationDtoSchema = z.object({
  id: uuidSchema,
  semesterId: uuidSchema,
  kind: AttestationKind.schema,
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
});
export type AttestationDto = z.infer<typeof attestationDtoSchema>;

/** Модулі атестації навантаження з прогресом підтвердження. */
export const loadAttestationsDtoSchema = z.object({
  load: loadDtoSchema,
  modules: z.array(
    attestationDtoSchema.extend({ total: z.number().int(), confirmed: z.number().int() }),
  ),
});
export type LoadAttestationsDto = z.infer<typeof loadAttestationsDtoSchema>;

export const attestationStudentSchema = z.object({
  enrollmentId: uuidSchema,
  studentId: uuidSchema,
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  enrollmentStatus: EnrollmentStatus.schema,
  /** Пропозиція системи за правилами оцінювання й пояснення. */
  proposal: z.object({ text: z.string(), isNa: z.boolean(), explanation: z.string() }),
  average: z.number().nullable(),
  gradesCount: z.number().int(),
  absencePercent: z.number(),
  /** Збережений результат; null, доки викладач нічого не вносив. */
  result: z
    .object({
      final: z.string().nullable(),
      comment: z.string().nullable(),
      confirmed: z.boolean(),
      version: z.number().int(),
    })
    .nullable(),
});
export type AttestationStudent = z.infer<typeof attestationStudentSchema>;

export const attestationSheetDtoSchema = z.object({
  attestation: attestationDtoSchema,
  load: z.object({
    id: uuidSchema,
    kind: LessonKind.schema,
    controlForm: ControlForm.schema,
    scale: Scale.schema,
    disciplineTitle: z.string(),
    groupName: z.string(),
    subgroupName: z.string().nullable(),
    teacherName: z.string(),
  }),
  /** Діапазон дат, за який рахується пропозиція. */
  range: z.object({ from: isoDateSchema, to: isoDateSchema }),
  students: z.array(attestationStudentSchema),
});
export type AttestationSheetDto = z.infer<typeof attestationSheetDtoSchema>;

export const attestationKindParamSchema = z.object({
  id: uuidSchema,
  kind: AttestationKind.schema,
});

export const saveAttestationResultsSchema = z.object({
  results: z
    .array(
      z.object({
        enrollmentId: uuidSchema,
        /** «9», «н/а», «зар.»; null — очистити. */
        final: z.string().trim().max(20).nullable(),
        comment: z.string().trim().max(500).nullable().default(null),
        confirmed: z.boolean(),
      }),
    )
    .min(1)
    .max(200),
});
export type SaveAttestationResultsInput = z.infer<typeof saveAttestationResultsSchema>;
