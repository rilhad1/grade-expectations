import { z } from 'zod';

import { isoDateSchema, uuidSchema } from '../common.js';
import { EnrollmentStatus, Role, Scale } from '../enums.js';

import { clientIdSchema, versionSchema } from './common.js';

const name = (max = 200) => z.string().trim().min(1).max(max);
const nullableText = (max = 500) => z.string().trim().max(max).nullable();

// ── Дисципліни ───────────────────────────────────────
export const disciplineDtoSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  shortTitle: z.string(),
  code: z.string().nullable(),
  color: z.string(),
  defaultScale: Scale.schema,
  version: z.number().int(),
});
export type DisciplineDto = z.infer<typeof disciplineDtoSchema>;

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Колір у форматі #RRGGBB');
const disciplineFields = z.object({
  title: name(),
  shortTitle: name(30),
  code: nullableText(50).default(null),
  color: colorSchema,
  defaultScale: Scale.schema.default('TWELVE'),
});
export const createDisciplineSchema = disciplineFields.extend({ id: clientIdSchema });
export const updateDisciplineSchema = disciplineFields.partial().extend(versionSchema.shape);

// ── Аудиторії ────────────────────────────────────────
export const roomDtoSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  capacity: z.number().int().nullable(),
  kind: z.string().nullable(),
  version: z.number().int(),
});
export type RoomDto = z.infer<typeof roomDtoSchema>;

const roomFields = z.object({
  name: name(100),
  capacity: z.number().int().positive().nullable().default(null),
  kind: nullableText(50).default(null),
});
export const createRoomSchema = roomFields.extend({ id: clientIdSchema });
export const updateRoomSchema = roomFields.partial().extend(versionSchema.shape);

// ── Розклад дзвінків ─────────────────────────────────
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Час у форматі ГГ:ХХ');
export const bellDtoSchema = z.object({
  pairNumber: z.number().int().min(1).max(12),
  startsAt: timeSchema,
  endsAt: timeSchema,
});
export type BellDto = z.infer<typeof bellDtoSchema>;

export const replaceBellsSchema = z
  .array(bellDtoSchema)
  .min(1)
  .refine(
    (bells) => new Set(bells.map((b) => b.pairNumber)).size === bells.length,
    'Номери пар мають бути унікальними',
  )
  .refine((bells) => bells.every((b) => b.startsAt < b.endsAt), 'Початок пари пізніше за кінець');

// ── Потоки й групи ───────────────────────────────────
export const cohortDtoSchema = z.object({
  id: uuidSchema,
  specialty: z.string(),
  entryYear: z.number().int(),
  version: z.number().int(),
});
export type CohortDto = z.infer<typeof cohortDtoSchema>;

const cohortFields = z.object({
  specialty: name(200),
  entryYear: z.number().int().min(1990).max(2100),
});
export const createCohortSchema = cohortFields.extend({ id: clientIdSchema });
export const updateCohortSchema = cohortFields.partial().extend(versionSchema.shape);

export const subgroupDtoSchema = z.object({
  id: uuidSchema,
  groupId: uuidSchema,
  name: z.string(),
  enrollmentIds: z.array(uuidSchema),
  version: z.number().int(),
});
export type SubgroupDto = z.infer<typeof subgroupDtoSchema>;

export const groupDtoSchema = z.object({
  id: uuidSchema,
  cohortId: uuidSchema,
  academicYearId: uuidSchema,
  name: z.string(),
  course: z.number().int(),
  studentCount: z.number().int(),
  version: z.number().int(),
});
export type GroupDto = z.infer<typeof groupDtoSchema>;

const groupFields = z.object({
  cohortId: uuidSchema,
  academicYearId: uuidSchema,
  name: name(50),
  course: z.number().int().min(1).max(9),
});
export const createGroupSchema = groupFields.extend({ id: clientIdSchema });
export const updateGroupSchema = groupFields
  .pick({ name: true, course: true })
  .partial()
  .extend(versionSchema.shape);
export const groupListQuerySchema = z.object({ academicYearId: uuidSchema.optional() });

export const createSubgroupSchema = z.object({
  id: clientIdSchema,
  name: name(50),
  enrollmentIds: z.array(uuidSchema).default([]),
});
export const updateSubgroupSchema = z
  .object({ name: name(50), enrollmentIds: z.array(uuidSchema) })
  .partial()
  .extend(versionSchema.shape);

/** Переведення груп на наступний курс. */
export const promoteGroupsSchema = z.object({
  toAcademicYearId: uuidSchema,
  groups: z
    .array(
      z.object({
        groupId: uuidSchema,
        /** Якщо не задано — назва за шаблоном «ПДт-11 → ПДт-21». */
        newName: name(50).optional(),
        /** Студенти, що не переходять (відраховані, переведені). */
        excludeStudentIds: z.array(uuidSchema).default([]),
      }),
    )
    .min(1),
});
export const promoteGroupsResultSchema = z.object({
  promoted: z.array(
    z.object({
      fromGroupId: uuidSchema,
      toGroupId: uuidSchema,
      name: z.string(),
      students: z.number().int(),
    }),
  ),
  skipped: z.array(
    z.object({
      groupId: uuidSchema,
      reason: z.enum(['NAME_NOT_PROMOTABLE', 'ALREADY_PROMOTED', 'LAST_COURSE']),
    }),
  ),
});
export type PromoteGroupsResult = z.infer<typeof promoteGroupsResultSchema>;

// ── Студенти й зарахування ───────────────────────────
export const studentDtoSchema = z.object({
  id: uuidSchema,
  lastName: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  note: z.string().nullable(),
  /** Поточні зарахування студента. */
  enrollments: z.array(
    z.object({
      id: uuidSchema,
      groupId: uuidSchema,
      groupName: z.string(),
      status: EnrollmentStatus.schema,
    }),
  ),
  version: z.number().int(),
});
export type StudentDto = z.infer<typeof studentDtoSchema>;

const studentFields = z.object({
  lastName: name(100),
  firstName: name(100),
  middleName: nullableText(100).default(null),
  note: nullableText(1000).default(null),
});
export const createStudentSchema = studentFields.extend({
  id: clientIdSchema,
  /** Одразу зарахувати в групу. */
  groupId: uuidSchema.optional(),
  fromDate: isoDateSchema.optional(),
});
export const updateStudentSchema = studentFields.partial().extend(versionSchema.shape);
export const studentListQuerySchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  q: z.string().trim().min(1).optional(),
  groupId: uuidSchema.optional(),
});

export const enrollmentDtoSchema = z.object({
  id: uuidSchema,
  studentId: uuidSchema,
  groupId: uuidSchema,
  status: EnrollmentStatus.schema,
  fromDate: isoDateSchema,
  toDate: isoDateSchema.nullable(),
  version: z.number().int(),
});
export type EnrollmentDto = z.infer<typeof enrollmentDtoSchema>;

export const createEnrollmentSchema = z.object({
  id: clientIdSchema,
  studentId: uuidSchema,
  groupId: uuidSchema,
  fromDate: isoDateSchema,
});
export const updateEnrollmentSchema = z
  .object({ status: EnrollmentStatus.schema, toDate: isoDateSchema.nullable() })
  .partial()
  .extend(versionSchema.shape);

/** Імпорт списку студентів: текстом (вставка) або вже розібраними рядками (Excel/CSV на клієнті). */
export const importStudentsSchema = z
  .object({
    groupId: uuidSchema,
    fromDate: isoDateSchema,
    dryRun: z.boolean().default(true),
    text: z.string().max(200_000).optional(),
    rows: z
      .array(
        z.object({
          lastName: name(100),
          firstName: name(100),
          middleName: nullableText(100).default(null),
        }),
      )
      .max(2000)
      .optional(),
  })
  .refine((v) => v.text !== undefined || v.rows !== undefined, 'Передайте text або rows');

export const importStudentsResultSchema = z.object({
  dryRun: z.boolean(),
  rows: z.array(
    z.object({
      line: z.number().int(),
      lastName: z.string(),
      firstName: z.string(),
      middleName: z.string().nullable(),
      /** Студент із таким ПІБ уже є в цій групі. */
      duplicate: z.boolean(),
    }),
  ),
  errors: z.array(z.object({ line: z.number().int(), text: z.string(), code: z.string() })),
  created: z.number().int(),
});
export type ImportStudentsResult = z.infer<typeof importStudentsResultSchema>;

// ── Користувачі коледжу ──────────────────────────────
export const userDtoSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  fullName: z.string(),
  roles: z.array(Role.schema),
});
export type UserDto = z.infer<typeof userDtoSchema>;

export const createUserSchema = z.object({
  id: clientIdSchema,
  email: z.email().transform((e) => e.toLowerCase()),
  fullName: name(200),
  roles: z.array(Role.schema).min(1),
});
export const createUserResultSchema = userDtoSchema.extend({
  /** Показується один раз; користувач змінить його після першого входу. */
  temporaryPassword: z.string(),
});
export const updateUserRolesSchema = z.object({ roles: z.array(Role.schema).min(1) });

export type CreateDisciplineInput = z.infer<typeof createDisciplineSchema>;
export type UpdateDisciplineInput = z.infer<typeof updateDisciplineSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateCohortInput = z.infer<typeof createCohortSchema>;
export type UpdateCohortInput = z.infer<typeof updateCohortSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type CreateSubgroupInput = z.infer<typeof createSubgroupSchema>;
export type UpdateSubgroupInput = z.infer<typeof updateSubgroupSchema>;
export type PromoteGroupsInput = z.infer<typeof promoteGroupsSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentSchema>;
export type ImportStudentsInput = z.infer<typeof importStudentsSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Склад групи: зарахування зі студентами та підгрупи. */
export const groupDetailDtoSchema = groupDtoSchema.extend({
  enrollments: z.array(
    z.object({
      id: uuidSchema,
      status: EnrollmentStatus.schema,
      fromDate: isoDateSchema,
      toDate: isoDateSchema.nullable(),
      student: z.object({
        id: uuidSchema,
        lastName: z.string(),
        firstName: z.string(),
        middleName: z.string().nullable(),
      }),
    }),
  ),
  subgroups: z.array(subgroupDtoSchema),
});
export type GroupDetailDto = z.infer<typeof groupDetailDtoSchema>;
