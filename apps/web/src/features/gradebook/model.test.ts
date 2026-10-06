import type { GradebookDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import {
  bufferIsFinal,
  cellText,
  interpretKey,
  moveSelection,
  removeCellGrade,
  setCellAttendance,
  setCellGrade,
} from './model';

const short = { PRESENT: '', ABSENT: 'н', EXCUSED: 'нп', LATE: 'з' } as const;
const dto = (): GradebookDto =>
  ({
    students: [
      {
        enrollmentId: 'a',
        cells: {
          l1: {
            attendance: 'PRESENT',
            grades: [{ id: 'g1', kind: 'ORAL', value: 9, comment: 'ок', version: 3 }],
          },
        },
      },
      { enrollmentId: 'b', cells: {} },
    ],
  }) as unknown as GradebookDto;

describe('оптимістичні зміни клітинок', () => {
  it('відмітка у порожній клітинці створює її', () => {
    const next = setCellAttendance(dto(), 'b', 'l1', 'ABSENT');
    expect(next.students[1]?.cells['l1']).toEqual({ attendance: 'ABSENT', grades: [] });
    expect(next.students[0]?.cells['l1']?.grades).toHaveLength(1); // інші студенти не змінились
  });
  it('оцінка: додається нова, наявна оновлюється зі збереженням версії та коментаря', () => {
    const added = setCellGrade(dto(), 'a', 'l1', { id: 'g2', kind: 'TEST', value: 11 });
    expect(added.students[0]?.cells['l1']?.grades.map((g) => g.id)).toEqual(['g1', 'g2']);
    const edited = setCellGrade(dto(), 'a', 'l1', { id: 'g1', kind: 'ORAL', value: 12 });
    expect(edited.students[0]?.cells['l1']?.grades[0]).toEqual({
      id: 'g1',
      kind: 'ORAL',
      value: 12,
      comment: 'ок',
      version: 3,
    });
  });
  it('видалення оцінки', () => {
    expect(removeCellGrade(dto(), 'a', 'l1', 'g1').students[0]?.cells['l1']?.grades).toEqual([]);
  });
  it('вихідний об’єкт не мутується', () => {
    const original = dto();
    setCellGrade(original, 'a', 'l1', { id: 'g9', kind: 'LAB', value: 5 });
    expect(original.students[0]?.cells['l1']?.grades).toHaveLength(1);
  });
});

describe('cellText', () => {
  it('оцінки й літера відмітки; «присутній» не показується', () => {
    expect(cellText(undefined, short)).toBe('');
    expect(cellText({ attendance: 'PRESENT', grades: [] }, short)).toBe('');
    expect(cellText({ attendance: 'ABSENT', grades: [] }, short)).toBe('н');
    expect(
      cellText(
        {
          attendance: 'EXCUSED',
          grades: [
            { id: '1', kind: 'ORAL', value: 10, comment: null, version: 0 },
            { id: '2', kind: 'TEST', value: 8, comment: null, version: 0 },
          ],
        },
        short,
      ),
    ).toBe('10, 8 нп');
  });
});

describe('interpretKey', () => {
  it('стрілки, Enter, Delete', () => {
    expect(interpretKey('ArrowDown', '')).toEqual({ type: 'move', dRow: 1, dCol: 0 });
    expect(interpretKey('ArrowLeft', '')).toEqual({ type: 'move', dRow: 0, dCol: -1 });
    expect(interpretKey('Tab', '')).toEqual({ type: 'move', dRow: 0, dCol: 1 });
    expect(interpretKey('Enter', '')).toEqual({ type: 'open' });
    expect(interpretKey('Delete', '')).toEqual({ type: 'delete' });
    expect(interpretKey('Backspace', '')).toEqual({ type: 'delete' });
  });
  it('цифри накопичуються в буфері (до трьох)', () => {
    expect(interpretKey('1', '')).toEqual({ type: 'digit', buffer: '1' });
    expect(interpretKey('2', '1')).toEqual({ type: 'digit', buffer: '12' });
    expect(interpretKey('5', '100')).toEqual({ type: 'digit', buffer: '100' });
  });
  it('відмітки: українська й латинська розкладка', () => {
    expect(interpretKey('н', '')).toEqual({ type: 'attendance', status: 'ABSENT' });
    expect(interpretKey('N', '')).toEqual({ type: 'attendance', status: 'ABSENT' });
    expect(interpretKey('п', '')).toEqual({ type: 'attendance', status: 'EXCUSED' });
    expect(interpretKey('з', '')).toEqual({ type: 'attendance', status: 'LATE' });
    expect(interpretKey(' ', '')).toEqual({ type: 'attendance', status: 'PRESENT' });
  });
  it('інші клавіші ігноруються', () => {
    expect(interpretKey('x', '')).toBeNull();
    expect(interpretKey('F5', '')).toBeNull();
  });
});

describe('bufferIsFinal', () => {
  it('12-бальна: 1 ще може стати 10–12, 2…9 — остаточні', () => {
    expect(bufferIsFinal('1', 12)).toBe(false);
    expect(bufferIsFinal('2', 12)).toBe(true);
    expect(bufferIsFinal('12', 12)).toBe(true);
    expect(bufferIsFinal('10', 12)).toBe(true);
  });
  it('5-бальна: будь-яка цифра остаточна; 100-бальна: 1–9 ще ростуть', () => {
    expect(bufferIsFinal('3', 5)).toBe(true);
    expect(bufferIsFinal('9', 100)).toBe(false);
    expect(bufferIsFinal('10', 100)).toBe(false);
    expect(bufferIsFinal('100', 100)).toBe(true);
  });
});

describe('moveSelection', () => {
  const size = { rows: 3, cols: 4 };
  it('рухається й не виходить за межі', () => {
    expect(moveSelection({ row: 1, col: 1 }, { dRow: 1, dCol: 1 }, size)).toEqual({
      row: 2,
      col: 2,
    });
    expect(moveSelection({ row: 0, col: 0 }, { dRow: -1, dCol: -1 }, size)).toEqual({
      row: 0,
      col: 0,
    });
    expect(moveSelection({ row: 2, col: 3 }, { dRow: 1, dCol: 1 }, size)).toEqual({
      row: 2,
      col: 3,
    });
  });
  it('порожня таблиця', () => {
    expect(moveSelection({ row: 0, col: 0 }, { dRow: 1, dCol: 1 }, { rows: 0, cols: 0 })).toEqual({
      row: 0,
      col: 0,
    });
  });
});
