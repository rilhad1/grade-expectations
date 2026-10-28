import type { RosterEntry } from '@ge/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';

import { RosterRow } from './RosterRow';

const entry = (over: Partial<RosterEntry> = {}): RosterEntry => ({
  enrollmentId: 'e1',
  studentId: 's1',
  lastName: 'Коваленко',
  firstName: 'Анна',
  middleName: null,
  attendance: 'PRESENT',
  marked: false,
  grades: [],
  ...over,
});

const setup = (over: Partial<RosterEntry> = {}) => {
  const onAttendance = vi.fn();
  const onAddGrade = vi.fn();
  const onQuickGrade = vi.fn();
  const onEditGrade = vi.fn();
  render(
    <RosterRow
      index={1}
      entry={entry(over)}
      scale="TWELVE"
      onAttendance={onAttendance}
      onAddGrade={onAddGrade}
      onQuickGrade={onQuickGrade}
      onEditGrade={onEditGrade}
    />,
  );
  return { onAttendance, onAddGrade, onQuickGrade, onEditGrade, row: screen.getByTestId('row-e1') };
};

describe('RosterRow', () => {
  it('«н» і «Був» — явний перемикач', () => {
    const a = setup();
    expect(screen.getByTestId('present-e1')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('absent-e1'));
    expect(a.onAttendance).toHaveBeenCalledWith('ABSENT');
  });

  it('із «н» кнопка «Був» повертає присутнього', () => {
    const a = setup({ attendance: 'ABSENT' });
    expect(screen.getByTestId('absent-e1')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('present-e1'));
    expect(a.onAttendance).toHaveBeenCalledWith('PRESENT');
  });

  it('статус показується літерою, а не лише кольором', () => {
    setup({ attendance: 'EXCUSED' });
    expect(screen.getByText(uk.lesson.attendanceShort.EXCUSED)).toBeInTheDocument();
    expect(screen.getByTestId('present-e1')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('absent-e1')).toHaveAttribute('aria-checked', 'false');
  });

  it('тап по прізвищу відкриває меню відміток (нп, з)', () => {
    const a = setup();
    fireEvent.click(a.row);
    expect(a.onAttendance).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: `нп ${uk.lesson.attendance.EXCUSED}` }));
    expect(a.onAttendance).toHaveBeenCalledWith('EXCUSED');
  });

  it('оцінки показуються чіпами; тап по чіпу редагує, «+» відкриває шторку', () => {
    const grade = { id: 'g1', kind: 'ORAL' as const, value: 11, comment: null, version: 0 };
    const a = setup({ grades: [grade] });
    fireEvent.click(screen.getByText('11'));
    expect(a.onEditGrade).toHaveBeenCalledWith(grade);
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.addGradeFor('Коваленко Анна') }));
    expect(a.onAddGrade).toHaveBeenCalledOnce();
  });

  it('поле оцінки: Enter зберігає, нецифри відкидаються, поза шкалою не зберігається', () => {
    const a = setup();
    const input = screen.getByRole('textbox', { name: uk.lesson.gradeInputFor('Коваленко Анна') });
    fireEvent.change(input, { target: { value: '1a3' } });
    expect(input).toHaveValue('13');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(a.onQuickGrade).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);
    expect(a.onQuickGrade).toHaveBeenCalledWith(9);
    expect(input).toHaveValue('');
  });
});
