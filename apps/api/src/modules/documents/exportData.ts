import PizZip from 'pizzip';

import { isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';

const BOM = String.fromCharCode(0xfeff);

/** Екранування клітинки CSV; крапка з комою — роздільник, який очікує Excel в українській локалі. */
const csvCell = (value: string | number | null): string => {
  const text = value === null ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = (rows: (string | number | null)[][]): string =>
  `${BOM}${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`;

const safeName = (text: string) => text.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60);

/**
 * Усі дані викладача одним архівом: навантаження (JSON), журнал кожного навантаження (CSV, студенти ×
 * заняття) і сирі записи оцінок, відвідуваності та результатів атестацій (JSON).
 */
export async function buildDataExport(ctx: AuthContext, generatedAt: Date): Promise<Buffer> {
  const loads = await ctx.db.teachingLoad.findMany({
    where: {
      teacherId: ctx.user.id,
      deletedAt: null,
      semester: { academicYear: { organizationId: ctx.organization.id }, deletedAt: null },
    },
    include: { discipline: true, group: true, subgroup: true, semester: true },
    orderBy: { id: 'asc' },
  });

  const zip = new PizZip();
  zip.file(
    'README.txt',
    `Експорт даних викладача ${ctx.user.fullName}\r\nСформовано: ${generatedAt.toISOString()}\r\n\r\n` +
      'loads.json — навантаження; journal-*.csv — журнали (студенти × заняття);\r\n' +
      'raw-*.json — оцінки, відвідуваність і результати атестацій у вихідному вигляді.\r\n',
  );
  zip.file(
    'loads.json',
    JSON.stringify(
      loads.map((l) => ({
        id: l.id,
        semester: `${isoOf(l.semester.startDate)} — ${isoOf(l.semester.endDate)}`,
        discipline: l.discipline.title,
        group: l.group.name,
        subgroup: l.subgroup?.name ?? null,
        kind: l.kind,
        plannedHours: l.plannedHours,
        controlForm: l.controlForm,
        gradingRules: l.gradingRules,
      })),
      null,
      2,
    ),
  );

  for (const [index, load] of loads.entries()) {
    const lessons = await ctx.db.lesson.findMany({
      where: { loadId: load.id, deletedAt: null },
      orderBy: [{ date: 'asc' }, { pairNumber: 'asc' }],
    });
    const enrollments = await ctx.db.enrollment.findMany({
      where: {
        groupId: load.groupId,
        deletedAt: null,
        ...(load.subgroupId !== null && {
          subgroups: { some: { subgroupId: load.subgroupId, deletedAt: null } },
        }),
      },
      include: { student: true },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
    const lessonIds = lessons.map((l) => l.id);
    const [grades, attendance, results, assessments, assessmentGrades] = await Promise.all([
      ctx.db.grade.findMany({ where: { lessonId: { in: lessonIds }, deletedAt: null } }),
      ctx.db.attendance.findMany({ where: { lessonId: { in: lessonIds }, deletedAt: null } }),
      ctx.db.attestationResult.findMany({ where: { loadId: load.id, deletedAt: null } }),
      ctx.db.assessment.findMany({
        where: { loadId: load.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      }),
      ctx.db.grade.findMany({
        where: { assessment: { loadId: load.id, deletedAt: null }, deletedAt: null },
      }),
    ]);

    const header = ['Студент', ...lessons.map((l) => `${isoOf(l.date)} п${String(l.pairNumber)}`)];
    const body = enrollments.map((e) => [
      [e.student.lastName, e.student.firstName, e.student.middleName].filter(Boolean).join(' '),
      ...lessons.map((l) => {
        const gradeText = grades
          .filter((g) => g.lessonId === l.id && g.enrollmentId === e.id)
          .map((g) => g.value)
          .join('/');
        const mark = attendance.find((a) => a.lessonId === l.id && a.enrollmentId === e.id);
        const absence = mark && mark.status !== 'PRESENT' ? mark.status : '';
        return [gradeText, absence].filter(Boolean).join(' ');
      }),
    ]);
    const base = `${String(index + 1).padStart(2, '0')}-${safeName(load.discipline.shortTitle)}-${safeName(load.group.name)}`;
    zip.file(`journal-${base}.csv`, csv([header, ...body]));
    zip.file(
      `raw-${base}.json`,
      JSON.stringify(
        {
          loadId: load.id,
          lessons: lessons.map((l) => ({
            id: l.id,
            date: isoOf(l.date),
            pairNumber: l.pairNumber,
            status: l.status,
            topic: l.topicText,
          })),
          grades: grades.map((g) => ({
            lessonId: g.lessonId,
            enrollmentId: g.enrollmentId,
            kind: g.kind,
            value: g.value,
            comment: g.comment,
          })),
          assessments: assessments.map((a) => ({
            id: a.id,
            kind: a.kind,
            title: a.title,
            maxScore: a.maxScore,
            attestationKind: a.attestationKind,
          })),
          assessmentGrades: assessmentGrades.map((g) => ({
            assessmentId: g.assessmentId,
            enrollmentId: g.enrollmentId,
            value: g.value,
            comment: g.comment,
          })),
          attendance: attendance.map((a) => ({
            lessonId: a.lessonId,
            enrollmentId: a.enrollmentId,
            status: a.status,
          })),
          attestationResults: results.map((r) => ({
            attestationId: r.attestationId,
            enrollmentId: r.enrollmentId,
            proposed: r.proposed,
            final: r.final,
            comment: r.comment,
            confirmed: r.confirmed,
          })),
        },
        null,
        2,
      ),
    );
  }
  return zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
