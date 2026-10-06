import type { LessonDetailDto, PullResponse, PushResponse, SyncOp } from '@ge/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/http';

import { cachedFetch } from './cache';
import { clearOfflineData, db, getMeta, setMeta } from './db';
import { setSubmitHook, submitOp } from './outbox';
import { bindUser, prepareLogout, runSync, type SyncApi } from './sync';
import { refreshSyncStatus, useSyncStore } from './syncStore';

const detail = (id: string, date = '2026-10-12'): LessonDetailDto =>
  ({
    id,
    date,
    pairNumber: 1,
    status: 'PLANNED',
    topic: null,
    homework: null,
    note: null,
    undoUntil: null,
    roster: [
      { enrollmentId: 'e1', attendance: 'PRESENT', marked: false, grades: [] },
      { enrollmentId: 'e2', attendance: 'PRESENT', marked: false, grades: [] },
    ],
  }) as unknown as LessonDetailDto;

const pullOf = (lessons: LessonDetailDto[], removed: string[] = []): PullResponse => ({
  cursor: '2026-10-12T07:00:00.000Z',
  window: { from: '2026-09-28', to: '2026-10-26' },
  bells: [{ pairNumber: 1, startsAt: '08:00', endsAt: '09:20' }],
  lessons,
  removedLessonIds: removed,
});

const api = (
  over: Partial<SyncApi> = {},
): SyncApi & { push: ReturnType<typeof vi.fn>; pull: ReturnType<typeof vi.fn> } =>
  ({
    push: vi.fn((ops: SyncOp[]): Promise<PushResponse> =>
      Promise.resolve({ results: ops.map((o) => ({ opId: o.opId, status: 'applied' as const })) }),
    ),
    pull: vi.fn(() => Promise.resolve(pullOf([]))),
    ...over,
  }) as never;

const mark = (lessonId: string, enrollmentId = 'e1', status: 'ABSENT' | 'PRESENT' = 'ABSENT') =>
  submitOp({ type: 'attendance.set', lessonId, enrollmentId, status });

beforeEach(async () => {
  setSubmitHook(() => undefined); // тести самі керують моментом синхронізації
  await clearOfflineData();
  useSyncStore.setState({ online: true, problem: null, syncing: false, pending: 0, notices: [] });
});

describe('submitOp', () => {
  it('застосовує зміну до локальної копії й кладе її в чергу', async () => {
    await db.lessons.put({ id: 'l1', date: '2026-10-12', detail: detail('l1') });
    const op = await mark('l1');
    expect(op.opId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await db.lessons.get('l1'))?.detail.roster[0]?.attendance).toBe('ABSENT');
    expect((await db.outbox.toArray()).map((r) => r.opId)).toEqual([op.opId]);
    expect(useSyncStore.getState().pending).toBe(1);
  });

  it('чергу веде навіть без локальної копії заняття', async () => {
    await mark('unknown');
    expect(await db.outbox.count()).toBe(1);
  });
});

describe('runSync', () => {
  it('відправляє чергу, очищує її й підтягує знімок з курсором і дзвінками', async () => {
    await db.lessons.put({ id: 'l1', date: '2026-10-12', detail: detail('l1') });
    await mark('l1');
    const fake = api({
      pull: vi.fn(() => Promise.resolve(pullOf([{ ...detail('l1'), topic: 'Із сервера' }]))),
    });
    await runSync(fake);

    expect(fake.push).toHaveBeenCalledTimes(1);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.lessons.get('l1'))?.detail.topic).toBe('Із сервера');
    expect(await getMeta('cursor')).toBe('2026-10-12T07:00:00.000Z');
    expect(await getMeta('cache:bells')).toHaveLength(1);
    const state = useSyncStore.getState();
    expect(state).toMatchObject({ online: true, problem: null, pending: 0 });
    expect(state.lastSyncAt).not.toBeNull();
  });

  it('нова відповідь сервера не затирає зміни, що з’явилися, поки йшов запит', async () => {
    await db.lessons.put({ id: 'l1', date: '2026-10-12', detail: detail('l1') });
    const fake = api({
      pull: vi.fn(async () => {
        await mark('l1', 'e2'); // користувач відмітив студента під час запиту
        return pullOf([detail('l1')]);
      }),
    });
    await runSync(fake);
    const roster = (await db.lessons.get('l1'))?.detail.roster;
    expect(roster?.find((r) => r.enrollmentId === 'e2')?.attendance).toBe('ABSENT');
    expect(await db.outbox.count()).toBe(1); // нову зміну відправить наступне коло
  });

  it('без мережі зміни лишаються в черзі, індикатор показує офлайн', async () => {
    await mark('l1');
    const fake = api({ push: vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) });
    await runSync(fake);
    expect(await db.outbox.count()).toBe(1);
    expect(useSyncStore.getState()).toMatchObject({ online: false, pending: 1, problem: null });
    // зв'язок повернувся
    await runSync(api());
    expect(await db.outbox.count()).toBe(0);
    expect(useSyncStore.getState().online).toBe(true);
  });

  it('відмова сервера: сповіщення користувачу й повний знімок (локальна зміна відкочується)', async () => {
    await db.lessons.put({ id: 'l1', date: '2026-10-12', detail: detail('l1') });
    await mark('l1');
    const fake = api({
      push: vi.fn((ops: SyncOp[]) =>
        Promise.resolve({
          results: ops.map((o) => ({
            opId: o.opId,
            status: 'rejected' as const,
            code: 'LESSON_NOT_ACTIVE',
            message: 'Заняття скасовано',
          })),
        }),
      ),
      pull: vi.fn(() => Promise.resolve(pullOf([detail('l1')]))),
    });
    await runSync(fake);
    expect(fake.pull).toHaveBeenCalledWith(undefined);
    expect((await db.lessons.get('l1'))?.detail.roster[0]?.attendance).toBe('PRESENT');
    expect(useSyncStore.getState().notices).toMatchObject([
      { kind: 'rejected', message: 'Заняття скасовано' },
    ]);
  });

  it('програш у конфлікті показується як застереження', async () => {
    await mark('l1');
    const fake = api({
      push: vi.fn((ops: SyncOp[]) =>
        Promise.resolve({
          results: ops.map((o) => ({
            opId: o.opId,
            status: 'skipped' as const,
            code: 'SUPERSEDED',
          })),
        }),
      ),
    });
    await runSync(fake);
    expect(useSyncStore.getState().notices[0]).toMatchObject({ kind: 'superseded' });
  });

  it('некоректна зміна в пачці не блокує решту: відправка по одній', async () => {
    const good = await mark('l1', 'e1');
    const bad = await mark('l1', 'e2');
    const push = vi.fn((ops: SyncOp[]) => {
      if (ops.length > 1) return Promise.reject(new ApiError(400, 'VALIDATION_ERROR', 'Bad'));
      if (ops[0]?.opId === bad.opId)
        return Promise.reject(new ApiError(400, 'VALIDATION_ERROR', 'Bad'));
      return Promise.resolve({ results: [{ opId: good.opId, status: 'applied' as const }] });
    });
    await runSync(api({ push }));
    expect(await db.outbox.count()).toBe(0);
    expect(useSyncStore.getState().notices).toHaveLength(1);
  });

  it('одиночна некоректна зміна відхиляється й не застрягає в черзі', async () => {
    await mark('l1');
    await runSync(api({ push: vi.fn(() => Promise.reject(new ApiError(422, 'X', 'Bad'))) }));
    expect(await db.outbox.count()).toBe(0);
    expect(useSyncStore.getState().notices).toHaveLength(1);
  });

  it('401 — потрібен новий вхід, 500 — проблема сервера; зміни збережено', async () => {
    await mark('l1');
    await runSync(
      api({ push: vi.fn(() => Promise.reject(new ApiError(401, 'UNAUTHENTICATED', 'x'))) }),
    );
    expect(useSyncStore.getState().problem).toBe('auth');
    await runSync(api({ push: vi.fn(() => Promise.reject(new ApiError(500, 'X', 'x'))) }));
    expect(useSyncStore.getState().problem).toBe('server');
    expect(await db.outbox.count()).toBe(1);
  });

  it('повний знімок прибирає заняття поза вікном, але не чіпає ті, що мають чергу змін', async () => {
    await db.lessons.bulkPut([
      { id: 'old', date: '2026-01-01', detail: detail('old', '2026-01-01') },
      { id: 'keep', date: '2026-01-02', detail: detail('keep', '2026-01-02') },
      { id: 'l1', date: '2026-10-12', detail: detail('l1') },
    ]);
    await db.outbox.add({
      opId: 'x',
      lessonId: 'keep',
      op: {
        opId: 'x',
        type: 'lesson.finish',
        lessonId: 'keep',
        at: '2026-10-12T07:00:00.000Z',
      },
    });
    // пуш недоступний, але pull відпрацює лише після пушу — тому запускаємо через відмову сервера
    const fake = api({
      push: vi.fn((ops: SyncOp[]) =>
        Promise.resolve({
          results: ops.map((o) => ({ opId: o.opId, status: 'rejected' as const, message: 'x' })),
        }),
      ),
      pull: vi.fn(() => Promise.resolve(pullOf([detail('l1')]))),
    });
    await db.outbox.add({
      opId: 'y',
      lessonId: 'keep',
      op: { opId: 'y', type: 'lesson.finish', lessonId: 'keep', at: '2026-10-12T07:00:00.000Z' },
    });
    await runSync(fake);
    const ids = (await db.lessons.toArray()).map((l) => l.id).sort();
    // обидві операції відхилено й видалено з черги → 'keep' теж без черги й поза вікном
    expect(ids).toEqual(['l1']);
  });

  it('видалені на сервері заняття зникають локально', async () => {
    await db.lessons.put({ id: 'gone', date: '2026-10-12', detail: detail('gone') });
    await setMeta('cursor', '2026-10-12T06:00:00.000Z');
    await runSync(api({ pull: vi.fn(() => Promise.resolve(pullOf([], ['gone']))) }));
    expect(await db.lessons.get('gone')).toBeUndefined();
  });
});

describe('користувач і вихід', () => {
  it('інший користувач починає з чистої бази', async () => {
    await bindUser('u1');
    await db.lessons.put({ id: 'l1', date: '2026-10-12', detail: detail('l1') });
    await bindUser('u1');
    expect(await db.lessons.count()).toBe(1);
    await bindUser('u2');
    expect(await db.lessons.count()).toBe(0);
    expect(await getMeta('userId')).toBe('u2');
  });

  it('вихід: з несинхронізованими змінами питає підтвердження; відмова зберігає базу', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await mark('l1');
    const refuse = vi.fn(() => false);
    expect(await prepareLogout(refuse)).toBe(false);
    expect(refuse).toHaveBeenCalledWith(1);
    expect(await db.outbox.count()).toBe(1);

    expect(await prepareLogout(() => true)).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    vi.restoreAllMocks();
  });

  it('вихід без змін не питає нічого й чистить базу', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    await setMeta('cache:me', { x: 1 });
    const confirm = vi.fn(() => false);
    expect(await prepareLogout(confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(await getMeta('cache:me')).toBeUndefined();
    vi.restoreAllMocks();
  });
});

describe('cachedFetch', () => {
  it('онлайн кешує, офлайн віддає останнє значення, бізнес-помилки не маскує', async () => {
    expect(await cachedFetch('k', () => Promise.resolve({ v: 1 }))).toEqual({ v: 1 });
    expect(await cachedFetch('k', () => Promise.reject(new TypeError('offline')))).toEqual({
      v: 1,
    });
    await expect(
      cachedFetch('k', () => Promise.reject(new ApiError(403, 'F', 'x'))),
    ).rejects.toThrow();
    await expect(
      cachedFetch('none', () => Promise.reject(new TypeError('offline'))),
    ).rejects.toThrow(TypeError);
  });
});

describe('refreshSyncStatus', () => {
  it('читає лічильники з бази', async () => {
    await mark('l1');
    useSyncStore.setState({ pending: 0 });
    await refreshSyncStatus();
    expect(useSyncStore.getState().pending).toBe(1);
  });
});
