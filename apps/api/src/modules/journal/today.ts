import { diffDays } from '@ge/domain';
import type { TodayDto } from '@ge/shared';

import { isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { listLoads } from '../loads/service.js';
import { listLessons } from '../schedules/service.js';
import { semesterScope } from '../semesters/repo.js';

import { findJournalLoad, loadGradebookData, rulesOf, summarize } from './gradebook.js';

const ATTESTATION_HORIZON_DAYS = 30;
const MAX_RISK = 30;

/** Дашборд викладача: пари дня, найближчі атестації, зона ризику, вичитка годин. */
export async function getToday(ctx: AuthContext): Promise<TodayDto> {
  const date = ctx.today();
  const semester = await ctx.db.semester.findFirst({
    where: { ...semesterScope(ctx.organization.id), status: 'ACTIVE' },
  });
  const lessons = await listLessons(ctx, { from: date, to: date, teacherId: ctx.user.id });

  // Скільки студентів відмічено на кожній парі
  const marks = await ctx.db.attendance.groupBy({
    by: ['lessonId'],
    where: { lessonId: { in: lessons.map((l) => l.id) }, deletedAt: null },
    _count: { _all: true },
  });
  const markedBy = new Map(marks.map((m) => [m.lessonId, m._count._all]));
  const sizes = new Map<string, number>();
  const sizeOf = async (loadId: string, groupId: string, subgroupId: string | null) => {
    const cached = sizes.get(loadId);
    if (cached !== undefined) return cached;
    const n = await ctx.db.enrollment.count({
      where: {
        groupId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(subgroupId !== null && { subgroups: { some: { subgroupId, deletedAt: null } } }),
      },
    });
    sizes.set(loadId, n);
    return n;
  };
  const withProgress = [];
  for (const lesson of lessons) {
    const load = await ctx.db.teachingLoad.findFirst({
      where: { id: lesson.loadId },
      select: { groupId: true, subgroupId: true },
    });
    withProgress.push({
      ...lesson,
      marked: markedBy.get(lesson.id) ?? 0,
      total: load ? await sizeOf(lesson.loadId, load.groupId, load.subgroupId) : 0,
    });
  }

  if (!semester) return { date, lessons: withProgress, attestations: [], risk: [], hours: [] };

  const hours = (
    await listLoads(ctx, { semesterId: semester.id, teacherId: ctx.user.id, limit: 200 })
  ).items;

  const attestationRows = await ctx.db.attestation.findMany({
    where: {
      semesterId: semester.id,
      deletedAt: null,
      kind: { in: ['INTERIM', 'DIRECTOR_TEST', 'EXAM'] },
    },
    orderBy: { dateFrom: 'asc' },
  });
  const attestations = attestationRows.flatMap((a) => {
    const from = isoOf(a.dateFrom);
    const to = isoOf(a.dateTo);
    const daysUntil = Math.max(0, diffDays(from, date));
    if (to < date || daysUntil > ATTESTATION_HORIZON_DAYS) return [];
    const groups = [
      ...new Set(
        hours.filter((h) => a.kind !== 'EXAM' || h.controlForm === 'EXAM').map((h) => h.group.name),
      ),
    ];
    return groups.length === 0
      ? []
      : [{ kind: a.kind, dateFrom: from, dateTo: to, daysUntil, groups }];
  });

  const risk: TodayDto['risk'] = [];
  for (const h of hours) {
    const load = await findJournalLoad(ctx, h.id);
    const rules = rulesOf(load);
    const range = { from: isoOf(load.semester.startDate), to: isoOf(load.semester.endDate) };
    const data = await loadGradebookData(ctx, load);
    const dateOfLesson = new Map(data.lessons.map((l) => [l.id, isoOf(l.date)]));
    for (const e of data.enrollments.filter((x) => x.status === 'ACTIVE')) {
      const own = {
        grades: data.grades
          .filter((g) => g.enrollmentId === e.id && g.lessonId !== null)
          .map((g) => ({
            kind: g.kind,
            value: g.value,
            date: dateOfLesson.get(g.lessonId ?? '') ?? range.from,
          })),
        attendance: data.attendance
          .filter((a) => a.enrollmentId === e.id)
          .map((a) => ({ status: a.status, date: dateOfLesson.get(a.lessonId) ?? range.from })),
      };
      const s = summarize(own, rules, range);
      if (s.risk.length > 0) {
        risk.push({
          enrollmentId: e.id,
          loadId: load.id,
          lastName: e.student.lastName,
          firstName: e.student.firstName,
          group: load.group.name,
          discipline: load.discipline.shortTitle,
          reasons: s.risk,
          average: s.average,
          absencePercent: s.absencePercent,
        });
      }
    }
  }
  risk.sort((a, b) => b.reasons.length - a.reasons.length || (a.average ?? 99) - (b.average ?? 99));

  return { date, lessons: withProgress, attestations, risk: risk.slice(0, MAX_RISK), hours };
}
