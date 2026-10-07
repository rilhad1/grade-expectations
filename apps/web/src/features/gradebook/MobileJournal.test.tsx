import type { GradebookDto } from '@ge/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';
import { renderWithClient } from '../../test/renderWithProviders';

// Посилання роутера не потребують RouterProvider у цих тестах
vi.mock('../../shared/ui/links', () => ({
  LinkListItem: ({
    children,
    params,
  }: {
    children: React.ReactNode;
    params: { lessonId: string };
  }) => <a href={`/lessons/${params.lessonId}`}>{children}</a>,
}));

const { MobileJournal } = await import('./MobileJournal');
const { AssessmentGradesDialog } = await import('./AssessmentGradesDialog');

const summary = {
  average: null,
  gradesCount: 0,
  absences: { unexcused: 0, excused: 0, late: 0 },
  absencePercent: 0,
  heldLessons: 0,
  proposal: { value: 'NA' as const, explanation: '' },
  risk: [],
};
const student = (
  i: number,
  last: string,
  grades: GradebookDto['students'][number]['assessmentGrades'] = {},
) => ({
  enrollmentId: `e${String(i)}`,
  studentId: `s${String(i)}`,
  lastName: last,
  firstName: 'Тест',
  middleName: null,
  enrollmentStatus: 'ACTIVE' as const,
  cells: {},
  assessmentGrades: grades,
  summary,
});
const assessment = {
  id: 'a1',
  title: 'Практична 1',
  kind: 'LAB' as const,
  maxScore: 12,
  attestationKind: 'INTERIM' as const,
  version: 0,
};
const data = (over: Partial<GradebookDto> = {}): GradebookDto => ({
  load: {
    id: 'l',
    kind: 'PRACTICE',
    controlForm: 'CREDIT',
    gradingRules: {
      scale: 'TWELVE',
      weights: {},
      minGrades: 3,
      maxUnexcusedAbsencePercent: 50,
      rounding: 'HALF_UP',
      missedTest: 'IGNORE',
    },
    discipline: { id: 'd', title: 'Інформатика', shortTitle: 'Інф', color: '#000' },
    group: { id: 'g', name: 'ПДт-12' },
    subgroup: null,
    teacher: { id: 't', fullName: 'Бойчук' },
  },
  lessons: [
    {
      id: 'l1',
      date: '2026-09-01',
      pairNumber: 2,
      kind: 'LECTURE',
      status: 'HELD',
      topic: 'Вступ',
    },
    {
      id: 'l2',
      date: '2026-09-08',
      pairNumber: 3,
      kind: 'PRACTICE',
      status: 'PLANNED',
      topic: null,
    },
  ],
  students: [
    student(1, 'Бондар', { a1: { id: 'g1', value: 11, comment: null, version: 0 } }),
    student(2, 'Коваленко'),
  ],
  assessments: [assessment],
  periods: [],
  ...over,
});

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const noop = () => undefined;

describe('MobileJournal', () => {
  it('три розділи: студенти за замовчуванням, заняття й колонки за перемикачем', () => {
    renderWithClient(
      <MobileJournal data={data()} onOpenStudent={noop} onAddColumn={noop} onOpenColumn={noop} />,
    );
    expect(screen.getByText('Бондар Тест')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: uk.gradebook.mobile.lessons }));
    expect(screen.getByText('Вступ')).toBeInTheDocument();
    expect(screen.getByText(uk.gradebook.mobile.held)).toBeInTheDocument();
    expect(screen.getByText(uk.gradebook.mobile.planned)).toBeInTheDocument();
    // Заняття веде на екран «На парі» (відмітки й оцінки, у тому числі за минулі дати)
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/lessons/l1',
      '/lessons/l2',
    ]);
  });

  it('колонки: підсумок заповнення; тап відкриває колонку, «+ Колонка» додає', () => {
    const onOpenColumn = vi.fn();
    const onAddColumn = vi.fn();
    renderWithClient(
      <MobileJournal
        data={data()}
        onOpenStudent={noop}
        onAddColumn={onAddColumn}
        onOpenColumn={onOpenColumn}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: uk.gradebook.mobile.columns }));
    expect(screen.getByText(/Проміжна атестація · 1 з 2 оцінок/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Практична 1/ }));
    expect(onOpenColumn).toHaveBeenCalledWith('a1');
    fireEvent.click(screen.getByRole('button', { name: `+ ${uk.gradebook.assessment.add}` }));
    expect(onAddColumn).toHaveBeenCalled();
  });

  it('без колонок — порожній стан із підказкою', () => {
    renderWithClient(
      <MobileJournal
        data={data({ assessments: [] })}
        onOpenStudent={noop}
        onAddColumn={noop}
        onOpenColumn={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: uk.gradebook.mobile.columns }));
    expect(screen.getByText(uk.gradebook.mobile.noColumns)).toBeInTheDocument();
  });
});

describe('AssessmentGradesDialog', () => {
  it('тап по студенту → клавіатура; збереження виставляє оцінку й відкриває наступного', () => {
    const onSet = vi.fn();
    const d = data();
    renderWithClient(
      <AssessmentGradesDialog
        assessment={assessment}
        students={d.students}
        scale="TWELVE"
        onSet={onSet}
        onClear={noop}
        onEdit={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText(uk.gradebook.mobile.filled(1, 2))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Коваленко/ }));
    // Шторка без вибору типу оцінки (тип задано колонкою)
    expect(screen.queryByRole('radiogroup')).toBeNull();
    const sheet = screen.getByRole('dialog', { name: uk.lesson.gradeFor('Коваленко', 'Тест') });
    fireEvent.click(within(sheet).getByRole('button', { name: '9' }));
    expect(onSet).toHaveBeenCalledWith('e2', 9);
  });

  it('для заповненої клітинки є «Прибрати оцінку»', () => {
    const onClear = vi.fn();
    const d = data();
    renderWithClient(
      <AssessmentGradesDialog
        assessment={assessment}
        students={d.students}
        scale="TWELVE"
        onSet={noop}
        onClear={onClear}
        onEdit={noop}
        onClose={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Бондар/ }));
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.deleteGrade }));
    expect(onClear).toHaveBeenCalledWith('e1');
  });
});
