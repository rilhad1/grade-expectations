import type { LessonDetailDto, SyncOp } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import { applyOpToDetail, applyOps } from './applyOp';

const detail = (): LessonDetailDto =>
  ({
    id: 'l1',
    status: 'PLANNED',
    topic: null,
    homework: 'старе',
    note: null,
    undoUntil: null,
    roster: [
      { enrollmentId: 'e1', attendance: 'PRESENT', marked: false, grades: [] },
      { enrollmentId: 'e2', attendance: 'PRESENT', marked: false, grades: [] },
    ],
  }) as unknown as LessonDetailDto;

const at = '2026-10-12T07:30:00.000Z';
const op = (type: SyncOp['type'], rest: object): SyncOp =>
  ({ opId: 'o', lessonId: 'l1', at, type, ...rest }) as SyncOp;

describe('applyOpToDetail', () => {
  it('відмітка', () => {
    const next = applyOpToDetail(
      detail(),
      op('attendance.set', { enrollmentId: 'e1', status: 'ABSENT' }),
    );
    expect(next.roster[0]).toMatchObject({ attendance: 'ABSENT', marked: true });
    expect(next.roster[1]).toMatchObject({ attendance: 'PRESENT', marked: false });
  });

  it('оцінка: додати, змінити, видалити', () => {
    const set = (value: number) =>
      op('grade.set', {
        enrollmentId: 'e2',
        gradeId: 'g1',
        kind: 'ORAL',
        value,
        comment: null,
      });
    const added = applyOpToDetail(detail(), set(9));
    expect(added.roster[1]?.grades).toMatchObject([{ id: 'g1', value: 9 }]);
    const changed = applyOpToDetail(added, set(11));
    expect(changed.roster[1]?.grades).toMatchObject([{ id: 'g1', value: 11 }]);
    const removed = applyOpToDetail(changed, op('grade.delete', { gradeId: 'g1' }));
    expect(removed.roster[1]?.grades).toEqual([]);
  });

  it('тема й нотатки: лише передані поля', () => {
    const next = applyOpToDetail(detail(), op('lesson.info', { topicText: 'Алгоритми' }));
    expect(next).toMatchObject({ topic: 'Алгоритми', homework: 'старе', note: null });
    const cleared = applyOpToDetail(next, op('lesson.info', { homework: null, note: 'нотатка' }));
    expect(cleared).toMatchObject({ topic: 'Алгоритми', homework: null, note: 'нотатка' });
  });

  it('завершення позначає всіх і відкриває 10 хвилин на скасування; скасування повертає стан', () => {
    const held = applyOpToDetail(detail(), op('lesson.finish', {}));
    expect(held.status).toBe('HELD');
    expect(held.roster.every((r) => r.marked)).toBe(true);
    expect(held.undoUntil).toBe('2026-10-12T07:40:00.000Z');
    const reopened = applyOpToDetail(held, op('lesson.reopen', {}));
    expect(reopened).toMatchObject({ status: 'PLANNED', undoUntil: null });
  });
});

describe('applyOps', () => {
  it('застосовує по черзі', () => {
    const next = applyOps(detail(), [
      op('attendance.set', { enrollmentId: 'e1', status: 'ABSENT' }),
      op('attendance.set', { enrollmentId: 'e1', status: 'PRESENT' }),
    ]);
    expect(next.roster[0]?.attendance).toBe('PRESENT');
  });
});
