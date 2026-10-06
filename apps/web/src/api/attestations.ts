import {
  attestationSheetDtoSchema,
  calendarFeedDtoSchema,
  documentDtoSchema,
  documentListSchema,
  loadAttestationsDtoSchema,
  type AttestationKind,
  type CreateDocumentInput,
} from '@ge/shared';

import { get, post, put } from './http';

export const fetchLoadAttestations = (loadId: string) =>
  get(`/loads/${loadId}/attestations`, loadAttestationsDtoSchema);

export const fetchSheet = (loadId: string, kind: AttestationKind) =>
  get(`/loads/${loadId}/attestations/${kind}`, attestationSheetDtoSchema);

export interface ResultInput {
  enrollmentId: string;
  final: string | null;
  comment: string | null;
  confirmed: boolean;
}

export const saveResults = (loadId: string, kind: AttestationKind, results: ResultInput[]) =>
  put(`/loads/${loadId}/attestations/${kind}/results`, { results }, attestationSheetDtoSchema);

export const createDocument = (body: CreateDocumentInput) =>
  post('/documents', body, documentDtoSchema);
export const fetchDocument = (id: string) => get(`/documents/${id}`, documentDtoSchema);
export const fetchDocuments = () => get('/documents', documentListSchema);

export const fetchCalendar = () => get('/me/calendar', calendarFeedDtoSchema);
export const rotateCalendar = () => post('/me/calendar/rotate', {}, calendarFeedDtoSchema);

export const documentFileUrl = (id: string) => `/api/v1/documents/${id}/file`;
