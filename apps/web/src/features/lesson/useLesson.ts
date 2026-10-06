import type { AttendanceStatus, LessonDetailDto } from '@ge/shared';
import { uuidv7 } from '@ge/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchLesson,
  finishLesson,
  patchGrade,
  patchLesson,
  postGrade,
  putAttendance,
  removeGrade,
  reopenLesson,
} from '../../api/teaching';

import { withAttendance, withGrade, withoutGrade } from './model';

/**
 * Заняття «На парі» з оптимістичними оновленнями: UI реагує миттєво, запити йдуть по черзі
 * (scope), а при помилці стан відкочується. Відповідь сервера застосовується лише тоді,
 * коли більше немає запитів у черзі — інакше вона перезаписала б новіші локальні зміни.
 */
export function useLesson(lessonId: string) {
  const queryClient = useQueryClient();
  const key = ['lesson', lessonId] as const;
  const query = useQuery({ queryKey: key, queryFn: () => fetchLesson(lessonId) });

  const options = <V>(optimistic: (detail: LessonDetailDto, vars: V) => LessonDetailDto) => ({
    mutationKey: ['lesson', lessonId],
    scope: { id: `lesson-${lessonId}` },
    onMutate: async (vars: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LessonDetailDto>(key);
      if (previous) queryClient.setQueryData(key, optimistic(previous, vars));
      return { previous };
    },
    onError: (_e: unknown, _v: V, context?: { previous?: LessonDetailDto | undefined }) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (data: LessonDetailDto) => {
      if (queryClient.isMutating({ mutationKey: ['lesson', lessonId] }) <= 1)
        queryClient.setQueryData(key, data);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['lesson', lessonId] }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: ['today'] });
      }
    },
  });

  const attendance = useMutation({
    ...options<{ enrollmentId: string; status: AttendanceStatus }>((d, v) =>
      withAttendance(d, v.enrollmentId, v.status),
    ),
    mutationFn: (v) =>
      putAttendance(lessonId, [{ enrollmentId: v.enrollmentId, status: v.status }]),
  });

  const addGrade = useMutation({
    ...options<{ id: string; enrollmentId: string; kind: string; value: number }>((d, v) =>
      withGrade(d, v.enrollmentId, {
        id: v.id,
        kind: v.kind as never,
        value: v.value,
        comment: null,
      }),
    ),
    mutationFn: (v) => postGrade(lessonId, v),
  });

  const editGrade = useMutation({
    ...options<{ id: string; enrollmentId: string; version: number; kind: string; value: number }>(
      (d, v) =>
        withGrade(d, v.enrollmentId, {
          id: v.id,
          kind: v.kind as never,
          value: v.value,
          comment: null,
        }),
    ),
    mutationFn: (v) => patchGrade(v.id, v.version, { kind: v.kind, value: v.value }),
  });

  const deleteGrade = useMutation({
    ...options<{ id: string }>((d, v) => withoutGrade(d, v.id)),
    mutationFn: (v) => removeGrade(v.id),
  });

  const finish = useMutation({
    mutationKey: ['lesson', lessonId, 'finish'],
    mutationFn: () => finishLesson(lessonId),
    onSuccess: async (data) => {
      queryClient.setQueryData(key, data);
      await queryClient.invalidateQueries({ queryKey: ['today'] });
    },
  });
  const reopen = useMutation({
    mutationFn: () => reopenLesson(lessonId),
    onSuccess: async (data) => {
      queryClient.setQueryData(key, data);
      await queryClient.invalidateQueries({ queryKey: ['today'] });
    },
  });
  const saveInfo = useMutation({
    mutationFn: (v: { version: number; topicText?: string | null; homework?: string | null }) =>
      patchLesson(lessonId, v.version, v),
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });

  /** Нова оцінка: id генерує клієнт (UUID v7), тож запис можна створити й без мережі. */
  const newGradeId = () => uuidv7();

  return {
    query,
    attendance,
    addGrade,
    editGrade,
    deleteGrade,
    finish,
    reopen,
    saveInfo,
    newGradeId,
  };
}
