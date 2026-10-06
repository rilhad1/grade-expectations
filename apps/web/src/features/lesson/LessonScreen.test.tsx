import type { LessonDetailDto } from '@ge/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';
import { renderWithClient } from '../../test/renderWithProviders';

const api = vi.hoisted(() => ({
  fetchLesson: vi.fn(),
  putAttendance: vi.fn(),
  postGrade: vi.fn(),
  patchGrade: vi.fn(),
  removeGrade: vi.fn(),
  finishLesson: vi.fn(),
  reopenLesson: vi.fn(),
  patchLesson: vi.fn(),
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
vi.mock('../../shared/ui/links', () => ({
  LinkButton: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
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

beforeEach(() => {
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

  it('тап по студенту відмічає «н» миттєво (оптимістично), ще до відповіді сервера', async () => {
    let resolve: (v: LessonDetailDto) => void = () => undefined;
    api.putAttendance.mockReturnValue(
      new Promise<LessonDetailDto>((r) => {
        resolve = r;
      }),
    );
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e1');

    fireEvent.click(row(1));
    await waitFor(() => {
      expect(counter()).toBe(`${uk.lesson.present} 2 ${uk.lesson.of} 3`);
    });
    expect(within(row(1)).getByText('н')).toBeInTheDocument();
    expect(api.putAttendance).toHaveBeenCalledWith('l1', [
      { enrollmentId: 'e1', status: 'ABSENT' },
    ]);

    resolve(
      lesson({
        roster: [
          { ...person(1, 'Бондар'), attendance: 'ABSENT', marked: true },
          person(2, 'Коваленко'),
          person(3, 'Мельник'),
        ],
      }),
    );
    await waitFor(() => {
      expect(counter()).toBe(`${uk.lesson.present} 2 ${uk.lesson.of} 3`);
    });
  });

  it('помилка збереження відкочує відмітку й показує повідомлення', async () => {
    api.putAttendance.mockRejectedValue(new Error('network'));
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e1');
    fireEvent.click(row(1));
    await waitFor(() => {
      expect(counter()).toBe(`${uk.lesson.present} 3 ${uk.lesson.of} 3`);
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('оцінка: шторка → число → чіп з’являється одразу, на сервер іде id від клієнта', async () => {
    api.postGrade.mockReturnValue(new Promise(() => undefined));
    renderWithClient(<LessonScreen lessonId="l1" />);
    await screen.findByTestId('row-e2');

    fireEvent.click(screen.getByRole('button', { name: uk.lesson.addGradeFor('Коваленко Тест') }));
    fireEvent.click(await screen.findByRole('button', { name: '10' }));

    expect(await within(row(2).parentElement as HTMLElement).findByText('10')).toBeInTheDocument();
    const [lessonId, body] = api.postGrade.mock.calls[0] as [
      string,
      { id: string; enrollmentId: string; kind: string; value: number },
    ];
    expect(lessonId).toBe('l1');
    expect(body).toMatchObject({ enrollmentId: 'e2', kind: 'ORAL', value: 10 });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('«Завершити пару» викликає сервер і показує підсумок зі скасуванням', async () => {
    api.finishLesson.mockResolvedValue(
      lesson({ status: 'HELD', undoUntil: new Date(Date.now() + 600_000).toISOString() }),
    );
    renderWithClient(<LessonScreen lessonId="l1" />);
    fireEvent.click(await screen.findByRole('button', { name: uk.lesson.finish }));
    expect(await screen.findByText(uk.lesson.finishedTitle + '.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: uk.lesson.undo })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: uk.lesson.finish })).not.toBeInTheDocument();
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
    fireEvent.click(row(1));
    expect(api.putAttendance).not.toHaveBeenCalled();
  });
});
