import type { LessonDetailDto } from '@ge/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http';

const api = vi.hoisted(() => ({ fetchLesson: vi.fn(), fetchToday: vi.fn() }));
vi.mock('../api/teaching', () => api);
vi.mock('../app/today', () => ({ todayKyiv: () => '2026-10-12' }));

const { loadLesson, loadToday } = await import('./lessonSource');
const { clearOfflineData, db } = await import('./db');

const offline = () => new TypeError('Failed to fetch');
const lesson = (id: string, pairNumber: number, date = '2026-10-12'): LessonDetailDto =>
  ({
    id,
    loadId: '0198a3a0-0000-7000-8000-000000000100',
    date,
    pairNumber,
    hours: 2,
    status: 'PLANNED',
    kind: 'LECTURE',
    topic: null,
    homework: null,
    note: null,
    manuallyEdited: false,
    version: 0,
    discipline: {
      id: '0198a3a0-0000-7000-8000-000000000101',
      title: 'Інформатика',
      shortTitle: 'Інф',
      color: '#000000',
    },
    group: { id: '0198a3a0-0000-7000-8000-000000000102', name: 'ПДт-12' },
    subgroup: null,
    room: null,
    teacher: { id: '0198a3a0-0000-7000-8000-000000000103', fullName: 'Бойчук' },
    scale: 'TWELVE',
    undoUntil: null,
    roster: [
      { enrollmentId: 'e1', attendance: 'PRESENT', marked: true, grades: [] },
      { enrollmentId: 'e2', attendance: 'PRESENT', marked: false, grades: [] },
    ],
  }) as unknown as LessonDetailDto;

beforeEach(async () => {
  await clearOfflineData();
  api.fetchLesson.mockReset();
  api.fetchToday.mockReset();
});

describe('loadLesson', () => {
  it('онлайн зберігає заняття в локальній базі', async () => {
    api.fetchLesson.mockResolvedValue(lesson('l1', 1));
    await loadLesson('l1');
    expect((await db.lessons.get('l1'))?.date).toBe('2026-10-12');
  });

  it('офлайн віддає локальну копію; без копії — помилку мережі; бізнес-помилки не маскує', async () => {
    await db.lessons.put({ id: 'l1', date: '2026-10-12', detail: lesson('l1', 1) });
    api.fetchLesson.mockRejectedValue(offline());
    expect((await loadLesson('l1')).id).toBe('l1');
    await expect(loadLesson('other')).rejects.toThrow(TypeError);
    api.fetchLesson.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'x'));
    await expect(loadLesson('l1')).rejects.toThrow(ApiError);
  });
});

describe('loadToday', () => {
  it('онлайн повертає відповідь сервера', async () => {
    const dto = { date: '2026-10-12', lessons: [], attestations: [], risk: [], hours: [] };
    api.fetchToday.mockResolvedValue(dto);
    expect(await loadToday()).toBe(dto);
  });

  it('офлайн збирає сьогоднішні пари з локальної копії за номером пари', async () => {
    await db.lessons.bulkPut([
      {
        id: '0198a3a0-0000-7000-8000-000000000002',
        date: '2026-10-12',
        detail: lesson('0198a3a0-0000-7000-8000-000000000002', 3),
      },
      {
        id: '0198a3a0-0000-7000-8000-000000000001',
        date: '2026-10-12',
        detail: lesson('0198a3a0-0000-7000-8000-000000000001', 1),
      },
      {
        id: '0198a3a0-0000-7000-8000-000000000003',
        date: '2026-10-13',
        detail: lesson('0198a3a0-0000-7000-8000-000000000003', 1, '2026-10-13'),
      },
    ]);
    api.fetchToday.mockRejectedValue(offline());
    const today = await loadToday();
    expect(today.lessons.map((l) => [l.id, l.marked, l.total])).toEqual([
      ['0198a3a0-0000-7000-8000-000000000001', 1, 2],
      ['0198a3a0-0000-7000-8000-000000000002', 1, 2],
    ]);
    expect(today).toMatchObject({ attestations: [], risk: [], hours: [] });
  });

  it('офлайн без жодних даних — помилка, а не порожній день', async () => {
    api.fetchToday.mockRejectedValue(offline());
    await expect(loadToday()).rejects.toThrow(TypeError);
  });

  it('офлайн, коли на сьогодні пар немає, але копія є — порожній список', async () => {
    await db.lessons.put({ id: 'x', date: '2026-10-13', detail: lesson('x', 1, '2026-10-13') });
    api.fetchToday.mockRejectedValue(offline());
    expect((await loadToday()).lessons).toEqual([]);
  });
});
