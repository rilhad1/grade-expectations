import { loadDtoSchema, type GradingRules } from '@ge/shared';

import { del, patch, post } from '../../api/http';

export interface LoadFormValues {
  disciplineId: string;
  groupId: string;
  subgroupId: string | null;
  teacherId: string;
  kind: 'LECTURE' | 'PRACTICE' | 'LAB' | 'SEMINAR' | 'CONTROL';
  plannedHours: number;
  controlForm: 'EXAM' | 'CREDIT';
}

export const createLoad = (semesterId: string, v: LoadFormValues) =>
  post('/loads', { semesterId, ...v }, loadDtoSchema);

export const updateLoad = (
  id: string,
  version: number,
  body: {
    teacherId?: string;
    plannedHours?: number;
    controlForm?: 'EXAM' | 'CREDIT';
    gradingRules?: GradingRules;
  },
) => patch(`/loads/${id}`, { ...body, version }, loadDtoSchema);

export const deleteLoad = (id: string) => del(`/loads/${id}`);
