import { z } from 'zod';

import { uuidSchema } from '../common.js';
import { AttestationKind, DocumentFormat, DocumentKind, DocumentStatus } from '../enums.js';

import { clientIdSchema } from './common.js';

export const createDocumentSchema = z.discriminatedUnion('kind', [
  z.object({
    id: clientIdSchema,
    kind: z.literal('STATEMENT'),
    format: z.enum(['DOCX', 'PDF']),
    loadId: uuidSchema,
    attestationKind: AttestationKind.schema,
  }),
  z.object({ id: clientIdSchema, kind: z.literal('DATA_EXPORT') }),
]);
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const documentDtoSchema = z.object({
  id: uuidSchema,
  kind: DocumentKind.schema,
  format: DocumentFormat.schema,
  status: DocumentStatus.schema,
  fileName: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type DocumentDto = z.infer<typeof documentDtoSchema>;

export const documentListSchema = z.object({ items: z.array(documentDtoSchema) });

/** Підписка на розклад у календарі: токен лежить у URL, тож його можна замінити. */
export const calendarFeedDtoSchema = z.object({ path: z.string(), rotatedAt: z.iso.datetime() });
export type CalendarFeedDto = z.infer<typeof calendarFeedDtoSchema>;
