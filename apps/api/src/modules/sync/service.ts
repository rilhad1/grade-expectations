import { can, clampOpTime, resolveLww, type Action } from '@ge/domain';
import type { PullResponse, PushResponse, SyncOp, SyncResult } from '@ge/shared';
import type { Prisma } from '@prisma/client';

import { AppError, forbidden, unprocessable } from '../../errors.js';
import { audit } from '../../lib/audit.js';
import { mapLimit } from '../../lib/concurrency.js';
import { addDaysIso, dateOf, definedOnly } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { assessmentOwner, writeAssessmentGrade } from '../journal/assessments.js';
import {
  assertSemesterOpen,
  assertValueInScale,
  assertWritable,
  findLesson,
  finishLesson,
  getLessonDetail,
  reopenLesson,
  rosterEnrollments,
} from '../journal/service.js';
import { semesterScope } from '../semesters/repo.js';

/** Вікно локальної копії: два тижні назад і вперед від сьогодні. */
/** Скільки занять знімка збираємо одночасно (пул з'єднань Prisma невеликий). */
const PULL_CONCURRENCY = 4;
const WINDOW_DAYS = 14;
/** Запас курсора: перекриття вікон дешевше за втрачену зміну (застосування ідемпотентне). */
const CURSOR_OVERLAP_MS = 2_000;
const MAX_LESSONS = 400;

type Outcome = Omit<SyncResult, 'opId'>;

const applied = (): Outcome => ({ status: 'applied' });
const skipped = (code: string, message: string): Outcome => ({ status: 'skipped', code, message });

function authorize(ctx: AuthContext, action: Action, teacherId: string): void {
  const allowed = can(
    { userId: ctx.user.id, organizationId: ctx.organization.id, roles: ctx.roles },
    action,
    { organizationId: ctx.organization.id, teacherId },
  );
  if (!allowed) throw forbidden(`Дія ${action} недоступна`);
}

async function applyAttendance(
  ctx: AuthContext,
  op: Extract<SyncOp, { type: 'attendance.set' }>,
  at: string,
): Promise<Outcome> {
  const lesson = await findLesson(ctx, op.lessonId);
  authorize(ctx, 'attendance:write', lesson.teacherId);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  const roster = await rosterEnrollments(ctx, lesson);
  if (!roster.some((e) => e.id === op.enrollmentId))
    throw unprocessable('ENROLLMENT_NOT_IN_LESSON', 'Студента немає у складі цього заняття');

  const key = { lessonId_enrollmentId: { lessonId: op.lessonId, enrollmentId: op.enrollmentId } };
  const before = await ctx.db.attendance.findUnique({ where: key });
  if (before && resolveLww(before.editedAt?.toISOString() ?? null, at) === 'skip')
    return skipped('SUPERSEDED', 'Відмітку замінено новішою з іншого пристрою');
  if (before?.deletedAt === null && before.status === op.status)
    return skipped('UNCHANGED', 'Відмітка вже збережена');

  await ctx.db.attendance.upsert({
    where: key,
    create: {
      lessonId: op.lessonId,
      enrollmentId: op.enrollmentId,
      status: op.status,
      editedAt: new Date(at),
    },
    update: {
      status: op.status,
      editedAt: new Date(at),
      deletedAt: null,
      version: { increment: 1 },
    },
  });
  await audit(ctx.db, ctx, {
    entity: 'Attendance',
    entityId: `${op.lessonId}:${op.enrollmentId}`,
    op: 'UPSERT',
    before: before ? { status: before.status } : null,
    after: { status: op.status },
  });
  return applied();
}

async function applyGradeSet(
  ctx: AuthContext,
  op: Extract<SyncOp, { type: 'grade.set' }>,
  at: string,
): Promise<Outcome> {
  const lesson = await findLesson(ctx, op.lessonId);
  authorize(ctx, 'grade:write', lesson.teacherId);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  assertValueInScale(lesson, op.value);
  const roster = await rosterEnrollments(ctx, lesson);
  if (!roster.some((e) => e.id === op.enrollmentId))
    throw unprocessable('ENROLLMENT_NOT_IN_LESSON', 'Студента немає у складі цього заняття');

  const before = await ctx.db.grade.findUnique({ where: { id: op.gradeId } });
  if (before) {
    if (before.lessonId !== op.lessonId || before.enrollmentId !== op.enrollmentId)
      throw unprocessable('GRADE_ID_CONFLICT', 'Ідентифікатор оцінки вже використано');
    if (resolveLww(before.editedAt?.toISOString() ?? null, at) === 'skip')
      return skipped('SUPERSEDED', 'Оцінку замінено новішою з іншого пристрою');
    if (
      before.deletedAt === null &&
      before.kind === op.kind &&
      before.value === op.value &&
      before.comment === op.comment
    )
      return skipped('UNCHANGED', 'Оцінка вже збережена');
    await ctx.db.grade.update({
      where: { id: op.gradeId },
      data: {
        kind: op.kind,
        value: op.value,
        comment: op.comment,
        editedAt: new Date(at),
        deletedAt: null,
        version: { increment: 1 },
      },
    });
  } else {
    await ctx.db.grade.create({
      data: {
        id: op.gradeId,
        enrollmentId: op.enrollmentId,
        lessonId: op.lessonId,
        kind: op.kind,
        value: op.value,
        comment: op.comment,
        editedAt: new Date(at),
      },
    });
  }
  await audit(ctx.db, ctx, {
    entity: 'Grade',
    entityId: op.gradeId,
    op: 'UPSERT',
    before: before ? { kind: before.kind, value: before.value, comment: before.comment } : null,
    after: { enrollmentId: op.enrollmentId, lessonId: op.lessonId, kind: op.kind, value: op.value },
  });
  return applied();
}

async function applyGradeDelete(
  ctx: AuthContext,
  op: Extract<SyncOp, { type: 'grade.delete' }>,
  at: string,
): Promise<Outcome> {
  const lesson = await findLesson(ctx, op.lessonId);
  authorize(ctx, 'grade:write', lesson.teacherId);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);

  const before = await ctx.db.grade.findUnique({ where: { id: op.gradeId } });
  if (before?.lessonId !== op.lessonId || before.deletedAt !== null)
    return skipped('UNCHANGED', 'Оцінки вже немає');
  if (resolveLww(before.editedAt?.toISOString() ?? null, at) === 'skip')
    return skipped('SUPERSEDED', 'Оцінку змінено на іншому пристрої пізніше');

  await ctx.db.grade.update({
    where: { id: op.gradeId },
    data: { deletedAt: new Date(), editedAt: new Date(at), version: { increment: 1 } },
  });
  await audit(ctx.db, ctx, {
    entity: 'Grade',
    entityId: op.gradeId,
    op: 'DELETE',
    before: { kind: before.kind, value: before.value, comment: before.comment },
    after: null,
  });
  return applied();
}

async function applyAssessmentGrade(
  ctx: AuthContext,
  op: Extract<SyncOp, { type: 'assessment.grade.set' | 'assessment.grade.clear' }>,
  at: string,
): Promise<Outcome> {
  authorize(ctx, 'grade:write', await assessmentOwner(ctx, op.assessmentId));
  const change =
    op.type === 'assessment.grade.set' ? { value: op.value, comment: op.comment } : null;
  const { outcome } = await writeAssessmentGrade(ctx, op.assessmentId, op.enrollmentId, change, at);
  if (outcome === 'superseded')
    return skipped('SUPERSEDED', 'Оцінку замінено новішою з іншого пристрою');
  if (outcome === 'unchanged') return skipped('UNCHANGED', 'Оцінка вже збережена');
  return applied();
}

async function applyLessonInfo(
  ctx: AuthContext,
  op: Extract<SyncOp, { type: 'lesson.info' }>,
): Promise<Outcome> {
  const lesson = await findLesson(ctx, op.lessonId);
  authorize(ctx, 'lesson:update', lesson.teacherId);
  assertWritable(lesson);
  await assertSemesterOpen(ctx, lesson);
  const data = definedOnly({
    topicText: op.topicText,
    homework: op.homework,
    note: op.note,
  });
  const changed = (Object.keys(data) as (keyof typeof data)[]).some((k) => lesson[k] !== data[k]);
  if (!changed) return skipped('UNCHANGED', 'Зміни вже збережені');
  await ctx.db.lesson.update({
    where: { id: op.lessonId },
    data: { ...data, version: { increment: 1 } },
  });
  return applied();
}

async function applyFinish(
  ctx: AuthContext,
  op: Extract<SyncOp, { type: 'lesson.finish' }>,
): Promise<Outcome> {
  const lesson = await findLesson(ctx, op.lessonId);
  authorize(ctx, 'lesson:update', lesson.teacherId);
  if (lesson.status === 'HELD') return skipped('UNCHANGED', 'Заняття вже завершено');
  await finishLesson(ctx, op.lessonId);
  return applied();
}

async function applyReopen(
  ctx: AuthContext,
  op: Extract<SyncOp, { type: 'lesson.reopen' }>,
): Promise<Outcome> {
  const lesson = await findLesson(ctx, op.lessonId);
  authorize(ctx, 'lesson:update', lesson.teacherId);
  if (lesson.status !== 'HELD') return skipped('UNCHANGED', 'Заняття не завершено');
  await reopenLesson(ctx, op.lessonId);
  return applied();
}

async function applyOp(ctx: AuthContext, op: SyncOp, now: string): Promise<Outcome> {
  const at = clampOpTime(op.at, now);
  switch (op.type) {
    case 'attendance.set':
      return applyAttendance(ctx, op, at);
    case 'grade.set':
      return applyGradeSet(ctx, op, at);
    case 'grade.delete':
      return applyGradeDelete(ctx, op, at);
    case 'assessment.grade.set':
    case 'assessment.grade.clear':
      return applyAssessmentGrade(ctx, op, at);
    case 'lesson.info':
      return applyLessonInfo(ctx, op);
    case 'lesson.finish':
      return applyFinish(ctx, op);
    case 'lesson.reopen':
      return applyReopen(ctx, op);
  }
}

/**
 * Застосовує пачку операцій по черзі. Результат кожної фіксується в SyncOp, тож повторна відправка
 * (обрив мережі до відповіді) повертає той самий результат і нічого не застосовує двічі.
 * Бізнес-відмови стають `rejected`; непередбачені помилки обривають запит (клієнт повторить).
 */
export async function push(ctx: AuthContext, ops: readonly SyncOp[]): Promise<PushResponse> {
  const done = await ctx.db.syncOp.findMany({
    where: { id: { in: ops.map((o) => o.opId) }, userId: ctx.user.id },
  });
  const known = new Map(done.map((d) => [d.id, d]));
  const results: SyncResult[] = [];

  for (const op of ops) {
    const previous = known.get(op.opId);
    if (previous) {
      results.push({
        opId: op.opId,
        status: previous.status as SyncResult['status'],
        ...(previous.code !== null && { code: previous.code }),
        ...(previous.message !== null && { message: previous.message }),
      });
      continue;
    }
    let outcome: Outcome;
    try {
      outcome = await applyOp(ctx, op, new Date().toISOString());
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      outcome = { status: 'rejected', code: error.code, message: error.detail ?? error.title };
    }
    await ctx.db.syncOp.create({
      data: {
        id: op.opId,
        userId: ctx.user.id,
        status: outcome.status,
        code: outcome.code ?? null,
        message: outcome.message ?? null,
      },
    });
    results.push({ opId: op.opId, ...outcome });
  }
  return { results };
}

/**
 * Знімок або дельта: заняття викладача у вікні дат, що змінилися після `since`
 * (саме заняття, його відмітки чи оцінки). Без `since` — повний знімок.
 */
export async function pull(ctx: AuthContext, since: string | undefined): Promise<PullResponse> {
  const startedAt = Date.now();
  const today = ctx.today();
  const from = addDaysIso(today, -WINDOW_DAYS);
  const to = addDaysIso(today, WINDOW_DAYS);
  const sinceDate = since === undefined ? null : new Date(since);

  const changed: Prisma.LessonWhereInput =
    sinceDate === null
      ? {}
      : {
          OR: [
            { updatedAt: { gt: sinceDate } },
            { attendance: { some: { updatedAt: { gt: sinceDate } } } },
            { grades: { some: { updatedAt: { gt: sinceDate } } } },
          ],
        };
  const scope: Prisma.LessonWhereInput = {
    teacherId: ctx.user.id,
    load: { semester: semesterScope(ctx.organization.id) },
    date: { gte: dateOf(from), lte: dateOf(to) },
    ...changed,
  };

  const rows = await ctx.db.lesson.findMany({
    where: scope,
    select: { id: true, deletedAt: true },
    orderBy: [{ date: 'asc' }, { pairNumber: 'asc' }],
    take: MAX_LESSONS,
  });
  const lessons = await mapLimit(
    rows.filter((r) => r.deletedAt === null),
    PULL_CONCURRENCY,
    (row) => getLessonDetail(ctx, row.id),
  );
  const bells = await ctx.db.bellTime.findMany({
    where: { deletedAt: null },
    orderBy: { pairNumber: 'asc' },
  });

  return {
    cursor: new Date(startedAt - CURSOR_OVERLAP_MS).toISOString(),
    window: { from, to },
    bells: bells.map((b) => ({ pairNumber: b.pairNumber, startsAt: b.startsAt, endsAt: b.endsAt })),
    lessons,
    removedLessonIds: sinceDate === null ? [] : rows.filter((r) => r.deletedAt).map((r) => r.id),
  };
}
