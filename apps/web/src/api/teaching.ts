import {
  gradebookDtoSchema,
  lessonDetailDtoSchema,
  lessonItemDtoSchema,
  loadDtoSchema,
  topicPlanDtoSchema,
  todayDtoSchema,
  type GradingRules,
  type LessonDetailDto,
} from '@ge/shared';
import { z } from 'zod';

import { get, http, patch, post, put } from './http';

export const fetchToday = () => get('/today', todayDtoSchema);
export const fetchLesson = (id: string): Promise<LessonDetailDto> =>
  get(`/lessons/${id}`, lessonDetailDtoSchema);
export const fetchLessons = (from: string, to: string) =>
  get(`/lessons?from=${from}&to=${to}`, z.array(lessonItemDtoSchema));

export const putAttendance = (
  lessonId: string,
  marks: { enrollmentId: string; status: string }[],
) => put(`/lessons/${lessonId}/attendance`, { marks }, lessonDetailDtoSchema);

export const postGrade = (
  lessonId: string,
  body: { id: string; enrollmentId: string; kind: string; value: number; comment?: string | null },
) => post(`/lessons/${lessonId}/grades`, body, lessonDetailDtoSchema);

export const patchGrade = (
  id: string,
  version: number,
  body: { kind?: string; value?: number; comment?: string | null },
) => patch(`/grades/${id}`, { ...body, version }, lessonDetailDtoSchema);

export const removeGrade = (id: string): Promise<LessonDetailDto> =>
  http('DELETE', `/grades/${id}`, { schema: lessonDetailDtoSchema });

export const finishLesson = (id: string) =>
  post(`/lessons/${id}/finish`, {}, lessonDetailDtoSchema);
export const reopenLesson = (id: string) =>
  post(`/lessons/${id}/reopen`, {}, lessonDetailDtoSchema);

export const patchLesson = (
  id: string,
  version: number,
  body: { topicText?: string | null; homework?: string | null; note?: string | null },
) => patch(`/lessons/${id}`, { ...body, version }, lessonDetailDtoSchema);

export const fetchGradebook = (loadId: string, range: { from?: string; to?: string } = {}) => {
  const query = [range.from && `from=${range.from}`, range.to && `to=${range.to}`]
    .filter(Boolean)
    .join('&');
  return get(`/loads/${loadId}/gradebook${query ? `?${query}` : ''}`, gradebookDtoSchema);
};

export const fetchTopics = (loadId: string) => get(`/loads/${loadId}/topics`, topicPlanDtoSchema);
export const saveTopics = (
  loadId: string,
  topics: { id?: string; title: string; hours: number }[],
) => put(`/loads/${loadId}/topics`, { topics }, topicPlanDtoSchema);
export const saveRules = (loadId: string, rules: GradingRules) =>
  put(`/loads/${loadId}/grading-rules`, { rules }, loadDtoSchema);
