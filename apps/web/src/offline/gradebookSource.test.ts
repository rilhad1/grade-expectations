import type { GradebookDto } from '@ge/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http';

const api = vi.hoisted(() => ({ fetchGradebook: vi.fn() }));
vi.mock('../api/teaching', () => api);

const { clearOfflineData, db } = await import('./db');
const { loadGradebook, applyOpsToGradebook } = await import('./gradebookSource');
const { submitOp } = await import('./outbox');

const student = (id: string, grades: GradebookDto['students'][number]['assessmentGrades'] = {}) =>
  ({
    enrollmentId: id,
    studentId: `s-${id}`,
    lastName: id,
    firstName: 'Тест',
    middleName: null,
    enrollmentStatus: 'ACTIVE',
    cells: {},
    assessmentGrades: grades,
    summary: {},
  }) as unknown as GradebookDto['students'][number];

const book = (): GradebookDto =>
  ({
    lessons: [],
    students: [
      student('e1', { a1: { id: 'g1', value: 10, comment: null, version: 0 } }),
      student('e2'),
    ],
    assessments: [
      {
        id: 'a1',
        title: 'Практична 1',
        kind: 'LAB',
        maxScore: 12,
        attestationKind: null,
        version: 0,
      },
    ],
    periods: [],
  }) as unknown as GradebookDto;

const valueOf = (dto: GradebookDto, enrollment: string) =>
  dto.students.find((s) => s.enrollmentId === enrollment)?.assessmentGrades['a1']?.value;

beforeEach(async () => {
  await clearOfflineData();
  api.fetchGradebook.mockReset();
});

describe('loadGradebook', () => {
  it('онлайн: повертає відповідь сервера й запам’ятовує її', async () => {
    api.fetchGradebook.mockResolvedValue(book());
    const dto = await loadGradebook('l1', {});
    expect(valueOf(dto, 'e1')).toBe(10);
    // Без мережі повертається остання збережена копія
    api.fetchGradebook.mockRejectedValue(new TypeError('Failed to fetch'));
    const offline = await loadGradebook('l1', {});
    expect(valueOf(offline, 'e1')).toBe(10);
  });

  it('без мережі й без копії — помилка; бізнес-помилка сервера не маскується копією', async () => {
    api.fetchGradebook.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(loadGradebook('l1', {})).rejects.toBeInstanceOf(TypeError);
    api.fetchGradebook.mockResolvedValue(book());
    await loadGradebook('l1', {});
    api.fetchGradebook.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Немає', undefined));
    await expect(loadGradebook('l1', {})).rejects.toBeInstanceOf(ApiError);
  });

  it('зміни з черги накладаються поверх (і онлайн, і офлайн); чужі колонки не зачіпаються', async () => {
    api.fetchGradebook.mockResolvedValue(book());
    await loadGradebook('l1', {});
    await submitOp({
      type: 'assessment.grade.set',
      assessmentId: 'a1',
      enrollmentId: 'e2',
      value: 7,
      comment: null,
    });
    await submitOp({ type: 'assessment.grade.clear', assessmentId: 'a1', enrollmentId: 'e1' });
    await submitOp({
      type: 'assessment.grade.set',
      assessmentId: 'інша-колонка',
      enrollmentId: 'e2',
      value: 3,
      comment: null,
    });

    for (const mode of ['online', 'offline'] as const) {
      if (mode === 'offline') api.fetchGradebook.mockRejectedValue(new TypeError('x'));
      const dto = await loadGradebook('l1', {});
      expect(valueOf(dto, 'e2')).toBe(7);
      expect(valueOf(dto, 'e1')).toBeUndefined();
    }
    expect(await db.outbox.count()).toBe(3);
  });
});

describe('applyOpsToGradebook', () => {
  it('порядок важливий: остання операція по клітинці перемагає', () => {
    const dto = applyOpsToGradebook(book(), [
      {
        opId: '1',
        at: '2026-01-01T00:00:00.000Z',
        type: 'assessment.grade.set',
        assessmentId: 'a1',
        enrollmentId: 'e2',
        value: 5,
        comment: null,
      },
      {
        opId: '2',
        at: '2026-01-01T00:01:00.000Z',
        type: 'assessment.grade.clear',
        assessmentId: 'a1',
        enrollmentId: 'e2',
      },
    ] as never);
    expect(valueOf(dto, 'e2')).toBeUndefined();
  });
});
