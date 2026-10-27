import type { GradebookDto } from '@ge/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearOfflineData, db } from '../../offline/db';
import { uk } from '../../shared/i18n/uk';
import { renderWithClient } from '../../test/renderWithProviders';

const api = vi.hoisted(() => ({
  fetchGradebook: vi.fn(),
  postGrade: vi.fn(),
  patchGrade: vi.fn(),
  removeGrade: vi.fn(),
  putAttendance: vi.fn(),
  postAssessment: vi.fn(),
  patchAssessment: vi.fn(),
  removeAssessment: vi.fn(),
}));
vi.mock('../../api/teaching', () => api);

const { GradebookScreen } = await import('./GradebookScreen');

const rules = {
  scale: 'TWELVE' as const,
  weights: {},
  minGrades: 3,
  maxUnexcusedAbsencePercent: 50,
  rounding: 'HALF_UP' as const,
  missedTest: 'IGNORE' as const,
};
const summary = (over = {}) => ({
  average: null,
  gradesCount: 0,
  absences: { unexcused: 0, excused: 0, late: 0 },
  absencePercent: 0,
  heldLessons: 0,
  proposal: { value: 'NA' as const, explanation: 'замало оцінок' },
  risk: [],
  ...over,
});
const student = (i: number, last: string, cells = {}, over = {}) => ({
  enrollmentId: `e${i}`,
  studentId: `s${i}`,
  lastName: last,
  firstName: 'Тест',
  middleName: null,
  enrollmentStatus: 'ACTIVE' as const,
  cells,
  assessmentGrades: {},
  summary: summary(over),
});
const book = (): GradebookDto => ({
  load: {
    id: 'load1',
    kind: 'LECTURE',
    controlForm: 'EXAM',
    gradingRules: rules,
    discipline: { id: 'd', title: 'Інформатика', shortTitle: 'Інф', color: '#3B6EA5' },
    group: { id: 'g', name: 'ПДт-12' },
    subgroup: null,
    teacher: { id: 't', fullName: 'Бойчук' },
  },
  lessons: [
    {
      id: 'l1',
      date: '2026-09-07',
      pairNumber: 2,
      kind: 'LECTURE',
      status: 'HELD',
      topic: 'Алгоритми',
    },
    { id: 'l2', date: '2026-09-14', pairNumber: 2, kind: 'LECTURE', status: 'HELD', topic: null },
    {
      id: 'l3',
      date: '2026-09-21',
      pairNumber: 2,
      kind: 'LECTURE',
      status: 'PLANNED',
      topic: null,
    },
  ],
  students: [
    student(
      1,
      'Бондар',
      {
        l1: {
          attendance: 'PRESENT',
          grades: [{ id: 'g1', kind: 'ORAL', value: 9, comment: null, version: 2 }],
        },
      },
      { average: 9, gradesCount: 1 },
    ),
    student(
      2,
      'Коваленко',
      { l1: { attendance: 'ABSENT', grades: [] } },
      { risk: ['ABSENCES'], absences: { unexcused: 1, excused: 0, late: 0 } },
    ),
  ],
  assessments: [],
  periods: [],
});

beforeAll(() => {
  // jsdom не має розкладки: задаємо розміри, щоб віртуалізатор рендерив рядки
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1200 });
  // Десктопна ширина для useMediaQuery
  window.matchMedia = (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  });
});

beforeEach(async () => {
  await clearOfflineData();
  Object.values(api).forEach((m) => m.mockReset());
  api.fetchGradebook.mockResolvedValue(book());
  api.postGrade.mockResolvedValue({});
  api.patchGrade.mockResolvedValue({});
  api.removeGrade.mockResolvedValue({});
  api.putAttendance.mockResolvedValue({});
});

const cell = (r: number, c: number) => screen.getByTestId(`cell-${r}-${c}`);
const grid = () => screen.getByRole('grid');

describe('GradebookScreen', () => {
  it('таблиця «студенти × заняття»: імена, оцінки, відмітки, середній і пропуски', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    expect(screen.getByText('Бондар Тест')).toBeInTheDocument();
    expect(cell(0, 0)).toHaveTextContent('9');
    expect(cell(1, 0)).toHaveTextContent(uk.lesson.attendanceShort.ABSENT);
    expect(screen.getByText('9,0')).toBeInTheDocument();
    // Прогноз без жодного значення не займає місця в таблиці
    expect(screen.queryByText('н/а')).not.toBeInTheDocument();
  });

  it('майбутні заняття за замовчуванням сховані: сітка закінчується сьогоднішнім днем', async () => {
    const data = book();
    data.lessons = [
      ...data.lessons.slice(0, 2),
      {
        id: 'lf',
        date: '2099-01-01',
        pairNumber: 2,
        kind: 'LECTURE',
        status: 'PLANNED',
        topic: null,
      },
    ];
    api.fetchGradebook.mockResolvedValue(data);
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    expect(screen.getByTestId('cell-0-1')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-0-2')).toBeNull();
  });

  it('колонки оцінювання (практичні, модуль) показують оцінки окремо від занять', async () => {
    const data = book();
    data.assessments = [
      {
        id: 'a1',
        title: 'Практична 1',
        kind: 'LAB',
        maxScore: 12,
        attestationKind: 'INTERIM',
        version: 0,
      },
      {
        id: 'a2',
        title: 'Модуль 1',
        kind: 'TEST',
        maxScore: 12,
        attestationKind: 'INTERIM',
        version: 0,
      },
    ];
    const first = data.students[0];
    if (first) first.assessmentGrades = { a1: { id: 'ga1', value: 11, comment: null, version: 0 } };
    api.fetchGradebook.mockResolvedValue(data);
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    expect(screen.getByText('Пр. 1')).toBeInTheDocument();
    expect(screen.getByText('Мод. 1')).toBeInTheDocument();
    expect(screen.getByTestId('assessment-0-a1')).toHaveTextContent('11');
    expect(screen.getByTestId('assessment-0-a2')).toHaveTextContent('');
    expect(screen.getByTestId('assessment-1-a1')).toHaveTextContent('');
  });

  const withColumns = () => {
    const data = book();
    data.assessments = [
      {
        id: 'a1',
        title: 'Практична 1',
        kind: 'LAB',
        maxScore: 12,
        attestationKind: 'INTERIM',
        version: 3,
      },
    ];
    const first = data.students[0];
    if (first) first.assessmentGrades = { a1: { id: 'ga1', value: 11, comment: null, version: 0 } };
    api.fetchGradebook.mockResolvedValue(data);
    return data;
  };

  it('цифра в клітинці колонки оцінювання виставляє оцінку через чергу синхронізації', async () => {
    withColumns();
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(screen.getByTestId('assessment-1-a1'));
    fireEvent.keyDown(grid(), { key: '9' });
    await waitFor(async () => {
      expect((await db.outbox.toArray()).map((r) => r.op)).toEqual([
        expect.objectContaining({
          type: 'assessment.grade.set',
          assessmentId: 'a1',
          enrollmentId: 'e2',
          value: 9,
        }),
      ]);
    });
    // Зміна видна одразу, ще до відповіді сервера (рефетч не має її затирати)
    await waitFor(() => {
      expect(screen.getByTestId('assessment-1-a1')).toHaveTextContent('9');
    });
  });

  it('Delete у клітинці колонки оцінювання ставить «очищення» в чергу', async () => {
    withColumns();
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(screen.getByTestId('assessment-0-a1'));
    fireEvent.keyDown(grid(), { key: 'Delete' });
    await waitFor(async () => {
      expect((await db.outbox.toArray()).map((r) => r.op)).toEqual([
        expect.objectContaining({
          type: 'assessment.grade.clear',
          assessmentId: 'a1',
          enrollmentId: 'e1',
        }),
      ]);
    });
    await waitFor(() => {
      expect(screen.getByTestId('assessment-0-a1')).toHaveTextContent('');
    });
  });

  it('«+ Колонка» створює колонку з підказаною назвою', async () => {
    withColumns();
    api.postAssessment.mockResolvedValue({});
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(screen.getByRole('button', { name: `+ ${uk.gradebook.assessment.add}` }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(uk.gradebook.assessment.title)).toHaveValue('Практична 2');
    fireEvent.click(
      within(dialog).getByRole('button', { name: uk.gradebook.assessment.kinds.TEST }),
    );
    expect(within(dialog).getByLabelText(uk.gradebook.assessment.title)).toHaveValue('Модуль 1');
    fireEvent.click(within(dialog).getByRole('button', { name: uk.common.save }));
    await waitFor(() => {
      expect(api.postAssessment).toHaveBeenCalledWith(
        'load1',
        expect.objectContaining({ title: 'Модуль 1', kind: 'TEST', attestationKind: null }),
      );
    });
  });

  it('клік по заголовку колонки редагує її (версія з даних), видалення — з підтвердженням', async () => {
    withColumns();
    api.patchAssessment.mockResolvedValue({});
    api.removeAssessment.mockResolvedValue(undefined);
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(
      screen.getByRole('button', { name: uk.gradebook.assessment.column('Практична 1') }),
    );
    const dialog = await screen.findByRole('dialog');
    const title = within(dialog).getByLabelText(uk.gradebook.assessment.title);
    expect(title).toHaveValue('Практична 1');
    fireEvent.change(title, { target: { value: 'Практична 1 (завдання)' } });
    fireEvent.click(within(dialog).getByRole('button', { name: uk.common.save }));
    await waitFor(() => {
      expect(api.patchAssessment).toHaveBeenCalledWith(
        'a1',
        3,
        expect.objectContaining({ title: 'Практична 1 (завдання)', attestationKind: 'INTERIM' }),
      );
    });

    fireEvent.click(
      screen.getByRole('button', { name: uk.gradebook.assessment.column('Практична 1') }),
    );
    const again = await screen.findByRole('dialog');
    fireEvent.click(within(again).getByRole('button', { name: uk.common.delete }));
    const confirm = await screen.findByText(uk.gradebook.assessment.deleteConfirm('Практична 1'));
    fireEvent.click(
      within(confirm.closest('[role="dialog"]') as HTMLElement).getByRole('button', {
        name: uk.common.delete,
      }),
    );
    await waitFor(() => {
      expect(api.removeAssessment).toHaveBeenCalledWith('a1');
    });
  });

  it('цифра у вибраній клітинці виставляє оцінку (9 — одразу), тип за видом заняття', async () => {
    api.postGrade.mockReturnValue(new Promise(() => undefined)); // відповідь не приходить: лишається оптимістичний стан
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(cell(1, 1));
    fireEvent.keyDown(grid(), { key: '9' });
    await waitFor(() => {
      expect(api.postGrade).toHaveBeenCalled();
    });
    expect(api.postGrade.mock.calls[0]).toEqual([
      'l2',
      expect.objectContaining({ enrollmentId: 'e2', kind: 'ORAL', value: 9 }),
    ]);
    await waitFor(() => {
      expect(cell(1, 1)).toHaveTextContent('9');
    });
  });

  it('двозначна оцінка: «1» чекає, «0» завершує → 10', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(cell(1, 1));
    fireEvent.keyDown(grid(), { key: '1' });
    expect(api.postGrade).not.toHaveBeenCalled();
    fireEvent.keyDown(grid(), { key: '0' });
    await waitFor(() => {
      expect(api.postGrade).toHaveBeenCalled();
    });
    expect((api.postGrade.mock.calls[0] as [string, { value: number }])[1].value).toBe(10);
  });

  it('цифра у клітинці з оцінкою змінює її (PATCH з версією)', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(grid(), { key: '5' });
    await waitFor(() => {
      expect(api.patchGrade).toHaveBeenCalledWith('g1', 2, { kind: 'ORAL', value: 5 });
    });
    expect(api.postGrade).not.toHaveBeenCalled();
  });

  it('Delete прибирає останню оцінку; без оцінки знімає «н»', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(grid(), { key: 'Delete' });
    await waitFor(() => {
      expect(api.removeGrade).toHaveBeenCalledWith('g1');
    });

    fireEvent.click(cell(1, 0));
    fireEvent.keyDown(grid(), { key: 'Delete' });
    await waitFor(() => {
      expect(api.putAttendance).toHaveBeenCalledWith('l1', [
        { enrollmentId: 'e2', status: 'PRESENT' },
      ]);
    });
  });

  it('«н», «п», «з» ставлять відмітки; стрілки рухають вибір', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(grid(), { key: 'ArrowRight' });
    fireEvent.keyDown(grid(), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(cell(1, 1)).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(grid(), { key: 'п' });
    await waitFor(() => {
      expect(api.putAttendance).toHaveBeenCalledWith('l2', [
        { enrollmentId: 'e2', status: 'EXCUSED' },
      ]);
    });
    fireEvent.keyDown(grid(), { key: 'ArrowUp' });
    fireEvent.keyDown(grid(), { key: 'з' });
    await waitFor(() => {
      expect(api.putAttendance).toHaveBeenCalledWith('l2', [
        { enrollmentId: 'e1', status: 'LATE' },
      ]);
    });
  });

  it('межі: стрілка вліво в першій клітинці нікуди не веде, оцінка поза шкалою ігнорується', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(grid(), { key: 'ArrowLeft' });
    expect(cell(0, 0)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(grid(), { key: '9' }); // валідно, але клітинка вже має оцінку → PATCH
    await waitFor(() => {
      expect(api.patchGrade).toHaveBeenCalled();
    });
  });

  it('Enter відкриває шторку оцінки для вибраної клітинки', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(cell(1, 1));
    fireEvent.keyDown(grid(), { key: 'Enter' });
    const dialog = await screen.findByRole('dialog', {
      name: uk.lesson.gradeFor('Коваленко', 'Тест'),
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '11' }));
    await waitFor(() => {
      expect(api.postGrade).toHaveBeenCalled();
    });
    expect((api.postGrade.mock.calls[0] as [string, { value: number }])[1].value).toBe(11);
  });

  it('клік по імені відкриває картку студента зі зведенням', async () => {
    renderWithClient(<GradebookScreen loadId="load1" />);
    await screen.findByRole('grid');
    fireEvent.click(screen.getByText('Коваленко Тест'));
    const panel = await screen.findByRole('complementary');
    expect(within(panel).getByText(new RegExp(uk.gradebook.panel.risk))).toBeInTheDocument();
    expect(within(panel).getByText(new RegExp(uk.gradebook.panel.absent))).toBeInTheDocument();
  });
});
