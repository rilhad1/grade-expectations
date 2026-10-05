import { z } from 'zod';

/** Створює Zod-enum і відповідний тип з одного списку значень. */
function defineEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return { values, schema: z.enum(values) };
}

export const Role = defineEnum(['TEACHER', 'MODERATOR']);
export type Role = z.infer<typeof Role.schema>;

export const WeekParity = defineEnum(['TOP', 'BOTTOM']);
export type WeekParity = z.infer<typeof WeekParity.schema>;

export const ParityAfterBreak = defineEnum(['CONTINUE', 'RESTART']);
export type ParityAfterBreak = z.infer<typeof ParityAfterBreak.schema>;

export const SemesterStatus = defineEnum(['DRAFT', 'ACTIVE', 'CLOSED']);
export type SemesterStatus = z.infer<typeof SemesterStatus.schema>;

export const PeriodKind = defineEnum([
  'HOLIDAY',
  'DAY_OFF',
  'EXAM_SESSION',
  'PRACTICE',
  'INTERIM_ATTESTATION',
  'DIRECTOR_TEST',
]);
export type PeriodKind = z.infer<typeof PeriodKind.schema>;

export const Scale = defineEnum(['TWELVE', 'FIVE', 'HUNDRED', 'PASS_FAIL']);
export type Scale = z.infer<typeof Scale.schema>;

export const LessonKind = defineEnum(['LECTURE', 'PRACTICE', 'LAB', 'SEMINAR', 'CONTROL']);
export type LessonKind = z.infer<typeof LessonKind.schema>;

export const EnrollmentStatus = defineEnum(['ACTIVE', 'ACADEMIC_LEAVE', 'EXPELLED', 'TRANSFERRED']);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatus.schema>;

export const ControlForm = defineEnum(['EXAM', 'CREDIT']);
export type ControlForm = z.infer<typeof ControlForm.schema>;

export const ScheduleStatus = defineEnum(['DRAFT', 'PUBLISHED']);
export type ScheduleStatus = z.infer<typeof ScheduleStatus.schema>;

export const SlotParity = defineEnum(['EVERY', 'TOP', 'BOTTOM']);
export type SlotParity = z.infer<typeof SlotParity.schema>;

export const LessonStatus = defineEnum(['PLANNED', 'HELD', 'CANCELLED', 'MOVED', 'SUBSTITUTED']);
export type LessonStatus = z.infer<typeof LessonStatus.schema>;

export const RequestStatus = defineEnum(['PENDING', 'APPROVED', 'REJECTED']);
export type RequestStatus = z.infer<typeof RequestStatus.schema>;

export const AttendanceStatus = defineEnum(['PRESENT', 'ABSENT', 'EXCUSED', 'LATE']);
export type AttendanceStatus = z.infer<typeof AttendanceStatus.schema>;

export const AssessmentKind = defineEnum(['TEST', 'LAB', 'SELF_STUDY', 'DIRECTOR_TEST']);
export type AssessmentKind = z.infer<typeof AssessmentKind.schema>;

export const GradeKind = defineEnum(['ORAL', 'PRACTICE', 'LAB', 'TEST', 'RETAKE']);
export type GradeKind = z.infer<typeof GradeKind.schema>;

export const AttestationKind = defineEnum(['INTERIM', 'DIRECTOR_TEST', 'AVERAGE', 'EXAM']);
export type AttestationKind = z.infer<typeof AttestationKind.schema>;
