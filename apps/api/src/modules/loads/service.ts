import { hoursProgress } from '@ge/domain';
import {
  defaultGradingRules,
  gradingRulesSchema,
  type CreateLoadInput,
  type LoadDto,
  type UpdateLoadInput,
} from '@ge/shared';
import type { Prisma } from '@prisma/client';

import { conflict, notFound, unprocessable } from '../../errors.js';
import { definedOnly, isoOf, newId, pageArgs, toPage } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { semesterScope } from '../semesters/repo.js';

const loadScope = (organizationId: string) =>
  ({
    semester: semesterScope(organizationId),
    deletedAt: null,
  }) satisfies Prisma.TeachingLoadWhereInput;

const include = {
  discipline: { select: { id: true, title: true, shortTitle: true, color: true } },
  group: { select: { id: true, name: true } },
  subgroup: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.TeachingLoadInclude;

type LoadRow = Prisma.TeachingLoadGetPayload<{ include: typeof include }>;
type LessonHours = {
  loadId: string;
  status: 'PLANNED' | 'HELD' | 'CANCELLED' | 'MOVED' | 'SUBSTITUTED';
  date: Date;
  hours: number;
};

function toDto(row: LoadRow, lessons: readonly LessonHours[], today: string): LoadDto {
  const own = lessons
    .filter((l) => l.loadId === row.id)
    .map((l) => ({ status: l.status, date: isoOf(l.date), hours: l.hours }));
  return {
    id: row.id,
    semesterId: row.semesterId,
    kind: row.kind,
    plannedHours: row.plannedHours,
    controlForm: row.controlForm,
    // Пошкоджений JSON не має ламати список: падаємо назад на правила за замовчуванням
    gradingRules: gradingRulesSchema.safeParse(row.gradingRules).data ?? defaultGradingRules,
    discipline: row.discipline,
    group: row.group,
    subgroup: row.subgroup,
    teacher: row.teacher,
    hours: hoursProgress({ plannedHours: row.plannedHours }, own, today),
    version: row.version,
  };
}

async function lessonsOf(ctx: AuthContext, loadIds: string[]): Promise<LessonHours[]> {
  if (loadIds.length === 0) return [];
  return ctx.db.lesson.findMany({
    where: { loadId: { in: loadIds }, deletedAt: null },
    select: { loadId: true, status: true, date: true, hours: true },
  });
}

const isModerator = (ctx: AuthContext) => ctx.roles.includes('MODERATOR');

async function loadOne(ctx: AuthContext, id: string): Promise<LoadDto | null> {
  const row = await ctx.db.teachingLoad.findFirst({
    where: { id, ...loadScope(ctx.organization.id) },
    include,
  });
  return row ? toDto(row, await lessonsOf(ctx, [row.id]), ctx.today()) : null;
}

export async function listLoads(
  ctx: AuthContext,
  filter: {
    semesterId: string;
    groupId?: string | undefined;
    teacherId?: string | undefined;
    cursor?: string | undefined;
    limit: number;
  },
) {
  // Викладач бачить лише власне навантаження; деканат — усе
  const teacherId = isModerator(ctx) ? filter.teacherId : ctx.user.id;
  const rows = await ctx.db.teachingLoad.findMany({
    where: {
      ...loadScope(ctx.organization.id),
      semesterId: filter.semesterId,
      ...(filter.groupId !== undefined && { groupId: filter.groupId }),
      ...(teacherId !== undefined && { teacherId }),
    },
    include,
    ...pageArgs(filter.cursor, filter.limit),
  });
  const page = toPage(rows, filter.limit);
  const lessons = await lessonsOf(
    ctx,
    page.items.map((r) => r.id),
  );
  const now = ctx.today();
  return { items: page.items.map((r) => toDto(r, lessons, now)), nextCursor: page.nextCursor };
}

export async function getLoad(ctx: AuthContext, id: string): Promise<LoadDto> {
  const dto = await loadOne(ctx, id);
  if (!dto || (!isModerator(ctx) && dto.teacher.id !== ctx.user.id))
    throw notFound('Навантаження не знайдено');
  return dto;
}

async function requireOpenSemester(ctx: AuthContext, semesterId: string) {
  const semester = await ctx.db.semester.findFirst({
    where: { id: semesterId, ...semesterScope(ctx.organization.id) },
  });
  if (!semester) throw notFound('Семестр не знайдено');
  if (semester.status === 'CLOSED')
    throw conflict('SEMESTER_CLOSED', 'Закритий семестр доступний лише для читання');
  return semester;
}

async function requireTeacher(ctx: AuthContext, teacherId: string) {
  const membership = await ctx.db.membership.findFirst({
    where: { userId: teacherId, deletedAt: null, roles: { has: 'TEACHER' } },
  });
  if (!membership) throw unprocessable('NOT_A_TEACHER', 'Користувач не є викладачем цього коледжу');
}

export async function createLoad(ctx: AuthContext, input: CreateLoadInput): Promise<LoadDto> {
  const semester = await requireOpenSemester(ctx, input.semesterId);
  const discipline = await ctx.db.discipline.findFirst({
    where: { id: input.disciplineId, deletedAt: null },
  });
  const group = await ctx.db.group.findFirst({
    where: { id: input.groupId, cohort: { organizationId: ctx.organization.id }, deletedAt: null },
  });
  if (!discipline || !group) throw notFound('Дисципліну або групу не знайдено');
  if (group.academicYearId !== semester.academicYearId) {
    throw unprocessable('GROUP_YEAR_MISMATCH', 'Група належить іншому навчальному року');
  }
  if (input.subgroupId !== null) {
    const sub = await ctx.db.subgroup.findFirst({
      where: { id: input.subgroupId, groupId: group.id, deletedAt: null },
    });
    if (!sub) throw unprocessable('SUBGROUP_NOT_IN_GROUP', 'Підгрупа не належить цій групі');
  }
  await requireTeacher(ctx, input.teacherId);

  const duplicate = await ctx.db.teachingLoad.findFirst({
    where: {
      semesterId: semester.id,
      disciplineId: discipline.id,
      groupId: group.id,
      subgroupId: input.subgroupId,
      kind: input.kind,
      deletedAt: null,
    },
  });
  if (duplicate) throw conflict('DUPLICATE_LOAD', 'Таке навантаження вже існує');

  const id = newId(input.id);
  await ctx.db.teachingLoad.create({
    data: {
      id,
      semesterId: semester.id,
      disciplineId: discipline.id,
      groupId: group.id,
      subgroupId: input.subgroupId,
      teacherId: input.teacherId,
      kind: input.kind,
      plannedHours: input.plannedHours,
      controlForm: input.controlForm,
      gradingRules: input.gradingRules ?? {
        ...defaultGradingRules,
        scale: discipline.defaultScale,
      },
    },
  });
  return getLoad(ctx, id);
}

export async function updateLoad(
  ctx: AuthContext,
  id: string,
  input: UpdateLoadInput,
): Promise<LoadDto> {
  const current = await ctx.db.teachingLoad.findFirst({
    where: { id, ...loadScope(ctx.organization.id) },
  });
  if (!current) throw notFound('Навантаження не знайдено');
  await requireOpenSemester(ctx, current.semesterId);
  if (input.teacherId !== undefined) await requireTeacher(ctx, input.teacherId);

  const { version, gradingRules, ...rest } = input;
  await ctx.db.$transaction(async (tx) => {
    const { count } = await tx.teachingLoad.updateMany({
      where: { id, version, deletedAt: null },
      data: {
        ...definedOnly(rest),
        ...(gradingRules !== undefined && { gradingRules }),
        version: { increment: 1 },
      },
    });
    if (count === 0)
      throw conflict('VERSION_CONFLICT', 'Навантаження змінено на іншому пристрої; оновіть дані');

    // Нового викладача отримують лише майбутні непроведені заняття; проведені лишаються за тим, хто їх вів
    if (input.teacherId !== undefined && input.teacherId !== current.teacherId) {
      await tx.lesson.updateMany({
        where: {
          loadId: id,
          status: 'PLANNED',
          date: { gte: new Date(`${ctx.today()}T00:00:00.000Z`) },
          deletedAt: null,
        },
        data: { teacherId: input.teacherId, version: { increment: 1 } },
      });
    }
  });
  return getLoad(ctx, id);
}

export async function deleteLoad(ctx: AuthContext, id: string): Promise<void> {
  const current = await ctx.db.teachingLoad.findFirst({
    where: { id, ...loadScope(ctx.organization.id) },
  });
  if (!current) throw notFound('Навантаження не знайдено');
  await requireOpenSemester(ctx, current.semesterId);

  if ((await ctx.db.scheduleSlot.count({ where: { loadId: id, deletedAt: null } })) > 0) {
    throw conflict(
      'LOAD_IN_SCHEDULE',
      'Навантаження розставлене в розкладі; спершу приберіть слоти',
    );
  }
  if ((await ctx.db.lesson.count({ where: { loadId: id, status: 'HELD', deletedAt: null } })) > 0) {
    throw conflict('LOAD_HAS_LESSONS', 'За цим навантаженням уже є проведені заняття');
  }
  await ctx.db.teachingLoad.update({
    where: { id },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
}
