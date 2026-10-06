import type { RosterEntry } from '@ge/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const onEditGrade = vi.fn();
  render(
    <RosterRow
      index={1}
      entry={entry(over)}
      scale="TWELVE"
      onAttendance={onAttendance}
      onAddGrade={onAddGrade}
      onEditGrade={onEditGrade}
    />,
  );
  return { onAttendance, onAddGrade, onEditGrade, row: screen.getByTestId('row-e1') };
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('RosterRow', () => {
  it('тап ставить «н», повторний тап повертає «присутній»', () => {
    const a = setup();
    fireEvent.click(a.row);
    expect(a.onAttendance).toHaveBeenCalledWith('ABSENT');
  });

  it('із «н» тап повертає присутнього; «нп» теж повертається у присутнього', () => {
    const a = setup({ attendance: 'ABSENT' });
    fireEvent.click(a.row);
    expect(a.onAttendance).toHaveBeenCalledWith('PRESENT');
  });

  it('статус показується літерою, а не лише кольором', () => {
    setup({ attendance: 'EXCUSED' });
    expect(screen.getByText(uk.lesson.attendanceShort.EXCUSED)).toBeInTheDocument();
  });

  it('довге утримання відкриває меню відміток і не вважається тапом', () => {
    const a = setup();
    fireEvent.pointerDown(a.row);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(a.row);
    fireEvent.click(a.row); // клік після утримання ігнорується
    expect(a.onAttendance).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('menuitem', { name: `нп ${uk.lesson.attendance.EXCUSED}` }));
    expect(a.onAttendance).toHaveBeenCalledWith('EXCUSED');
  });

  it('коротке натискання не відкриває меню', () => {
    const a = setup();
    fireEvent.pointerDown(a.row);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(a.row);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('оцінки показуються чіпами; тап по чіпу редагує, «+» додає', () => {
    const grade = { id: 'g1', kind: 'ORAL' as const, value: 11, comment: null, version: 0 };
    const a = setup({ grades: [grade] });
    fireEvent.click(screen.getByText('11'));
    expect(a.onEditGrade).toHaveBeenCalledWith(grade);
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.addGradeFor('Коваленко Анна') }));
    expect(a.onAddGrade).toHaveBeenCalledOnce();
  });
});
