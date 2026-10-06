import type { LessonDetailDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import {
  defaultGradeKind,
  gradeLabel,
  gradeTone,
  isValidGrade,
  keypadValues,
  minutesLeft,
  presentCount,
  toggleAbsent,
  withAttendance,
  withGrade,
  withoutGrade,
} from './model';

const detail = (): LessonDetailDto =>
  ({
    scale: 'TWELVE',
    roster: [
      {
        enrollmentId: 'a',
        studentId: 's1',
        lastName: 'Бондар',
        firstName: 'М',
        middleName: null,
        attendance: 'PRESENT',
        marked: false,
        grades: [],
      },
      {
        enrollmentId: 'b',
        studentId: 's2',
        lastName: 'Коваленко',
        firstName: 'А',
        middleName: null,
        attendance: 'ABSENT',
        marked: true,
        grades: [{ id: 'g1', kind: 'ORAL', value: 9, comment: null, version: 2 }],
      },
    ],
  }) as unknown as LessonDetailDto;

describe('відмітки', () => {
  it('тап перемикає присутній ↔ «н»; «нп» і «з» повертаються у присутній', () => {
    expect(toggleAbsent('PRESENT')).toBe('ABSENT');
    expect(toggleAbsent('ABSENT')).toBe('PRESENT');
    expect(toggleAbsent('EXCUSED')).toBe('PRESENT');
    expect(toggleAbsent('LATE')).toBe('PRESENT');
  });

  it('лічильник присутніх: запізнений — присутній', () => {
    const d = detail();
    expect(presentCount(d.roster)).toBe(1);
    expect(presentCount(withAttendance(d, 'b', 'LATE').roster)).toBe(2);
    expect(presentCount(withAttendance(d, 'a', 'EXCUSED').roster)).toBe(0);
  });

  it('оптимістична відмітка ставить marked і не чіпає інших', () => {
    const next = withAttendance(detail(), 'a', 'ABSENT');
    expect(next.roster[0]).toMatchObject({ attendance: 'ABSENT', marked: true });
    expect(next.roster[1]?.attendance).toBe('ABSENT');
  });
});

describe('клавіатура оцінок', () => {
  it('значення за шкалою', () => {
    expect(keypadValues('TWELVE')).toHaveLength(12);
    expect(keypadValues('FIVE')).toEqual([1, 2, 3, 4, 5]);
    expect(keypadValues('HUNDRED')).toBeNull();
    expect(keypadValues('PASS_FAIL')).toBeNull();
  });
  it('перевірка меж', () => {
    expect(isValidGrade('TWELVE', 12)).toBe(true);
    expect(isValidGrade('TWELVE', 0)).toBe(false);
    expect(isValidGrade('TWELVE', 13)).toBe(false);
    expect(isValidGrade('HUNDRED', 0)).toBe(true);
    expect(isValidGrade('HUNDRED', 100.5)).toBe(false);
    expect(isValidGrade('PASS_FAIL', 1)).toBe(true);
    expect(isValidGrade('PASS_FAIL', 2)).toBe(false);
  });
  it('тип оцінки за замовчуванням з виду заняття', () => {
    expect(defaultGradeKind('LECTURE')).toBe('ORAL');
    expect(defaultGradeKind('PRACTICE')).toBe('PRACTICE');
    expect(defaultGradeKind('LAB')).toBe('LAB');
    expect(defaultGradeKind('CONTROL')).toBe('TEST');
    expect(defaultGradeKind('SEMINAR')).toBe('ORAL');
  });
  it('підписи й тони', () => {
    expect(gradeLabel('PASS_FAIL', 1)).toBe('зар.');
    expect(gradeLabel('PASS_FAIL', 0)).toBe('не зар.');
    expect(gradeLabel('TWELVE', 7)).toBe('7');
    expect(gradeTone('TWELVE', 2)).toBe('low');
    expect(gradeTone('TWELVE', 11)).toBe('high');
    expect(gradeTone('TWELVE', 6)).toBe('none');
    expect(gradeTone('FIVE', 1)).toBe('none');
  });
});

describe('оптимістичні оцінки', () => {
  it('додає нову й оновлює наявну, зберігаючи версію', () => {
    const added = withGrade(detail(), 'a', { id: 'g2', kind: 'LAB', value: 11, comment: null });
    expect(added.roster[0]?.grades).toEqual([
      { id: 'g2', kind: 'LAB', value: 11, comment: null, version: 0 },
    ]);
    const edited = withGrade(detail(), 'b', { id: 'g1', kind: 'ORAL', value: 12, comment: 'ок' });
    expect(edited.roster[1]?.grades).toEqual([
      { id: 'g1', kind: 'ORAL', value: 12, comment: 'ок', version: 2 },
    ]);
  });
  it('видаляє оцінку за id', () => {
    expect(withoutGrade(detail(), 'g1').roster[1]?.grades).toEqual([]);
  });
});

describe('minutesLeft', () => {
  const noon = new Date('2026-10-12T09:00:00Z'); // 12:00 за Києвом (UTC+3 восени)
  it('до кінця пари', () => {
    expect(minutesLeft(noon, '2026-10-12', '2026-10-12', '12:30')).toBe(30);
  });
  it('null: інший день, пара закінчилась, часу немає', () => {
    expect(minutesLeft(noon, '2026-10-12', '2026-10-13', '12:30')).toBeNull();
    expect(minutesLeft(noon, '2026-10-12', '2026-10-12', '11:20')).toBeNull();
    expect(minutesLeft(noon, '2026-10-12', '2026-10-12', undefined)).toBeNull();
  });
});
