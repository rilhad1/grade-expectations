import { computeSemesterAverage, riskReasons, weightedAverage } from '@ge/domain';
import {
  defaultGradingRules,
  gradingRulesSchema,
  type GradebookCell,
  type GradebookDto,
  type GradingRules,
  type StudentSummary,
} from '@ge/shared';
import type { Prisma } from '@prisma/client';

import { notFound } from '../../errors.js';
import { dateOf, isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { semesterScope } from '../semesters/repo.js';

const isModerator = (ctx: AuthContext) => ctx.roles.includes('MODERATOR');

const loadInclude = {
  discipline: true,
  group: true,
  subgroup: true,
  teacher: { select: { id: true, fullName: true } },
  semester: { include: { periods: { where: { deletedAt: null } } } },
} satisfies Prisma.TeachingLoadInclude;

export type JournalLoad = Prisma.TeachingLoadGetPayload<{ include: typeof loadInclude }>;

/** Навантаження для журналу: викладач бачить лише своє, деканат — будь-яке. */
export async function findJournalLoad(ctx: AuthContext, loadId: string): Promise<JournalLoad> {
  const load = await ctx.db.teachingLoad.findFirst({
    where: { id: loadId, deletedAt: null, semester: semesterScope(ctx.organization.id) },
    include: loadInclude,
  });
  if (!load || (!isModerator(ctx) && load.teacherId !== ctx.user.id))
    throw notFound('Навантаження не знайдено');
  return load;
}

/** Власник навантаження для перевірки прав (can: teacherId). */
export async function loadOwner(ctx: AuthContext, loadId: string): Promise<string> {
  const load = await ctx.db.teachingLoad.findFirst({
    where: { id: loadId, deletedAt: null, semester: semesterScope(ctx.organization.id) },
    select: { teacherId: true },
  });
  if (!load) throw notFound('Навантаження не знайдено');
  return load.teacherId;
}

export const rulesOf = (load: { gradingRules: unknown }): GradingRules =>
  gradingRulesSchema.safeParse(load.gradingRules).data ?? defaultGradingRules;

interface StudentData {
  grades: { kind: GradebookCell['grades'][number]['kind']; value: number; date: string }[];
  attendance: { status: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE'; date: string }[];
}

/** Зведення студента: середній бал, пропуски, пропозиція за правилами, ризик. */
export function summarize(
  data: StudentData,
  rules: GradingRules,
  semester: { from: string; to: string },
): StudentSummary {
  const { average, count } = weightedAverage(data.grades, rules);
  const count_ = (s: StudentData['attendance'][number]['status']) =>
    data.attendance.filter((a) => a.status === s).length;
  const unexcused = count_('ABSENT');
  const held = data.attendance.length;
  const absencePercent = held === 0 ? 0 : (unexcused / held) * 100;
  return {
    average,
    gradesCount: count,
    absences: { unexcused, excused: count_('EXCUSED'), late: count_('LATE') },
    absencePercent,
    heldLessons: held,
    proposal: computeSemesterAverage(data.grades, data.attendance, rules, semester),
    risk: riskReasons({ average, absencePercent, scale: rules.scale }),
  };
}

/** Дані журналу навантаження: заняття, студенти, відмітки й оцінки. */
export async function loadGradebookData(
  ctx: AuthContext,
  load: JournalLoad,
  range: { from?: string | undefined; to?: string | undefined } = {},
) {
  const lessons = await ctx.db.lesson.findMany({
    where: {
      loadId: load.id,
      deletedAt: null,
      status: { in: ['PLANNED', 'HELD', 'SUBSTITUTED'] },
      ...((range.from !== undefined || range.to !== undefined) && {
        date: {
          ...(range.from !== undefined && { gte: dateOf(range.from) }),
          ...(range.to !== undefined && { lte: dateOf(range.to) }),
        },
      }),
    },
    include: { topic: true },
    orderBy: [{ date: 'asc' }, { pairNumber: 'asc' }],
  });
  const enrollments = await ctx.db.enrollment.findMany({
    where: {
      groupId: load.groupId,
      deletedAt: null,
      student: { deletedAt: null },
      ...(load.subgroupId !== null && {
        subgroups: { some: { subgroupId: load.subgroupId, deletedAt: null } },
      }),
    },
    include: { student: true },
    orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
  });
  const lessonIds = lessons.map((l) => l.id);
  const [attendance, grades] = await Promise.all([
    ctx.db.attendance.findMany({ where: { lessonId: { in: lessonIds }, deletedAt: null } }),
    ctx.db.grade.findMany({
      where: { lessonId: { in: lessonIds }, deletedAt: null },
      orderBy: { id: 'asc' },
    }),
  ]);
  return { lessons, enrollments, attendance, grades };
}

export async function getGradebook(
  ctx: AuthContext,
  loadId: string,
  range: { from?: string | undefined; to?: string | undefined },
): Promise<GradebookDto> {
  const load = await findJournalLoad(ctx, loadId);
  const rules = rulesOf(load);
  const { lessons, enrollments, attendance, grades } = await loadGradebookData(ctx, load, range);
  const dateOfLesson = new Map(lessons.map((l) => [l.id, isoOf(l.date)]));
  const semester = { from: isoOf(load.semester.startDate), to: isoOf(load.semester.endDate) };

  const students = enrollments.map((e) => {
    const cells: Record<string, GradebookCell> = {};
    const cell = (lessonId: string) => (cells[lessonId] ??= { attendance: null, grades: [] });

    const own = {
      grades: [] as StudentData['grades'],
      attendance: [] as StudentData['attendance'],
    };
    for (const a of attendance.filter((x) => x.enrollmentId === e.id)) {
      cell(a.lessonId).attendance = a.status;
      own.attendance.push({
        status: a.status,
        date: dateOfLesson.get(a.lessonId) ?? semester.from,
      });
    }
    for (const g of grades.filter((x) => x.enrollmentId === e.id && x.lessonId !== null)) {
      const lessonId = g.lessonId ?? '';
      cell(lessonId).grades.push({
        id: g.id,
        kind: g.kind,
        value: g.value,
        comment: g.comment,
        version: g.version,
      });
      own.grades.push({
        kind: g.kind,
        value: g.value,
        date: dateOfLesson.get(lessonId) ?? semester.from,
      });
    }
    return {
      enrollmentId: e.id,
      studentId: e.studentId,
      lastName: e.student.lastName,
      firstName: e.student.firstName,
      middleName: e.student.middleName,
      enrollmentStatus: e.status,
      cells,
      summary: summarize(own, rules, semester),
    };
  });

  return {
    load: {
      id: load.id,
      kind: load.kind,
      controlForm: load.controlForm,
      gradingRules: rules,
      discipline: {
        id: load.discipline.id,
        title: load.discipline.title,
        shortTitle: load.discipline.shortTitle,
        color: load.discipline.color,
      },
      group: { id: load.group.id, name: load.group.name },
      subgroup: load.subgroup ? { id: load.subgroup.id, name: load.subgroup.name } : null,
      teacher: load.teacher,
    },
    lessons: lessons.map((l) => ({
      id: l.id,
      date: isoOf(l.date),
      pairNumber: l.pairNumber,
      kind: load.kind,
      status: l.status === 'HELD' ? 'HELD' : l.status === 'SUBSTITUTED' ? 'SUBSTITUTED' : 'PLANNED',
      topic: l.topicText ?? l.topic?.title ?? null,
    })),
    students,
    periods: load.semester.periods
      .filter((p) => ['INTERIM_ATTESTATION', 'DIRECTOR_TEST', 'EXAM_SESSION'].includes(p.kind))
      .map((p) => ({ kind: p.kind, startDate: isoOf(p.startDate), endDate: isoOf(p.endDate) })),
  };
}
