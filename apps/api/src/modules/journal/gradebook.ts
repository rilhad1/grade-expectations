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

import { conflict, notFound } from '../../errors.js';
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

/** Періоди семестру для курсу групи навантаження: свого курсу, а також спільні (без курсу). */
export function periodsFor(load: JournalLoad) {
  const own = load.semester.periods.filter((p) => p.course === load.group.course);
  const ownKinds = new Set(own.map((p) => p.kind));
  // Період свого курсу заміщає спільний (без курсу) того ж виду
  const common = load.semester.periods.filter((p) => p.course === null && !ownKinds.has(p.kind));
  return [...common, ...own].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

const ASSESSMENT_PERIOD = {
  INTERIM: 'INTERIM_ATTESTATION',
  DIRECTOR_TEST: 'DIRECTOR_TEST',
  EXAM: 'EXAM_SESSION',
  AVERAGE: null,
} as const;

/**
 * Умовна дата оцінки колонки: початок періоду її атестації (для курсу групи). Так колонка потрапляє
 * в модуль своєї атестації й наступні (OQ-23), але не в попередні; без прив'язки — початок семестру.
 */
export function assessmentDate(
  load: JournalLoad,
  attestationKind: keyof typeof ASSESSMENT_PERIOD | null,
): string {
  const semesterFrom = isoOf(load.semester.startDate);
  const periodKind = attestationKind === null ? null : ASSESSMENT_PERIOD[attestationKind];
  const period = periodKind ? periodsFor(load).find((p) => p.kind === periodKind) : undefined;
  return period ? isoOf(period.startDate) : semesterFrom;
}

export const rulesOf = (load: { gradingRules: unknown }): GradingRules =>
  gradingRulesSchema.safeParse(load.gradingRules).data ?? defaultGradingRules;

export interface StudentData {
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

/** Вид занять, чиї правила оцінювання вважаються основними в зведеному журналі. */
const PRIMARY_KIND_ORDER = ['PRACTICE', 'LAB', 'SEMINAR', 'CONTROL', 'LECTURE'] as const;

/**
 * Споріднені навантаження зведеного журналу: той самий семестр, дисципліна, група й підгрупа,
 * усіх видів занять; викладач бачить лише власні. Перше — основне (правила оцінювання).
 */
export async function siblingLoads(ctx: AuthContext, load: JournalLoad) {
  const rows = await ctx.db.teachingLoad.findMany({
    where: {
      semesterId: load.semesterId,
      disciplineId: load.disciplineId,
      groupId: load.groupId,
      subgroupId: load.subgroupId,
      deletedAt: null,
      ...(!isModerator(ctx) && { teacherId: ctx.user.id }),
    },
    select: { id: true, kind: true, gradingRules: true },
  });
  const rank = (kind: (typeof PRIMARY_KIND_ORDER)[number]) => PRIMARY_KIND_ORDER.indexOf(kind);
  return rows.sort((a, b) => rank(a.kind) - rank(b.kind) || a.id.localeCompare(b.id));
}

/** Шкалу не можна змінити, коли в журналі (усіх видів занять) уже є оцінки: у заняттях або в колонках оцінювання. */
export async function assertScaleUnlocked(
  ctx: AuthContext,
  load: JournalLoad,
  newScale: GradingRules['scale'],
) {
  if (newScale === rulesOf(load).scale) return;
  const ids = [...new Set([load.id, ...(await siblingLoads(ctx, load)).map((l) => l.id)])];
  const graded = await ctx.db.grade.count({
    where: {
      deletedAt: null,
      OR: [{ lesson: { loadId: { in: ids } } }, { assessment: { loadId: { in: ids } } }],
    },
  });
  if (graded > 0) throw conflict('SCALE_LOCKED', 'Шкалу не можна змінити: оцінки вже виставлено');
}

/** Дані журналу: заняття, студенти, відмітки й оцінки навантаження (або кількох споріднених). */
export async function loadGradebookData(
  ctx: AuthContext,
  load: JournalLoad,
  range: { from?: string | undefined; to?: string | undefined } = {},
  loadIds: readonly string[] = [load.id],
) {
  const lessons = await ctx.db.lesson.findMany({
    where: {
      loadId: { in: [...loadIds] },
      deletedAt: null,
      status: { in: ['PLANNED', 'HELD', 'SUBSTITUTED'] },
      ...((range.from !== undefined || range.to !== undefined) && {
        date: {
          ...(range.from !== undefined && { gte: dateOf(range.from) }),
          ...(range.to !== undefined && { lte: dateOf(range.to) }),
        },
      }),
    },
    include: { topic: true, load: { select: { kind: true } } },
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
  const [attendance, grades, assessmentRows] = await Promise.all([
    ctx.db.attendance.findMany({ where: { lessonId: { in: lessonIds }, deletedAt: null } }),
    ctx.db.grade.findMany({
      where: { lessonId: { in: lessonIds }, deletedAt: null },
      orderBy: { id: 'asc' },
    }),
    ctx.db.assessment.findMany({
      where: { loadId: { in: [...loadIds] }, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { title: 'asc' }],
    }),
  ]);
  // Колонки з умовною датою в межах запитаного діапазону (для модулів атестації)
  const assessments = assessmentRows
    .map((a) => ({ ...a, date: assessmentDate(load, a.attestationKind) }))
    .filter(
      (a) =>
        (range.from === undefined || a.date >= range.from) &&
        (range.to === undefined || a.date <= range.to),
    );
  const assessmentGrades = await ctx.db.grade.findMany({
    where: { assessmentId: { in: assessments.map((a) => a.id) }, deletedAt: null },
    orderBy: { id: 'asc' },
  });
  return { lessons, enrollments, attendance, grades, assessments, assessmentGrades };
}

export async function getGradebook(
  ctx: AuthContext,
  loadId: string,
  range: { from?: string | undefined; to?: string | undefined },
): Promise<GradebookDto> {
  const load = await findJournalLoad(ctx, loadId);
  // Один журнал на дисципліну й групу: усі види занять разом, правила — основного навантаження
  const siblings = await siblingLoads(ctx, load);
  const rules = rulesOf(siblings[0] ?? load);
  const { lessons, enrollments, attendance, grades, assessments, assessmentGrades } =
    await loadGradebookData(
      ctx,
      load,
      range,
      siblings.map((l) => l.id),
    );
  const dateOfLesson = new Map(lessons.map((l) => [l.id, isoOf(l.date)]));
  const assessmentById = new Map(assessments.map((a) => [a.id, a]));
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
    const assessmentCells: Record<
      string,
      { id: string; value: number; comment: string | null; version: number }
    > = {};
    for (const g of assessmentGrades.filter((x) => x.enrollmentId === e.id)) {
      const a = assessmentById.get(g.assessmentId ?? '');
      if (!a) continue;
      assessmentCells[a.id] = { id: g.id, value: g.value, comment: g.comment, version: g.version };
      own.grades.push({ kind: g.kind, value: g.value, date: a.date });
    }
    return {
      enrollmentId: e.id,
      studentId: e.studentId,
      lastName: e.student.lastName,
      firstName: e.student.firstName,
      middleName: e.student.middleName,
      enrollmentStatus: e.status,
      cells,
      assessmentGrades: assessmentCells,
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
      kind: l.load.kind,
      status: l.status === 'HELD' ? 'HELD' : l.status === 'SUBSTITUTED' ? 'SUBSTITUTED' : 'PLANNED',
      topic: l.topicText ?? l.topic?.title ?? null,
    })),
    students,
    assessments: assessments.map((a) => ({
      id: a.id,
      title: a.title,
      kind: a.kind,
      maxScore: a.maxScore,
      attestationKind: a.attestationKind,
      version: a.version,
    })),
    periods: periodsFor(load)
      .filter((p) => ['INTERIM_ATTESTATION', 'DIRECTOR_TEST', 'EXAM_SESSION'].includes(p.kind))
      .map((p) => ({ kind: p.kind, startDate: isoOf(p.startDate), endDate: isoOf(p.endDate) })),
  };
}
