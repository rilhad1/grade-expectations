import {
  conflictDtoSchema,
  publishResultSchema,
  scheduleDetailDtoSchema,
  scheduleDtoSchema,
  slotDtoSchema,
  type PublishResult,
} from '@ge/shared';
import { z } from 'zod';

import { del, get, patch, post } from '../../api/http';

export const fetchSchedules = (semesterId: string) =>
  get(`/schedules?semesterId=${semesterId}`, z.array(scheduleDtoSchema));
export const fetchSchedule = (id: string) => get(`/schedules/${id}`, scheduleDetailDtoSchema);
export const fetchConflicts = (id: string) =>
  get(`/schedules/${id}/conflicts`, z.array(conflictDtoSchema));

export const createDraft = (semesterId: string) =>
  post('/schedules', { semesterId }, scheduleDetailDtoSchema);
export const discardDraft = (id: string) => del(`/schedules/${id}`);
export const publish = (id: string, dryRun: boolean): Promise<PublishResult> =>
  post(`/schedules/${id}/publish`, { dryRun }, publishResultSchema);

export const createSlot = (
  scheduleId: string,
  body: {
    loadId: string;
    weekday: number;
    pairNumber: number;
    parity: 'EVERY' | 'TOP' | 'BOTTOM';
    roomId?: string | null;
  },
) => post(`/schedules/${scheduleId}/slots`, body, slotDtoSchema);

export const updateSlot = (
  id: string,
  version: number,
  body: {
    weekday?: number;
    pairNumber?: number;
    parity?: 'EVERY' | 'TOP' | 'BOTTOM';
    roomId?: string | null;
  },
) => patch(`/schedule-slots/${id}`, { ...body, version }, slotDtoSchema);

export const deleteSlot = (id: string) => del(`/schedule-slots/${id}`);
