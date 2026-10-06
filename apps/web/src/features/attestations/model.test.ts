import type { AttestationStudent } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import {
  acceptAllInputs,
  confirmInput,
  confirmedCount,
  fieldError,
  fieldValue,
  reopenInput,
  rowState,
} from './model';

const student = (
  id: string,
  proposal: string,
  result: AttestationStudent['result'] = null,
): AttestationStudent => ({
  enrollmentId: id,
  studentId: id,
  lastName: id,
  firstName: 'Х',
  middleName: null,
  enrollmentStatus: 'ACTIVE',
  proposal: { text: proposal, isNa: proposal === 'н/а', explanation: '' },
  average: null,
  gradesCount: 0,
  absencePercent: 0,
  result,
});

const saved = (final: string | null, confirmed: boolean) => ({
  final,
  comment: 'коментар',
  confirmed,
  version: 0,
});

describe('fieldValue / rowState', () => {
  it('чернетка > збережене > пропозиція', () => {
    expect(fieldValue(student('a', '9'), undefined)).toBe('9');
    expect(fieldValue(student('a', '9', saved('7', false)), undefined)).toBe('7');
    expect(fieldValue(student('a', '9', saved('7', false)), '10')).toBe('10');
  });

  it('стан рядка', () => {
    expect(rowState(student('a', '9'), undefined)).toBe('proposed');
    expect(rowState(student('a', '9'), '8')).toBe('edited');
    expect(rowState(student('a', '9', saved('9', true)), '8')).toBe('confirmed');
  });
});

describe('fieldError', () => {
  it('повертає причину помилки або null', () => {
    expect(fieldError('TWELVE', '9')).toBeNull();
    expect(fieldError('TWELVE', '13')).toContain('поза шкалою');
  });
});

describe('вхідні дані збереження', () => {
  it('confirmInput підтверджує значення поля й зберігає коментар', () => {
    expect(confirmInput(student('a', '9', saved('7', false)), '10')).toEqual({
      enrollmentId: 'a',
      final: '10',
      comment: 'коментар',
      confirmed: true,
    });
    expect(confirmInput(student('a', '9'), undefined)).toMatchObject({
      final: '9',
      comment: null,
    });
  });

  it('reopenInput знімає підтвердження', () => {
    expect(reopenInput(student('a', '9', saved('9', true)))).toEqual({
      enrollmentId: 'a',
      final: '9',
      comment: 'коментар',
      confirmed: false,
    });
    expect(reopenInput(student('a', '9'))).toMatchObject({ final: null, comment: null });
  });

  it('acceptAllInputs пропускає вже підтверджених', () => {
    const list = [student('a', '9'), student('b', 'н/а'), student('c', '7', saved('7', true))];
    expect(acceptAllInputs(list, { a: '10' }).map((r) => [r.enrollmentId, r.final])).toEqual([
      ['a', '10'],
      ['b', 'н/а'],
    ]);
  });

  it('confirmedCount рахує підтверджені', () => {
    expect(confirmedCount([student('a', '9'), student('b', '9', saved('9', true))])).toBe(1);
  });
});
