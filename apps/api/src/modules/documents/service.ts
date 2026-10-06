import { uuidv7, type CreateDocumentInput, type DocumentDto } from '@ge/shared';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';

import { AppError, conflict, notFound, unprocessable } from '../../errors.js';
import type { AuthContext } from '../../plugins/session.js';
import { getSheet } from '../attestations/service.js';
import { findJournalLoad } from '../journal/gradebook.js';

import { buildDataExport } from './exportData.js';
import { convertToPdf } from './pdf.js';
import { DOCX_MIME, renderStatementDocx, statementData, statementFileName } from './statement.js';

export interface DocumentDeps {
  enqueue: (documentId: string) => Promise<void>;
  gotenbergUrl: string | undefined;
}

const statementParamsSchema = z.object({
  loadId: z.uuid(),
  attestationKind: z.enum(['INTERIM', 'DIRECTOR_TEST', 'AVERAGE', 'EXAM']),
});

const toDto = (row: {
  id: string;
  kind: DocumentDto['kind'];
  format: DocumentDto['format'];
  status: DocumentDto['status'];
  fileName: string | null;
  error: string | null;
  createdAt: Date;
}): DocumentDto => ({
  id: row.id,
  kind: row.kind,
  format: row.format,
  status: row.status,
  fileName: row.fileName,
  error: row.error,
  createdAt: row.createdAt.toISOString(),
});

/** Відомість формується лише з повністю підтверджених результатів. */
async function confirmedSheet(
  ctx: AuthContext,
  loadId: string,
  kind: z.infer<typeof statementParamsSchema>['attestationKind'],
) {
  const sheet = await getSheet(ctx, loadId, kind);
  const pending = sheet.students.filter((s) => !s.result?.confirmed).length;
  if (pending > 0)
    throw conflict(
      'ATTESTATION_NOT_CONFIRMED',
      `Не підтверджено оцінки в ${String(pending)} студентів`,
    );
  return sheet;
}

export async function createDocument(
  ctx: AuthContext,
  input: CreateDocumentInput,
  deps: DocumentDeps,
): Promise<DocumentDto> {
  const id = input.id ?? uuidv7();
  const existing = await ctx.db.generatedDocument.findFirst({
    where: { id, userId: ctx.user.id },
  });
  if (existing) return toDto(existing); // повторний запит із тим самим id

  if (input.kind === 'STATEMENT') {
    if (input.format === 'PDF' && deps.gotenbergUrl === undefined)
      throw unprocessable('PDF_NOT_CONFIGURED', 'PDF недоступний: не налаштовано Gotenberg');
    await findJournalLoad(ctx, input.loadId); // власник навантаження або деканат
    await confirmedSheet(ctx, input.loadId, input.attestationKind);
  }

  const row = await ctx.db.generatedDocument.create({
    data: {
      id,
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      kind: input.kind,
      format: input.kind === 'DATA_EXPORT' ? 'ZIP' : input.format,
      params:
        input.kind === 'STATEMENT'
          ? { loadId: input.loadId, attestationKind: input.attestationKind }
          : {},
    },
  });
  await deps.enqueue(row.id);
  return toDto(row);
}

export async function listDocuments(ctx: AuthContext): Promise<DocumentDto[]> {
  const rows = await ctx.db.generatedDocument.findMany({
    where: { userId: ctx.user.id },
    orderBy: { id: 'desc' },
    take: 20,
    select: {
      id: true,
      kind: true,
      format: true,
      status: true,
      fileName: true,
      error: true,
      createdAt: true,
    },
  });
  return rows.map(toDto);
}

export async function getDocument(ctx: AuthContext, id: string): Promise<DocumentDto> {
  const row = await ctx.db.generatedDocument.findFirst({
    where: { id, userId: ctx.user.id },
    select: {
      id: true,
      kind: true,
      format: true,
      status: true,
      fileName: true,
      error: true,
      createdAt: true,
    },
  });
  if (!row) throw notFound('Документ не знайдено');
  return toDto(row);
}

export async function getDocumentFile(
  ctx: AuthContext,
  id: string,
): Promise<{ fileName: string; mimeType: string; content: Buffer }> {
  const row = await ctx.db.generatedDocument.findFirst({ where: { id, userId: ctx.user.id } });
  if (!row) throw notFound('Документ не знайдено');
  if (row.status !== 'READY' || !row.content || !row.fileName || !row.mimeType)
    throw conflict('DOCUMENT_NOT_READY', 'Документ ще не готовий');
  return { fileName: row.fileName, mimeType: row.mimeType, content: Buffer.from(row.content) };
}

const formatDate = (iso: string) => iso.split('-').reverse().join('.');

/** Виконується у фоновій задачі: будує файл і зберігає його у БД. Помилки потрапляють у документ. */
export async function processDocument(
  contextFor: (userId: string) => Promise<AuthContext>,
  prisma: Pick<import('@prisma/client').PrismaClient, 'generatedDocument'>,
  documentId: string,
  gotenbergUrl: string | undefined,
  log: FastifyBaseLogger,
): Promise<void> {
  const doc = await prisma.generatedDocument.findUnique({ where: { id: documentId } });
  if (doc?.status !== 'PENDING') return;
  try {
    const ctx = await contextFor(doc.userId);
    let file: { fileName: string; mimeType: string; content: Buffer };

    if (doc.kind === 'DATA_EXPORT') {
      const now = new Date();
      file = {
        fileName: `Експорт_даних_${now.toISOString().slice(0, 10)}.zip`,
        mimeType: 'application/zip',
        content: await buildDataExport(ctx, now),
      };
    } else {
      const params = statementParamsSchema.parse(doc.params);
      const sheet = await confirmedSheet(ctx, params.loadId, params.attestationKind);
      const semester = await ctx.db.semester.findFirstOrThrow({
        where: { id: sheet.attestation.semesterId },
        include: { academicYear: true },
      });
      const data = statementData(sheet, {
        college: ctx.organization.title,
        semester: `${semester.academicYear.title}, ${String(semester.number)} семестр`,
        date: formatDate(ctx.today()),
      });
      const docx = renderStatementDocx(data);
      if (doc.format === 'PDF') {
        const fileName = statementFileName(data, 'pdf');
        file = {
          fileName,
          mimeType: 'application/pdf',
          content: await convertToPdf(gotenbergUrl, docx, statementFileName(data, 'docx')),
        };
      } else {
        file = { fileName: statementFileName(data, 'docx'), mimeType: DOCX_MIME, content: docx };
      }
    }
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: {
        status: 'READY',
        fileName: file.fileName,
        mimeType: file.mimeType,
        content: new Uint8Array(file.content),
        error: null,
      },
    });
  } catch (error) {
    log.error({ err: error, documentId }, 'Не вдалося сформувати документ');
    await prisma.generatedDocument.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        error: error instanceof AppError ? (error.detail ?? error.title) : 'Помилка формування',
      },
    });
  }
}
