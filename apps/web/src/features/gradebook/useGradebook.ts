import type { AttendanceStatus, GradebookDto } from '@ge/shared';
import { uuidv7 } from '@ge/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  patchAssessment,
  patchGrade,
  postAssessment,
  postGrade,
  putAttendance,
  removeAssessment,
  removeGrade,
} from '../../api/teaching';
import { loadGradebook } from '../../offline/gradebookSource';
import { submitOp } from '../../offline/outbox';

import { removeCellGrade, setAssessmentCell, setCellAttendance, setCellGrade } from './model';

export interface Range {
  from?: string;
  to?: string;
}

/** Журнал із оптимістичними змінами клітинок; після серії змін дані перезапитуються (перерахунок підсумків). */
export function useGradebook(loadId: string, range: Range) {
  const queryClient = useQueryClient();
  const key = ['gradebook', loadId, range.from ?? '', range.to ?? ''] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () => loadGradebook(loadId, range),
    // Під час зміни фільтра періоду таблиця й перелік періодів не зникають
    placeholderData: keepPreviousData,
  });

  const options = <V>(optimistic: (dto: GradebookDto, vars: V) => GradebookDto) => ({
    mutationKey: ['gradebook', loadId],
    scope: { id: `gradebook-${loadId}` },
    onMutate: async (vars: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<GradebookDto>(key);
      if (previous) queryClient.setQueryData(key, optimistic(previous, vars));
      return { previous };
    },
    onError: (_e: unknown, _v: V, context?: { previous?: GradebookDto | undefined }) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['gradebook', loadId] }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: ['gradebook', loadId] });
        void queryClient.invalidateQueries({ queryKey: ['today'] });
      }
    },
  });

  type Cell = { lessonId: string; enrollmentId: string };

  const attendance = useMutation({
    ...options<Cell & { status: AttendanceStatus }>((d, v) =>
      setCellAttendance(d, v.enrollmentId, v.lessonId, v.status),
    ),
    mutationFn: (v) =>
      putAttendance(v.lessonId, [{ enrollmentId: v.enrollmentId, status: v.status }]),
  });

  /** Створює оцінку або (якщо передано gradeId) змінює наявну. */
  const upsertGrade = useMutation({
    ...options<
      Cell & { gradeId?: string; version?: number; kind: string; value: number; newId: string }
    >((d, v) =>
      setCellGrade(d, v.enrollmentId, v.lessonId, {
        id: v.gradeId ?? v.newId,
        kind: v.kind as never,
        value: v.value,
      }),
    ),
    mutationFn: (v) =>
      v.gradeId
        ? patchGrade(v.gradeId, v.version ?? 0, { kind: v.kind, value: v.value })
        : postGrade(v.lessonId, {
            id: v.newId,
            enrollmentId: v.enrollmentId,
            kind: v.kind,
            value: v.value,
          }),
  });

  const clearGrade = useMutation({
    ...options<Cell & { gradeId: string }>((d, v) =>
      removeCellGrade(d, v.enrollmentId, v.lessonId, v.gradeId),
    ),
    mutationFn: (v) => removeGrade(v.gradeId),
  });

  type AssessmentCell = { assessmentId: string; enrollmentId: string };

  /** Оцінка в колонці оцінювання (створення чи зміна — одним PUT). */
  const setAssessmentGrade = useMutation({
    ...options<AssessmentCell & { value: number }>((d, v) =>
      setAssessmentCell(d, v.enrollmentId, v.assessmentId, v.value),
    ),
    // Через чергу синхронізації: працює й без мережі, на сервері діє «останній запис перемагає»
    mutationFn: (v) =>
      submitOp({
        type: 'assessment.grade.set',
        assessmentId: v.assessmentId,
        enrollmentId: v.enrollmentId,
        value: v.value,
        comment: null,
      }),
  });
  const clearAssessmentGrade = useMutation({
    ...options<AssessmentCell>((d, v) =>
      setAssessmentCell(d, v.enrollmentId, v.assessmentId, null),
    ),
    mutationFn: (v) =>
      submitOp({
        type: 'assessment.grade.clear',
        assessmentId: v.assessmentId,
        enrollmentId: v.enrollmentId,
      }),
  });

  /** Керування самими колонками (не оптимістичне: після відповіді журнал перезапитується). */
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['gradebook', loadId] });
    void queryClient.invalidateQueries({ queryKey: ['today'] });
  };
  const createColumn = useMutation({
    mutationFn: (v: { title: string; kind: string; attestationKind: string | null }) =>
      postAssessment(loadId, { id: uuidv7(), ...v }),
    onSuccess: refresh,
  });
  const updateColumn = useMutation({
    mutationFn: (v: {
      id: string;
      version: number;
      title: string;
      kind: string;
      attestationKind: string | null;
    }) =>
      patchAssessment(v.id, v.version, {
        title: v.title,
        kind: v.kind,
        attestationKind: v.attestationKind,
      }),
    onSuccess: refresh,
  });
  const deleteColumn = useMutation({
    mutationFn: (id: string) => removeAssessment(id),
    onSuccess: refresh,
  });

  return {
    query,
    attendance,
    upsertGrade,
    clearGrade,
    setAssessmentGrade,
    clearAssessmentGrade,
    createColumn,
    updateColumn,
    deleteColumn,
    newId: () => uuidv7(),
  };
}
