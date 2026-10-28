import { diffDays } from '@ge/domain';
import type { TodayDto } from '@ge/shared';

import { isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { pickAttestation } from '../attestations/pick.js';
import { listLoads } from '../loads/service.js';
import { listLessons } from '../schedules/service.js';
import { semesterScope } from '../semesters/repo.js';

import {
  findJournalLoad,
  loadGradebookData,
  rulesOf,
  summarize,
  type StudentData,
} from './gradebook.js';

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
  // Навантаження пар дня й розміри груп: по одному запиту на різне навантаження, паралельно
  const loadRows = await ctx.db.teachingLoad.findMany({
    where: { id: { in: [...new Set(lessons.map((l) => l.loadId))] } },
    select: { id: true, groupId: true, subgroupId: true },
  });
  const sizes = new Map(
    await Promise.all(
      loadRows.map(async (load) => {
        const n = await ctx.db.enrollment.count({
          where: {
            groupId: load.groupId,
            deletedAt: null,
            status: 'ACTIVE',
            ...(load.subgroupId !== null && {
              subgroups: { some: { subgroupId: load.subgroupId, deletedAt: null } },
            }),
          },
        });
        return [load.id, n] as const;
      }),
    ),
  );
  const withProgress = lessons.map((lesson) => ({
    ...lesson,
    marked: markedBy.get(lesson.id) ?? 0,
    total: sizes.get(lesson.loadId) ?? 0,
  }));

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
  const courseOfGroup = new Map(
    (
      await ctx.db.group.findMany({
        where: { id: { in: [...new Set(hours.map((h) => h.group.id))] } },
        select: { id: true, course: true },
      })
    ).map((g) => [g.id, g.course]),
  );
  const attestations = attestationRows.flatMap((a) => {
    const from = isoOf(a.dateFrom);
    const to = isoOf(a.dateTo);
    const daysUntil = Math.max(0, diffDays(from, date));
    if (to < date || daysUntil > ATTESTATION_HORIZON_DAYS) return [];
    const groups = [
      ...new Set(
        hours
          .filter((h) => a.kind !== 'EXAM' || h.controlForm === 'EXAM')
          // Дати курсу стосуються лише його груп; спільні (0) — лише тих груп, де нема своїх дат
          .filter((h) => {
            const course = courseOfGroup.get(h.group.id) ?? 0;
            return pickAttestation(attestationRows, a.kind, course)?.id === a.id;
          })
          .map((h) => h.group.name),
      ),
    ];
    return groups.length === 0
      ? []
      : [{ kind: a.kind, dateFrom: from, dateTo: to, daysUntil, groups }];
  });

  // Ризик кожного навантаження рахується незалежно, тож паралельно
  const riskByLoad = await Promise.all(
    hours.map(async (h) => {
      const found: TodayDto['risk'] = [];
      const load = await findJournalLoad(ctx, h.id);
      const rules = rulesOf(load);
      const range = { from: isoOf(load.semester.startDate), to: isoOf(load.semester.endDate) };
      const data = await loadGradebookData(ctx, load);
      const dateOfLesson = new Map(data.lessons.map((l) => [l.id, isoOf(l.date)]));
      const dateOfAssessment = new Map(data.assessments.map((a) => [a.id, a.date]));
      // Оцінки й відмітки згруповано за студентом один раз, а не фільтруються для кожного
      const gradesOf = new Map<string, StudentData['grades'][number][]>();
      const attendanceOf = new Map<string, StudentData['attendance'][number][]>();
      const push = <T>(map: Map<string, T[]>, id: string, item: T) => {
        const list = map.get(id);
        if (list) list.push(item);
        else map.set(id, [item]);
      };
      for (const g of data.grades)
        if (g.lessonId !== null)
          push(gradesOf, g.enrollmentId, {
            kind: g.kind,
            value: g.value,
            date: dateOfLesson.get(g.lessonId) ?? range.from,
          });
      for (const g of data.assessmentGrades)
        push(gradesOf, g.enrollmentId, {
          kind: g.kind,
          value: g.value,
          date: dateOfAssessment.get(g.assessmentId ?? '') ?? range.from,
        });
      for (const a of data.attendance)
        push(attendanceOf, a.enrollmentId, {
          status: a.status,
          date: dateOfLesson.get(a.lessonId) ?? range.from,
        });
      for (const e of data.enrollments.filter((x) => x.status === 'ACTIVE')) {
        const s = summarize(
          {
            grades: gradesOf.get(e.id) ?? [],
            attendance: attendanceOf.get(e.id) ?? [],
          },
          rules,
          range,
        );
        if (s.risk.length > 0) {
          found.push({
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
      return found;
    }),
  );
  const risk: TodayDto['risk'] = riskByLoad.flat();
  risk.sort((a, b) => b.reasons.length - a.reasons.length || (a.average ?? 99) - (b.average ?? 99));

  return { date, lessons: withProgress, attestations, risk: risk.slice(0, MAX_RISK), hours };
}
