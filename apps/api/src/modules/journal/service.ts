import { SCALE_RANGE } from '@ge/domain';
import {
  type AttendanceMarksInput,
  type CreateGradeInput,
  type GradeEntry,
  type LessonDetailDto,
  type UpdateGradeInput,
  type UpdateLessonInput,
  gradingRulesSchema,
  defaultGradingRules,
} from '@ge/shared';
import type { Prisma } from '@prisma/client';

import { conflict, notFound, unprocessable } from '../../errors.js';
import { audit } from '../../lib/audit.js';
import { definedOnly, isoOf, newId } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { semesterScope } from '../semesters/repo.js';

const UNDO_MINUTES = 10;

const lessonInclude = {
  load: { include: { discipline: true, group: true, subgroup: true } },
  room: true,
  teacher: { select: { id: true, fullName: true } },
  topic: true,
} satisfies Prisma.LessonInclude;

export type LessonRow = Prisma.LessonGetPayload<{ include: typeof lessonInclude }>;

const isModerator = (ctx: AuthContext) => ctx.roles.includes('MODERATOR');

/** Заняття в межах коледжу; викладач бачить лише власні (які веде фактично). */
export async function findLesson(ctx: AuthContext, id: string): Promise<LessonRow> {
  const lesson = await ctx.db.lesson.findFirst({
    where: { id, deletedAt: null, load: { semester: semesterScope(ctx.organization.id) } },
    include: lessonInclude,
  });
  if (!lesson || (!isModerator(ctx) && lesson.teacherId !== ctx.user.id)) {
    throw notFound('Заняття не знайдено');
  }
  return lesson;
}

/** Власник заняття для перевірки прав (can: teacherId). */
export async function lessonOwner(ctx: AuthContext, id: string): Promise<string> {
  const lesson = await ctx.db.lesson.findFirst({
    where: { id, deletedAt: null, load: { semester: semesterScope(ctx.organization.id) } },
    select: { teacherId: true },
  });
  if (!lesson) throw notFound('Заняття не знайдено');
  return lesson.teacherId;
}

/** Власник оцінки (викладач її заняття) для перевірки прав. */
export async function gradeOwner(ctx: AuthContext, gradeId: string): Promise<string> {
  const grade = await ctx.db.grade.findFirst({
    where: {
      id: gradeId,
      deletedAt: null,
      lesson: { load: { semester: semesterScope(ctx.organization.id) } },
    },
    select: { lesson: { select: { teacherId: true } } },
  });
  if (!grade?.lesson) throw notFound('Оцінку не знайдено');
  return grade.lesson.teacherId;
}

/** Склад заняття: активні студенти групи (або підгрупи) на дату заняття. */
export async function rosterEnrollments(ctx: AuthContext, lesson: LessonRow) {
  const date = lesson.date;
  return ctx.db.enrollment.findMany({
    where: {
      groupId: lesson.load.groupId,
      deletedAt: null,
      status: 'ACTIVE',
      fromDate: { lte: date },
      OR: [{ toDate: null }, { toDate: { gte: date } }],
      student: { deletedAt: null },
      ...(lesson.load.subgroupId !== null && {
        subgroups: { some: { subgroupId: lesson.load.subgroupId, deletedAt: null } },
      }),
    },
    include: { student: true },
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  });
}

const gradeEntry = (g: {
  id: string;
  kind: GradeEntry['kind'];
  value: number;
  comment: string | null;
  version: number;
}): GradeEntry => ({
  id: g.id,
  kind: g.kind,
  value: g.value,
  comment: g.comment,
  version: g.version,
});

export async function getLessonDetail(ctx: AuthContext, id: string): Promise<LessonDetailDto> {
  const lesson = await findLesson(ctx, id);
  const [roster, attendance, grades] = await Promise.all([
    rosterEnrollments(ctx, lesson),
    ctx.db.attendance.findMany({ where: { lessonId: id, deletedAt: null } }),
    ctx.db.grade.findMany({ where: { lessonId: id, deletedAt: null }, orderBy: { id: 'asc' } }),
  ]);
  const marks = new Map(attendance.map((a) => [a.enrollmentId, a.status]));

  // Потік лекцій: та сама пара в інших групах (одна пара для викладача)
  const streamRows =
    lesson.load.streamId === null
      ? []
      : await ctx.db.lesson.findMany({
          where: {
            deletedAt: null,
            date: lesson.date,
            pairNumber: lesson.pairNumber,
            teacherId: lesson.teacherId,
            load: { streamId: lesson.load.streamId, deletedAt: null },
          },
          select: { id: true, load: { select: { group: { select: { id: true, name: true } } } } },
        });
  const stream =
    streamRows.length > 1
      ? streamRows
          .map((r) => ({ lessonId: r.id, group: r.load.group }))
          .sort((a, b) => a.group.name.localeCompare(b.group.name, 'uk', { numeric: true }))
      : [];

  const undoUntil =
    lesson.status === 'HELD' ? new Date(lesson.updatedAt.getTime() + UNDO_MINUTES * 60_000) : null;

  return {
    id: lesson.id,
    loadId: lesson.loadId,
    date: isoOf(lesson.date),
    pairNumber: lesson.pairNumber,
    hours: lesson.hours,
    status: lesson.status,
    kind: lesson.load.kind,
    topic: lesson.topicText ?? lesson.topic?.title ?? null,
    homework: lesson.homework,
    note: lesson.note,
    manuallyEdited: lesson.manuallyEdited,
    streamId: lesson.load.streamId,
    discipline: {
      id: lesson.load.discipline.id,
      title: lesson.load.discipline.title,
      shortTitle: lesson.load.discipline.shortTitle,
      color: lesson.load.discipline.color,
    },
    group: { id: lesson.load.group.id, name: lesson.load.group.name },
    subgroup: lesson.load.subgroup
      ? { id: lesson.load.subgroup.id, name: lesson.load.subgroup.name }
      : null,
    room: lesson.room ? { id: lesson.room.id, name: lesson.room.name } : null,
    teacher: lesson.teacher,
    version: lesson.version,
    scale:
      gradingRulesSchema.safeParse(lesson.load.gradingRules).data?.scale ??
      defaultGradingRules.scale,
    undoUntil: undoUntil && undoUntil > new Date() ? undoUntil.toISOString() : null,
    stream,
    roster: roster.map((e) => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      lastName: e.student.lastName,
      firstName: e.student.firstName,
      middleName: e.student.middleName,
      attendance: marks.get(e.id) ?? 'PRESENT',
      marked: marks.has(e.id),
      grades: grades.filter((g) => g.enrollmentId === e.id).map(gradeEntry),
    })),
  };
}

/** Відмітки й оцінки приймаються лише до заняття, що відбувається (не скасоване й не перенесене). */
export function assertWritable(lesson: LessonRow): void {
  if (lesson.status === 'CANCELLED' || lesson.status === 'MOVED') {
    throw conflict('LESSON_NOT_ACTIVE', 'Заняття скасовано або перенесено');
  }
}

export async function assertSemesterOpen(ctx: AuthContext, lesson: LessonRow) {
  const semester = await ctx.db.semester.findFirst({ where: { id: lesson.load.semesterId } });
  if (semester?.status === 'CLOSED')
    throw conflict('SEMESTER_CLOSED', 'Закритий семестр доступний лише для читання');
}

// ── Заняття ──────────────────────────────────────────
export async function updateLesson(
  ctx: AuthContext,
  id: string,
  input: UpdateLessonInput,
): Promise<LessonDetailDto> {
  const lesson = await findLesson(ctx, id);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  const { version, ...data } = input;

  const { count } = await ctx.db.lesson.updateMany({
    where: { id, version, deletedAt: null },
    data: { ...definedOnly(data), version: { increment: 1 } },
  });
  if (count === 0)
    throw conflict('VERSION_CONFLICT', 'Заняття змінено на іншому пристрої; оновіть дані');
  return getLessonDetail(ctx, id);
}

/** «Завершити пару»: статус HELD, непозначені студенти фіксуються як присутні. */
export async function finishLesson(ctx: AuthContext, id: string): Promise<LessonDetailDto> {
  const lesson = await findLesson(ctx, id);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  if (lesson.status === 'HELD') return getLessonDetail(ctx, id);
  if (isoOf(lesson.date) > ctx.today()) {
    throw conflict('LESSON_IN_FUTURE', 'Заняття ще не відбулося');
  }

  const roster = await rosterEnrollments(ctx, lesson);
  await ctx.db.$transaction(async (tx) => {
    const existing = await tx.attendance.findMany({
      where: { lessonId: id },
      select: { enrollmentId: true },
    });
    const have = new Set(existing.map((a) => a.enrollmentId));
    await tx.attendance.createMany({
      data: roster
        .filter((e) => !have.has(e.id))
        .map((e) => ({
          lessonId: id,
          enrollmentId: e.id,
          status: 'PRESENT' as const,
          editedAt: new Date(),
        })),
    });
    await tx.lesson.update({ where: { id }, data: { status: 'HELD', version: { increment: 1 } } });
    await audit(tx, ctx, {
      entity: 'Lesson',
      entityId: id,
      op: 'UPSERT',
      before: { status: lesson.status },
      after: { status: 'HELD' },
    });
  });
  return getLessonDetail(ctx, id);
}

/** «Скасувати завершення» — протягом 10 хвилин після завершення. */
export async function reopenLesson(ctx: AuthContext, id: string): Promise<LessonDetailDto> {
  const lesson = await findLesson(ctx, id);
  await assertSemesterOpen(ctx, lesson);
  if (lesson.status !== 'HELD') throw conflict('LESSON_NOT_HELD', 'Заняття не завершено');
  if (lesson.updatedAt.getTime() + UNDO_MINUTES * 60_000 < Date.now()) {
    throw conflict('UNDO_EXPIRED', 'Скасувати завершення можна лише протягом 10 хвилин');
  }
  await ctx.db.$transaction(async (tx) => {
    await tx.lesson.update({
      where: { id },
      data: { status: 'PLANNED', version: { increment: 1 } },
    });
    await audit(tx, ctx, {
      entity: 'Lesson',
      entityId: id,
      op: 'UPSERT',
      before: { status: 'HELD' },
      after: { status: 'PLANNED' },
    });
  });
  return getLessonDetail(ctx, id);
}

// ── Відвідуваність ───────────────────────────────────
export async function markAttendance(
  ctx: AuthContext,
  id: string,
  input: AttendanceMarksInput,
): Promise<LessonDetailDto> {
  const lesson = await findLesson(ctx, id);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);

  const roster = new Set((await rosterEnrollments(ctx, lesson)).map((e) => e.id));
  const unknown = input.marks.find((m) => !roster.has(m.enrollmentId));
  if (unknown)
    throw unprocessable('ENROLLMENT_NOT_IN_LESSON', 'Студента немає у складі цього заняття');

  await ctx.db.$transaction(async (tx) => {
    const existing = await tx.attendance.findMany({ where: { lessonId: id } });
    const current = new Map(existing.map((a) => [a.enrollmentId, a]));
    for (const mark of input.marks) {
      const before = current.get(mark.enrollmentId);
      if (before?.status === mark.status && before.deletedAt === null) continue;
      await tx.attendance.upsert({
        where: { lessonId_enrollmentId: { lessonId: id, enrollmentId: mark.enrollmentId } },
        create: {
          lessonId: id,
          enrollmentId: mark.enrollmentId,
          status: mark.status,
          editedAt: new Date(),
        },
        update: {
          status: mark.status,
          editedAt: new Date(),
          deletedAt: null,
          version: { increment: 1 },
        },
      });
      await audit(tx, ctx, {
        entity: 'Attendance',
        entityId: `${id}:${mark.enrollmentId}`,
        op: 'UPSERT',
        before: before ? { status: before.status } : null,
        after: { status: mark.status },
      });
    }
  });
  return getLessonDetail(ctx, id);
}

// ── Оцінки ───────────────────────────────────────────
export function assertValueInScale(lesson: LessonRow, value: number): void {
  const scale =
    gradingRulesSchema.safeParse(lesson.load.gradingRules).data?.scale ?? defaultGradingRules.scale;
  const { min, max } = SCALE_RANGE[scale];
  if (value < min || value > max) {
    throw unprocessable('GRADE_OUT_OF_SCALE', `Оцінка має бути від ${min} до ${max}`);
  }
}

export async function createGrade(
  ctx: AuthContext,
  lessonId: string,
  input: CreateGradeInput,
): Promise<LessonDetailDto> {
  const lesson = await findLesson(ctx, lessonId);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  assertValueInScale(lesson, input.value);

  const roster = await rosterEnrollments(ctx, lesson);
  if (!roster.some((e) => e.id === input.enrollmentId)) {
    throw unprocessable('ENROLLMENT_NOT_IN_LESSON', 'Студента немає у складі цього заняття');
  }

  const id = newId(input.id);
  await ctx.db.$transaction(async (tx) => {
    await tx.grade.create({
      data: {
        id,
        enrollmentId: input.enrollmentId,
        lessonId,
        kind: input.kind,
        value: input.value,
        comment: input.comment,
        editedAt: new Date(),
      },
    });
    await audit(tx, ctx, {
      entity: 'Grade',
      entityId: id,
      op: 'UPSERT',
      before: null,
      after: { enrollmentId: input.enrollmentId, lessonId, kind: input.kind, value: input.value },
    });
  });
  return getLessonDetail(ctx, lessonId);
}

async function loadGrade(ctx: AuthContext, id: string) {
  const grade = await ctx.db.grade.findFirst({
    where: {
      id,
      deletedAt: null,
      lesson: { load: { semester: semesterScope(ctx.organization.id) } },
    },
  });
  if (!grade?.lessonId) throw notFound('Оцінку не знайдено');
  return { grade, lessonId: grade.lessonId };
}

export async function updateGrade(
  ctx: AuthContext,
  id: string,
  input: UpdateGradeInput,
): Promise<LessonDetailDto> {
  const { grade, lessonId } = await loadGrade(ctx, id);
  const lesson = await findLesson(ctx, lessonId);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  if (input.value !== undefined) assertValueInScale(lesson, input.value);

  const { version, ...data } = input;
  await ctx.db.$transaction(async (tx) => {
    const { count } = await tx.grade.updateMany({
      where: { id, version, deletedAt: null },
      data: { ...definedOnly(data), editedAt: new Date(), version: { increment: 1 } },
    });
    if (count === 0)
      throw conflict('VERSION_CONFLICT', 'Оцінку змінено на іншому пристрої; оновіть дані');
    await audit(tx, ctx, {
      entity: 'Grade',
      entityId: id,
      op: 'UPSERT',
      before: { kind: grade.kind, value: grade.value, comment: grade.comment },
      after: {
        kind: data.kind ?? grade.kind,
        value: data.value ?? grade.value,
        comment: data.comment === undefined ? grade.comment : data.comment,
      },
    });
  });
  return getLessonDetail(ctx, lessonId);
}

export async function deleteGrade(ctx: AuthContext, id: string): Promise<LessonDetailDto> {
  const { grade, lessonId } = await loadGrade(ctx, id);
  const lesson = await findLesson(ctx, lessonId);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  await ctx.db.$transaction(async (tx) => {
    await tx.grade.update({
      where: { id },
      data: { deletedAt: new Date(), editedAt: new Date(), version: { increment: 1 } },
    });
    await audit(tx, ctx, {
      entity: 'Grade',
      entityId: id,
      op: 'DELETE',
      before: { kind: grade.kind, value: grade.value, comment: grade.comment },
      after: null,
    });
  });
  return getLessonDetail(ctx, lessonId);
}
