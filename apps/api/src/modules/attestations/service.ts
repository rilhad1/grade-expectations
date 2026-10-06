import {
  computeModuleProposal,
  FINAL_FAIL,
  FINAL_NA,
  FINAL_PASS,
  parseFinal,
  proposalText,
  requiredModules,
  weightedAverage,
} from '@ge/domain';
import {
  AttestationKind,
  uuidv7,
  type AttestationDto,
  type AttestationSheetDto,
  type LoadAttestationsDto,
  type SaveAttestationResultsInput,
} from '@ge/shared';

import { conflict, unprocessable } from '../../errors.js';
import { audit } from '../../lib/audit.js';
import { dateOf, isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import {
  findJournalLoad,
  loadGradebookData,
  rulesOf,
  type JournalLoad,
} from '../journal/gradebook.js';
import { getLoad } from '../loads/service.js';

type Kind = (typeof AttestationKind.values)[number];

/** Період семестру, що відповідає модулю; AVERAGE та відсутній період — увесь семестр. */
function periodOf(load: JournalLoad, kind: Kind): { from: string; to: string } {
  const semesterFrom = isoOf(load.semester.startDate);
  const semesterTo = isoOf(load.semester.endDate);
  const periodKind =
    kind === 'INTERIM' ? 'INTERIM_ATTESTATION' : kind === 'EXAM' ? 'EXAM_SESSION' : kind;
  const period =
    kind === 'AVERAGE' ? undefined : load.semester.periods.find((p) => p.kind === periodKind);
  return period
    ? { from: isoOf(period.startDate), to: isoOf(period.endDate) }
    : { from: semesterFrom, to: semesterTo };
}

const toAttestationDto = (row: {
  id: string;
  semesterId: string;
  kind: Kind;
  dateFrom: Date;
  dateTo: Date;
}): AttestationDto => ({
  id: row.id,
  semesterId: row.semesterId,
  kind: row.kind,
  dateFrom: isoOf(row.dateFrom),
  dateTo: isoOf(row.dateTo),
});

/** Модулі семестру створюються при першому зверненні за датами періодів семестру. */
async function ensureAttestations(ctx: AuthContext, load: JournalLoad) {
  const existing = await ctx.db.attestation.findMany({
    where: { semesterId: load.semesterId, deletedAt: null },
  });
  const missing = AttestationKind.values.filter((k) => !existing.some((a) => a.kind === k));
  if (missing.length > 0) {
    await ctx.db.attestation.createMany({
      data: missing.map((kind) => {
        const range = periodOf(load, kind);
        return {
          id: uuidv7(),
          semesterId: load.semesterId,
          kind,
          dateFrom: dateOf(range.from),
          dateTo: dateOf(range.to),
        };
      }),
      skipDuplicates: true,
    });
    return ctx.db.attestation.findMany({
      where: { semesterId: load.semesterId, deletedAt: null },
    });
  }
  return existing;
}

/** Числове значення пропозиції для збереження; «н/а» — null. */
function proposedOf(text: string): number | null {
  if (text === FINAL_PASS) return 1;
  if (text === FINAL_FAIL) return 0;
  return text === FINAL_NA ? null : Number(text);
}

async function requireModule(ctx: AuthContext, load: JournalLoad, kind: Kind) {
  if (!requiredModules(load.controlForm).includes(kind))
    throw unprocessable('MODULE_NOT_REQUIRED', 'Цей модуль не передбачений формою контролю');
  const attestation = (await ensureAttestations(ctx, load)).find((a) => a.kind === kind);
  /* v8 ignore next -- ensureAttestations створює всі види */
  if (!attestation) throw unprocessable('MODULE_NOT_FOUND', 'Модуль не знайдено');
  return attestation;
}

export async function listLoadAttestations(
  ctx: AuthContext,
  loadId: string,
): Promise<LoadAttestationsDto> {
  const load = await findJournalLoad(ctx, loadId);
  const attestations = await ensureAttestations(ctx, load);
  const total = await ctx.db.enrollment.count({
    where: {
      groupId: load.groupId,
      deletedAt: null,
      student: { deletedAt: null },
      ...(load.subgroupId !== null && {
        subgroups: { some: { subgroupId: load.subgroupId, deletedAt: null } },
      }),
    },
  });
  const confirmedRows = await ctx.db.attestationResult.groupBy({
    by: ['attestationId'],
    where: { loadId, confirmed: true, deletedAt: null },
    _count: { _all: true },
  });
  const modules = requiredModules(load.controlForm).flatMap((kind) => {
    const attestation = attestations.find((a) => a.kind === kind);
    if (!attestation) return [];
    return [
      {
        ...toAttestationDto(attestation),
        total,
        confirmed: confirmedRows.find((r) => r.attestationId === attestation.id)?._count._all ?? 0,
      },
    ];
  });
  return { load: await getLoad(ctx, loadId), modules };
}

export async function getSheet(
  ctx: AuthContext,
  loadId: string,
  kind: Kind,
): Promise<AttestationSheetDto> {
  const load = await findJournalLoad(ctx, loadId);
  const attestation = await requireModule(ctx, load, kind);
  const rules = rulesOf(load);
  // Модуль охоплює все від початку семестру до кінця його періоду (OQ-23)
  const semesterFrom = isoOf(load.semester.startDate);
  const range = { from: semesterFrom, to: isoOf(attestation.dateTo) };

  const { lessons, enrollments, attendance, grades } = await loadGradebookData(ctx, load, range);
  const dateOfLesson = new Map(lessons.map((l) => [l.id, isoOf(l.date)]));
  const results = await ctx.db.attestationResult.findMany({
    where: { attestationId: attestation.id, loadId, deletedAt: null },
  });

  const students = enrollments.map((e) => {
    const own = {
      grades: grades
        .filter((g) => g.enrollmentId === e.id)
        .map((g) => ({
          kind: g.kind,
          value: g.value,
          date: dateOfLesson.get(g.lessonId ?? '') ?? semesterFrom,
        })),
      attendance: attendance
        .filter((a) => a.enrollmentId === e.id)
        .map((a) => ({
          status: a.status,
          date: dateOfLesson.get(a.lessonId) ?? semesterFrom,
        })),
    };
    const proposal = computeModuleProposal(own.grades, own.attendance, rules, range);
    const { average, count } = weightedAverage(own.grades, rules);
    const unexcused = own.attendance.filter((a) => a.status === 'ABSENT').length;
    const result = results.find((r) => r.enrollmentId === e.id);
    return {
      enrollmentId: e.id,
      studentId: e.studentId,
      lastName: e.student.lastName,
      firstName: e.student.firstName,
      middleName: e.student.middleName,
      enrollmentStatus: e.status,
      proposal: {
        text: proposalText(rules.scale, proposal),
        isNa: proposal.value === 'NA',
        explanation: proposal.explanation,
      },
      average,
      gradesCount: count,
      absencePercent: own.attendance.length === 0 ? 0 : (unexcused / own.attendance.length) * 100,
      result: result
        ? {
            final: result.final,
            comment: result.comment,
            confirmed: result.confirmed,
            version: result.version,
          }
        : null,
    };
  });

  return {
    attestation: toAttestationDto(attestation),
    load: {
      id: load.id,
      kind: load.kind,
      controlForm: load.controlForm,
      scale: rules.scale,
      disciplineTitle: load.discipline.title,
      groupName: load.group.name,
      subgroupName: load.subgroup?.name ?? null,
      teacherName: load.teacher.fullName,
    },
    range,
    students,
  };
}

export async function saveResults(
  ctx: AuthContext,
  loadId: string,
  kind: Kind,
  input: SaveAttestationResultsInput,
): Promise<AttestationSheetDto> {
  const load = await findJournalLoad(ctx, loadId);
  if (load.semester.status === 'CLOSED')
    throw conflict('SEMESTER_CLOSED', 'Закритий семестр доступний лише для читання');
  const attestation = await requireModule(ctx, load, kind);
  const scale = rulesOf(load).scale;

  const sheet = await getSheet(ctx, loadId, kind);
  const roster = new Map(sheet.students.map((s) => [s.enrollmentId, s]));

  // Спершу перевіряємо все, щоб не зберегти пакет частково
  const prepared = input.results.map((item) => {
    const student = roster.get(item.enrollmentId);
    if (!student) throw unprocessable('NOT_IN_ROSTER', 'Студента немає в складі навантаження');
    let final: string | null = null;
    if (item.final !== null && item.final !== '') {
      const parsed = parseFinal(scale, item.final);
      if (!parsed.ok) throw unprocessable('INVALID_FINAL', `${student.lastName}: ${parsed.reason}`);
      final = parsed.text;
    }
    if (item.confirmed && final === null)
      throw unprocessable('FINAL_REQUIRED', `${student.lastName}: немає оцінки для підтвердження`);
    return { item, student, final };
  });

  for (const { item, student, final } of prepared) {
    const before = student.result;
    const proposed = proposedOf(student.proposal.text);
    const data = { proposed, final, comment: item.comment, confirmed: item.confirmed };
    await ctx.db.attestationResult.upsert({
      where: {
        attestationId_loadId_enrollmentId: {
          attestationId: attestation.id,
          loadId,
          enrollmentId: item.enrollmentId,
        },
      },
      create: {
        id: uuidv7(),
        attestationId: attestation.id,
        loadId,
        enrollmentId: item.enrollmentId,
        ...data,
      },
      update: { ...data, deletedAt: null, version: { increment: 1 } },
    });
    if (before?.final !== final || before.confirmed !== item.confirmed) {
      await audit(ctx.db, ctx, {
        entity: 'AttestationResult',
        entityId: `${attestation.id}:${loadId}:${item.enrollmentId}`,
        op: 'UPSERT',
        before: before ? { final: before.final, confirmed: before.confirmed } : null,
        after: { final, confirmed: item.confirmed, kind },
      });
    }
  }
  return getSheet(ctx, loadId, kind);
}
