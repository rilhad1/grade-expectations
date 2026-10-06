import { uuidv7, type AttendanceStatus, type GradeEntry, type LessonDetailDto } from '@ge/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { applyOpToDetail } from '../../offline/applyOp';
import { loadLesson } from '../../offline/lessonSource';
import { submitOp, type NewOp } from '../../offline/outbox';

/**
 * Заняття «На парі», яке працює і без мережі. Кожна дія — операція: вона одразу застосовується до
 * локальної копії заняття й потрапляє в чергу змін (outbox); на сервер її відправляє воркер
 * синхронізації, коли є зв'язок. UI не чекає на сервер, тому «Скасувати завершення», відмітки й
 * оцінки реагують миттєво в будь-яких умовах.
 */
export function useLesson(lessonId: string) {
  const queryClient = useQueryClient();
  const key = ['lesson', lessonId] as const;
  const query = useQuery({ queryKey: key, queryFn: () => loadLesson(lessonId) });

  /** Записує операцію й оновлює кеш запиту тим самим результатом, що збережено локально. */
  const run = async (input: NewOp): Promise<LessonDetailDto | undefined> => {
    const op = await submitOp(input);
    const current = queryClient.getQueryData<LessonDetailDto>(key);
    const next = current ? applyOpToDetail(current, op) : undefined;
    if (next) queryClient.setQueryData(key, next);
    void queryClient.invalidateQueries({ queryKey: ['today'] });
    return next;
  };

  const attendance = useMutation({
    mutationFn: (v: { enrollmentId: string; status: AttendanceStatus }) =>
      run({ type: 'attendance.set', lessonId, enrollmentId: v.enrollmentId, status: v.status }),
  });

  const saveGrade = (v: { id: string; enrollmentId: string; kind: string; value: number }) =>
    run({
      type: 'grade.set',
      lessonId,
      enrollmentId: v.enrollmentId,
      gradeId: v.id,
      kind: v.kind as GradeEntry['kind'],
      value: v.value,
      comment: null,
    });

  const addGrade = useMutation({ mutationFn: saveGrade });
  const editGrade = useMutation({
    mutationFn: (v: {
      id: string;
      enrollmentId: string;
      version: number;
      kind: string;
      value: number;
    }) => saveGrade(v),
  });
  const deleteGrade = useMutation({
    mutationFn: (v: { id: string }) => run({ type: 'grade.delete', lessonId, gradeId: v.id }),
  });

  const finish = useMutation({ mutationFn: () => run({ type: 'lesson.finish', lessonId }) });
  const reopen = useMutation({ mutationFn: () => run({ type: 'lesson.reopen', lessonId }) });
  const saveInfo = useMutation({
    mutationFn: (v: { version: number; topicText?: string | null; homework?: string | null }) =>
      run({
        type: 'lesson.info',
        lessonId,
        ...(v.topicText !== undefined && { topicText: v.topicText }),
        ...(v.homework !== undefined && { homework: v.homework }),
      }),
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
