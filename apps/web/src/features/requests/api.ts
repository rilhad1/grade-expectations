import { freeSlotDtoSchema, rescheduleRequestDtoSchema } from '@ge/shared';
import { z } from 'zod';

import { get, post } from '../../api/http';

export const fetchFreeSlots = (id: string) =>
  get(`/reschedule-requests/${id}/free-slots`, z.array(freeSlotDtoSchema));

export const approveRequest = (
  id: string,
  body: { comment?: string | null; date?: string; pairNumber?: number; roomId?: string | null },
) => post(`/reschedule-requests/${id}/approve`, body, rescheduleRequestDtoSchema);

export const rejectRequest = (id: string, comment: string) =>
  post(`/reschedule-requests/${id}/reject`, { comment }, rescheduleRequestDtoSchema);
