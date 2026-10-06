import type { RosterEntry } from '@ge/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';

import { GradeSheet } from './GradeSheet';

const student: RosterEntry = {
  enrollmentId: 'e1',
  studentId: 's1',
  lastName: 'Бондар',
  firstName: 'Максим',
  middleName: null,
  attendance: 'PRESENT',
  marked: false,
  grades: [],
};

const setup = (
  scale: 'TWELVE' | 'FIVE' | 'HUNDRED' | 'PASS_FAIL',
  extra: Partial<Parameters<typeof GradeSheet>[0]> = {},
) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <GradeSheet
      student={student}
      scale={scale}
      defaultKind="ORAL"
      onSave={onSave}
      onClose={onClose}
      {...extra}
    />,
  );
  return { onSave, onClose };
};

describe('GradeSheet', () => {
  it('12-бальна: клавіатура 1–12, тап зберігає одразу з типом за замовчуванням', () => {
    const { onSave } = setup('TWELVE');
    expect(screen.getAllByRole('button', { name: /^\d+$/ })).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    expect(onSave).toHaveBeenCalledWith({ kind: 'ORAL', value: 9 });
  });

  it('тип оцінки можна змінити перед вибором числа', () => {
    const { onSave } = setup('TWELVE');
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.gradeKinds.LAB }));
    fireEvent.click(screen.getByRole('button', { name: '12' }));
    expect(onSave).toHaveBeenCalledWith({ kind: 'LAB', value: 12 });
  });

  it('5-бальна: п’ять кнопок', () => {
    setup('FIVE');
    expect(screen.getAllByRole('button', { name: /^\d$/ })).toHaveLength(5);
  });

  it('100-бальна: ручне введення з перевіркою меж', () => {
    const { onSave } = setup('HUNDRED');
    const save = screen.getByRole('button', { name: uk.common.save });
    expect(save).toBeDisabled();
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '101' } });
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: '87' } });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith({ kind: 'ORAL', value: 87 });
  });

  it('«зараховано / не зараховано» зберігає 1 або 0', () => {
    const { onSave } = setup('PASS_FAIL');
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.passed }));
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.failed }));
    expect(onSave).toHaveBeenNthCalledWith(1, { kind: 'ORAL', value: 1 });
    expect(onSave).toHaveBeenNthCalledWith(2, { kind: 'ORAL', value: 0 });
  });

  it('редагування наявної оцінки: тип береться з неї, є кнопка видалення', () => {
    const onDelete = vi.fn();
    const { onSave } = setup('TWELVE', {
      grade: { id: 'g', kind: 'TEST', value: 7, comment: null, version: 1 },
      onDelete,
    });
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(onSave).toHaveBeenCalledWith({ kind: 'TEST', value: 8 });
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.deleteGrade }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('без наявної оцінки видалення немає; «Скасувати» закриває', () => {
    const { onClose } = setup('TWELVE');
    expect(screen.queryByRole('button', { name: uk.lesson.deleteGrade })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: uk.common.cancel }));
    expect(onClose).toHaveBeenCalled();
  });
});
