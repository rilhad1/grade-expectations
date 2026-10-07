import { resolveLww, SCALE_RANGE } from '@ge/domain';
import {
  gradingRulesSchema,
  defaultGradingRules,
  type AssessmentDto,
  type AssessmentGradeDto,
  type CreateAssessmentInput,
  type SetAssessmentGradeInput,
  type UpdateAssessmentInput,
} from '@ge/shared';

import { conflict, notFound, unprocessable } from '../../errors.js';
import { audit } from '../../lib/audit.js';
import { newId } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { semesterScope } from '../semesters/repo.js';

import { findJournalLoad, siblingLoads } from './gradebook.js';

const gradeKindOf = (kind: string) => (kind === 'TEST' ? ('TEST' as const) : ('PRACTICE' as const));

const toDto = (a: {
  id: string;
  title: string;
  kind: AssessmentDto['kind'];
  maxScore: number;
  attestationKind: AssessmentDto['attestationKind'];
  version: number;
}): AssessmentDto => ({
  id: a.id,
  title: a.title,
  kind: a.kind,
  maxScore: a.maxScore,
  attestationKind: a.attestationKind,
  version: a.version,
});

async function findAssessment(ctx: AuthContext, id: string) {
  const row = await ctx.db.assessment.findFirst({
    where: {
      id,
      deletedAt: null,
      load: { deletedAt: null, semester: semesterScope(ctx.organization.id) },
    },
    include: { load: { include: { semester: true } } },
  });
  if (!row) throw notFound('Колонку оцінювання не знайдено');
  return row;
}

/** Власник колонки (викладач навантаження) для перевірки прав. */
export async function assessmentOwner(ctx: AuthContext, id: string): Promise<string> {
  return (await findAssessment(ctx, id)).load.teacherId;
}

const assertOpen = (status: string) => {
  if (status === 'CLOSED')
    throw conflict('SEMESTER_CLOSED', 'Закритий семестр доступний лише для читання');
};

/** Назва колонки унікальна в межах журналу (серед усіх споріднених навантажень). */
async function assertTitleFree(
  ctx: AuthContext,
  loadIds: readonly string[],
  title: string,
  exceptId?: string,
) {
  const clash = await ctx.db.assessment.findFirst({
    where: {
      loadId: { in: [...loadIds] },
      deletedAt: null,
      title: { equals: title, mode: 'insensitive' },
      ...(exceptId !== undefined && { id: { not: exceptId } }),
    },
    select: { id: true },
  });
  if (clash) throw conflict('DUPLICATE_ASSESSMENT', 'Колонка з такою назвою вже є в журналі');
}

/** Нова колонка: належить основному навантаженню журналу, максимум — за шкалою. */
export async function createAssessment(
  ctx: AuthContext,
  loadId: string,
  input: CreateAssessmentInput,
): Promise<AssessmentDto> {
  const load = await findJournalLoad(ctx, loadId);
  assertOpen(load.semester.status);
  const siblings = await siblingLoads(ctx, load);
  const primary = siblings[0] ?? load;
  await assertTitleFree(
    ctx,
    siblings.map((l) => l.id),
    input.title,
  );
  const scale = (gradingRulesSchema.safeParse(primary.gradingRules).data ?? defaultGradingRules)
    .scale;
  const id = newId(input.id);
  const row = await ctx.db.$transaction(async (tx) => {
    const created = await tx.assessment.create({
      data: {
        id,
        loadId: primary.id,
        kind: input.kind,
        title: input.title,
        maxScore: SCALE_RANGE[scale].max,
        attestationKind: input.attestationKind,
      },
    });
    await audit(tx, ctx, {
      entity: 'Assessment',
      entityId: id,
      op: 'UPSERT',
      before: null,
      after: { loadId: primary.id, title: input.title, attestationKind: input.attestationKind },
    });
    return created;
  });
  return toDto(row);
}

export async function updateAssessment(
  ctx: AuthContext,
  id: string,
  input: UpdateAssessmentInput,
): Promise<AssessmentDto> {
  const current = await findAssessment(ctx, id);
  assertOpen(current.load.semester.status);
  const { version, ...fields } = input;
  if (fields.title !== undefined) {
    const siblings = await siblingLoads(ctx, await findJournalLoad(ctx, current.loadId));
    await assertTitleFree(
      ctx,
      siblings.map((l) => l.id),
      fields.title,
      id,
    );
  }
  const { count } = await ctx.db.assessment.updateMany({
    where: { id, version, deletedAt: null },
    data: {
      ...(fields.title !== undefined && { title: fields.title }),
      ...(fields.kind !== undefined && { kind: fields.kind }),
      ...(fields.attestationKind !== undefined && { attestationKind: fields.attestationKind }),
      version: { increment: 1 },
    },
  });
  if (count === 0)
    throw conflict('VERSION_CONFLICT', 'Колонку змінено на іншому пристрої; оновіть дані');
  const updated = await findAssessment(ctx, id);
  await audit(ctx.db, ctx, {
    entity: 'Assessment',
    entityId: id,
    op: 'UPSERT',
    before: { title: current.title, attestationKind: current.attestationKind },
    after: { title: updated.title, attestationKind: updated.attestationKind },
  });
  return toDto(updated);
}

/** Видалення колонки разом з її оцінками (м'яке). */
export async function deleteAssessment(ctx: AuthContext, id: string): Promise<void> {
  const current = await findAssessment(ctx, id);
  assertOpen(current.load.semester.status);
  const now = new Date();
  await ctx.db.$transaction(async (tx) => {
    await tx.grade.updateMany({
      where: { assessmentId: id, deletedAt: null },
      data: { deletedAt: now, version: { increment: 1 } },
    });
    await tx.assessment.update({
      where: { id },
      data: { deletedAt: now, version: { increment: 1 } },
    });
    await audit(tx, ctx, {
      entity: 'Assessment',
      entityId: id,
      op: 'DELETE',
      before: { title: current.title },
    });
  });
}

async function assertInRoster(
  ctx: AuthContext,
  assessment: Awaited<ReturnType<typeof findAssessment>>,
  enrollmentId: string,
) {
  const found = await ctx.db.enrollment.findFirst({
    where: {
      id: enrollmentId,
      groupId: assessment.load.groupId,
      deletedAt: null,
      ...(assessment.load.subgroupId !== null && {
        subgroups: { some: { subgroupId: assessment.load.subgroupId, deletedAt: null } },
      }),
    },
    select: { id: true },
  });
  if (!found) throw unprocessable('NOT_IN_ROSTER', 'Студента немає в складі журналу');
}

export type AssessmentGradeOutcome = 'applied' | 'unchanged' | 'superseded';

/**
 * Єдиний запис оцінки колонки (REST і черга синхронізації): «останній запис перемагає» по клітинці
 * за часом дії `at`; `value = null` прибирає оцінку. Оцінка студента в колонці одна.
 */
export async function writeAssessmentGrade(
  ctx: AuthContext,
  assessmentId: string,
  enrollmentId: string,
  change: { value: number; comment: string | null } | null,
  at: string,
): Promise<{ outcome: AssessmentGradeOutcome; grade: AssessmentGradeDto | null }> {
  const assessment = await findAssessment(ctx, assessmentId);
  assertOpen(assessment.load.semester.status);
  await assertInRoster(ctx, assessment, enrollmentId);
  if (change) {
    const scale = (
      gradingRulesSchema.safeParse(assessment.load.gradingRules).data ?? defaultGradingRules
    ).scale;
    const { min, max } = SCALE_RANGE[scale];
    if (change.value < min || change.value > max)
      throw unprocessable('GRADE_OUT_OF_SCALE', `Оцінка має бути від ${min} до ${max}`);
  }

  // Остання дія по клітинці (включно з видаленою) визначає, чи не застаріла ця зміна
  const latest = await ctx.db.grade.findFirst({
    where: { assessmentId, enrollmentId },
    orderBy: [{ updatedAt: 'desc' }],
  });
  if (latest && resolveLww(latest.editedAt?.toISOString() ?? null, at) === 'skip')
    return { outcome: 'superseded', grade: null };

  if (!change) {
    if (!latest || latest.deletedAt !== null) return { outcome: 'unchanged', grade: null };
    await ctx.db.$transaction(async (tx) => {
      await tx.grade.update({
        where: { id: latest.id },
        data: { deletedAt: new Date(), editedAt: new Date(at), version: { increment: 1 } },
      });
      await audit(tx, ctx, {
        entity: 'Grade',
        entityId: latest.id,
        op: 'DELETE',
        before: { value: latest.value, assessmentId },
      });
    });
    return { outcome: 'applied', grade: null };
  }

  if (
    latest &&
    latest.deletedAt === null &&
    latest.value === change.value &&
    latest.comment === change.comment
  )
    return {
      outcome: 'unchanged',
      grade: {
        id: latest.id,
        value: latest.value,
        comment: latest.comment,
        version: latest.version,
      },
    };

  const row = await ctx.db.$transaction(async (tx) => {
    const saved = latest
      ? await tx.grade.update({
          where: { id: latest.id },
          data: {
            value: change.value,
            comment: change.comment,
            editedAt: new Date(at),
            deletedAt: null,
            version: { increment: 1 },
          },
        })
      : await tx.grade.create({
          data: {
            id: newId(undefined),
            enrollmentId,
            assessmentId,
            kind: gradeKindOf(assessment.kind),
            value: change.value,
            comment: change.comment,
            editedAt: new Date(at),
          },
        });
    await audit(tx, ctx, {
      entity: 'Grade',
      entityId: saved.id,
      op: 'UPSERT',
      before: latest && latest.deletedAt === null ? { value: latest.value } : null,
      after: { enrollmentId, assessmentId, value: change.value },
    });
    return saved;
  });
  return {
    outcome: 'applied',
    grade: { id: row.id, value: row.value, comment: row.comment, version: row.version },
  };
}

/** Виставляє або змінює оцінку студента в колонці (REST: дія «зараз»). */
export async function setAssessmentGrade(
  ctx: AuthContext,
  assessmentId: string,
  enrollmentId: string,
  input: SetAssessmentGradeInput,
): Promise<AssessmentGradeDto> {
  const { grade } = await writeAssessmentGrade(
    ctx,
    assessmentId,
    enrollmentId,
    { value: input.value, comment: input.comment },
    new Date().toISOString(),
  );
  /* v8 ignore next -- «зараз» не може програти за часом, а оцінка після запису завжди є */
  if (!grade) throw conflict('SUPERSEDED', 'Оцінку замінено новішою');
  return grade;
}

export async function clearAssessmentGrade(
  ctx: AuthContext,
  assessmentId: string,
  enrollmentId: string,
): Promise<void> {
  await writeAssessmentGrade(ctx, assessmentId, enrollmentId, null, new Date().toISOString());
}
