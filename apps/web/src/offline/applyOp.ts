import type { LessonDetailDto, SyncOp } from '@ge/shared';

import { withAttendance, withGrade, withoutGrade } from '../features/lesson/model';

const UNDO_MS = 10 * 60_000;

/**
 * Застосовує операцію до локальної копії заняття — так само, як це зробить сервер. Завдяки цьому
 * UI одразу показує результат, а після синхронізації серверний стан збігається з локальним.
 */
export function applyOpToDetail(detail: LessonDetailDto, op: SyncOp): LessonDetailDto {
  switch (op.type) {
    case 'attendance.set':
      return withAttendance(detail, op.enrollmentId, op.status);
    case 'grade.set':
      return withGrade(detail, op.enrollmentId, {
        id: op.gradeId,
        kind: op.kind,
        value: op.value,
        comment: op.comment,
      });
    case 'grade.delete':
      return withoutGrade(detail, op.gradeId);
    case 'lesson.info':
      return {
        ...detail,
        topic: op.topicText === undefined ? detail.topic : op.topicText,
        homework: op.homework === undefined ? detail.homework : op.homework,
        note: op.note === undefined ? detail.note : op.note,
      };
    case 'lesson.finish':
      return {
        ...detail,
        status: 'HELD',
        // Сервер фіксує непозначених як присутніх
        roster: detail.roster.map((r) => ({ ...r, marked: true })),
        undoUntil: new Date(Date.parse(op.at) + UNDO_MS).toISOString(),
      };
    case 'lesson.reopen':
      return { ...detail, status: 'PLANNED', undoUntil: null };
  }
}

/** Операції, що ще чекають на відправку, поверх стану сервера. */
export function applyOps(detail: LessonDetailDto, ops: readonly SyncOp[]): LessonDetailDto {
  return ops.reduce(applyOpToDetail, detail);
}
