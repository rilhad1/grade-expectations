import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AttestationSheetDto, AttestationKind, ControlForm, LessonKind } from '@ge/shared';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const TEMPLATE_PATH = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../templates/statement.docx',
);

const moduleTitles: Record<AttestationKind, string> = {
  INTERIM: 'Проміжна атестація',
  DIRECTOR_TEST: 'Директорська контрольна робота',
  AVERAGE: 'Середній бал за семестр',
  EXAM: 'Екзамен',
};
const controlForms: Record<ControlForm, string> = { EXAM: 'екзамен', CREDIT: 'залік' };
const lessonKinds: Record<LessonKind, string> = {
  LECTURE: 'лекції',
  PRACTICE: 'практичні',
  LAB: 'лабораторні',
  SEMINAR: 'семінари',
  CONTROL: 'контрольні',
};

export interface StatementContext {
  college: string;
  semester: string;
  /** Дата формування (DD.MM.YYYY). */
  date: string;
}

export interface StatementData {
  college: string;
  semester: string;
  module: string;
  discipline: string;
  lessonKind: string;
  controlForm: string;
  group: string;
  teacher: string;
  date: string;
  total: number;
  graded: number;
  notCertified: number;
  students: { n: number; name: string; final: string; comment: string }[];
}

/** Готує дані відомості з аркуша атестації; усі результати мають бути підтверджені. */
export function statementData(sheet: AttestationSheetDto, ctx: StatementContext): StatementData {
  const students = sheet.students.map((s, index) => ({
    n: index + 1,
    name: [s.lastName, s.firstName, s.middleName].filter(Boolean).join(' '),
    final: s.result?.final ?? '',
    comment: s.result?.comment ?? '',
  }));
  const notCertified = students.filter((s) => s.final === 'н/а').length;
  return {
    college: ctx.college,
    semester: ctx.semester,
    module: moduleTitles[sheet.attestation.kind],
    discipline: sheet.load.disciplineTitle,
    lessonKind: lessonKinds[sheet.load.kind],
    controlForm: controlForms[sheet.load.controlForm],
    group: sheet.load.subgroupName
      ? `${sheet.load.groupName}, ${sheet.load.subgroupName}`
      : sheet.load.groupName,
    teacher: sheet.load.teacherName,
    date: ctx.date,
    total: students.length,
    graded: students.length - notCertified,
    notCertified,
    students,
  };
}

/** Підставляє дані в DOCX-шаблон (templates/statement.docx) і повертає готовий файл. */
export function renderStatementDocx(data: StatementData, template?: Buffer): Buffer {
  const zip = new PizZip(template ?? readFileSync(TEMPLATE_PATH));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/** Ім'я файлу без символів, небезпечних для файлових систем. */
export function statementFileName(data: StatementData, extension: 'docx' | 'pdf'): string {
  const safe = (text: string) => text.replace(/[\\/:*?"<>|\s]+/g, '_');
  return `Відомість_${safe(data.discipline)}_${safe(data.group)}_${safe(data.module)}.${extension}`;
}
