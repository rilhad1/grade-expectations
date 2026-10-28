import type { LessonDetailDto } from '@ge/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearOfflineData, db } from '../../offline/db';
import { uk } from '../../shared/i18n/uk';
import { renderWithClient } from '../../test/renderWithProviders';

const api = vi.hoisted(() => ({
  fetchLesson: vi.fn(),
  fetchToday: vi.fn(),
  fetchTopics: vi.fn(),
}));
vi.mock('../../api/teaching', () => api);
vi.mock('../../api/queries', () => ({
  q: {
    bells: () => ({
      queryKey: ['bells'],
      queryFn: () => [{ pairNumber: 2, startsAt: '10:00', endsAt: '11:20' }],
    }),
  },
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../shared/ui/links', () => ({
  LinkButton: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  LinkBase: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

const { LessonScreen } = await import('./LessonScreen');

const person = (i: number, last: string) => ({
  enrollmentId: `e${i}`,
  studentId: `s${i}`,
  lastName: last,
  firstName: 'Тест',
  middleName: null,
  attendance: 'PRESENT' as const,
  marked: false,
  grades: [],
});
const lesson = (over: Partial<LessonDetailDto> = {}): LessonDetailDto => ({
  id: 'l1',
  loadId: 'load1',
  date: '2020-01-01',
  pairNumber: 2,
  hours: 2,
  status: 'PLANNED',
  kind: 'LECTURE',
  topic: 'Алгоритми',
  homework: null,
  note: null,
  manuallyEdited: false,
  streamId: null,
  stream: [],
  version: 0,
  scale: 'TWELVE',
  undoUntil: null,
  discipline: { id: 'd', title: 'Інформатика', shortTitle: 'Інф', color: '#3B6EA5' },
  group: { id: 'g', name: 'ПДт-12' },
  subgroup: null,
  room: { id: 'r', name: '214' },
  teacher: { id: 't', fullName: 'Бойчук В.В.' },
  roster: [person(1, 'Бондар'), person(2, 'Коваленко'), person(3, 'Мельник')],
  ...over,
});

beforeEach(async () => {
  await clearOfflineData();
  Object.values(api).forEach((m) => m.mockReset());
  api.fetchLesson.mockResolvedValue(lesson());
  api.fetchTopics.mockResolvedValue({
    programId: null,
    edition: null,
    loadKind: 'LECTURE',
    topics: [],
  });
});

const row = (i: number) => screen.getByTestId(`row-e${i}`);
const counter = () =>
  screen.getByText(new RegExp(`${uk.lesson.present} \\d+ ${uk.lesson.of} \\d+`)).textContent;

describe('LessonScreen («На парі»)', () => {
  it('показує групу, тему й склад; усі присутні за замовчуванням', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />);
    expect(await screen.findByText(/ПДт-12 · Інф/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${uk.lesson.topic}: Алгоритми`))).toBeInTheDocument();
    expect(counter()).toBe(`${uk.lesson.present} 3 ${uk.lesson.of} 3`);
  });

  it('перемикач «н» відмічає миттєво і ставить зміну в чергу (без відповіді сервера)', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e1');

    fireEvent.click(screen.getByTestId('absent-e1'));
    await waitFor(() => {
      expect(counter()).toBe(`${uk.lesson.present} 2 ${uk.lesson.of} 3`);
    });
    expect(screen.getByTestId('absent-e1')).toHaveAttribute('aria-checked', 'true');
    const queued = await db.outbox.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.op).toMatchObject({
      type: 'attendance.set',
      lessonId: 'l1',
      enrollmentId: 'e1',
      status: 'ABSENT',
    });
  });

  it('без мережі заняття береться з локальної копії, а зміни лишаються в черзі', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />).unmount();
    await waitFor(async () => {
      expect(await db.lessons.get('l1')).toBeDefined();
    });

    api.fetchLesson.mockRejectedValue(new TypeError('Failed to fetch'));
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e1');
    fireEvent.click(screen.getByTestId('absent-e1'));
    await waitFor(() => {
      expect(counter()).toBe(`${uk.lesson.present} 2 ${uk.lesson.of} 3`);
    });
    expect(await db.outbox.count()).toBe(1);
    expect((await db.lessons.get('l1'))?.detail.roster[0]?.attendance).toBe('ABSENT');
  });

  it('відповідь сервера не затирає ще не відправлені локальні зміни', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />).unmount();
    await waitFor(async () => {
      expect(await db.lessons.get('l1')).toBeDefined();
    });
    await db.outbox.add({
      opId: 'op1',
      lessonId: 'l1',
      op: {
        opId: 'op1',
        type: 'attendance.set',
        lessonId: 'l1',
        at: new Date().toISOString(),
        enrollmentId: 'e1',
        status: 'ABSENT',
      },
    });

    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e1');
    expect(counter()).toBe(`${uk.lesson.present} 2 ${uk.lesson.of} 3`);
  });

  it('оцінка вписується в поле рядка: Enter зберігає з типом за видом заняття', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e2');

    const input = screen.getByRole('textbox', { name: uk.lesson.gradeInputFor('Коваленко Тест') });
    fireEvent.change(input, { target: { value: '11' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await within(row(2).parentElement as HTMLElement).findByText('11')).toBeInTheDocument();
    expect(input).toHaveValue('');
    const queued = await db.outbox.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.op).toMatchObject({ type: 'grade.set', enrollmentId: 'e2', value: 11 });
  });

  it('оцінка поза шкалою не зберігається', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e2');

    const input = screen.getByRole('textbox', { name: uk.lesson.gradeInputFor('Коваленко Тест') });
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(input).toHaveValue('99');
    expect(await db.outbox.count()).toBe(0);
  });

  it('оцінка: шторка → число → чіп з’являється одразу, у чергу йде id від клієнта', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e2');

    fireEvent.click(screen.getByRole('button', { name: uk.lesson.addGradeFor('Коваленко Тест') }));
    fireEvent.click(await screen.findByRole('button', { name: '10' }));

    expect(await within(row(2).parentElement as HTMLElement).findByText('10')).toBeInTheDocument();
    const queued = await db.outbox.toArray();
    expect(queued[0]?.op).toMatchObject({
      type: 'grade.set',
      enrollmentId: 'e2',
      kind: 'ORAL',
      value: 10,
    });
    expect((queued[0]?.op as { gradeId: string }).gradeId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('«Завершити пару» показує підсумок зі скасуванням і ставить зміну в чергу', async () => {
    renderWithClient(<LessonScreen lessonId="l1" />);
    fireEvent.click(await screen.findByRole('button', { name: uk.lesson.finish }));
    expect(
      await screen.findByRole('heading', { name: uk.lesson.finishedTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(uk.lesson.finishedSummary(3, 3, 0))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(uk.lesson.undo) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: uk.lesson.finish })).not.toBeInTheDocument();
    expect((await db.outbox.toArray()).map((r) => r.op.type)).toEqual(['lesson.finish']);
  });

  it('проведене заняття (у тому числі давнє) можна виправити: «Змінити відмітки й оцінки»', async () => {
    api.fetchLesson.mockResolvedValue(lesson({ status: 'HELD' }));
    renderWithClient(<LessonScreen lessonId="l1" />);
    // Спершу підсумок; редагування вмикається кнопкою (скасування завершення давно недоступне)
    fireEvent.click(await screen.findByRole('button', { name: uk.lesson.editHeld }));
    await screen.findByTestId('row-e1');
    fireEvent.click(screen.getByTestId('absent-e2'));
    await waitFor(() => {
      expect(counter()).toBe(`${uk.lesson.present} 2 ${uk.lesson.of} 3`);
    });
    expect((await db.outbox.toArray()).map((r) => r.op.type)).toEqual(['attendance.set']);
    // «Готово» повертає підсумок без повторного завершення заняття
    fireEvent.click(screen.getByRole('button', { name: uk.lesson.doneEditing }));
    expect(
      await screen.findByRole('heading', { name: uk.lesson.finishedTitle }),
    ).toBeInTheDocument();
    expect((await db.outbox.toArray()).map((r) => r.op.type)).toEqual(['attendance.set']);
  });

  it('потік лекцій: вкладки груп ведуть на сусідні заняття, «Завершити для всіх груп» ставить завершення кожного', async () => {
    api.fetchLesson.mockResolvedValue(
      lesson({
        stream: [
          { lessonId: 'l1', group: { id: 'g', name: 'КІт-31' } },
          { lessonId: 'l2', group: { id: 'g2', name: 'КІт-32' } },
        ],
      }),
    );
    renderWithClient(<LessonScreen lessonId="l1" />);
    const tabs = await screen.findByRole('group', { name: uk.lesson.streamGroups });
    expect(within(tabs).getByRole('button', { name: 'КІт-31' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(tabs).getByRole('button', { name: 'КІт-32' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/lessons/$lessonId', params: { lessonId: 'l2' } });

    fireEvent.click(screen.getByRole('button', { name: uk.lesson.finishStream }));
    await screen.findByRole('heading', { name: uk.lesson.finishedTitle });
    const queued = await db.outbox.toArray();
    expect(queued.map((r) => [r.op.type, r.lessonId]).sort()).toEqual([
      ['lesson.finish', 'l1'],
      ['lesson.finish', 'l2'],
    ]);
  });

  it('майбутнє заняття не можна завершити; скасоване не приймає відміток', async () => {
    api.fetchLesson.mockResolvedValue(lesson({ date: '2099-01-01' }));
    const first = renderWithClient(<LessonScreen lessonId="l1" />);
    expect(await screen.findByText(uk.lesson.notYet)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: uk.lesson.finish })).toBeDisabled();
    first.unmount();

    api.fetchLesson.mockResolvedValue(lesson({ status: 'CANCELLED' }));
    renderWithClient(<LessonScreen lessonId="l1" />);
    expect(await screen.findByText(uk.lesson.cancelled)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('absent-e1'));
    expect(await db.outbox.count()).toBe(0);
  });
});
