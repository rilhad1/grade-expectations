import type { BellDto, LessonItemDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import { kyivMinutes, pairTime, pickCurrent } from './model';

const bells: BellDto[] = [
  { pairNumber: 1, startsAt: '08:30', endsAt: '09:50' },
  { pairNumber: 2, startsAt: '10:00', endsAt: '11:20' },
  { pairNumber: 3, startsAt: '11:40', endsAt: '13:00' },
];
const lesson = (pairNumber: number, status: LessonItemDto['status'] = 'PLANNED'): LessonItemDto =>
  ({ id: `l${pairNumber}`, pairNumber, status }) as LessonItemDto;

describe('pickCurrent', () => {
  const day = [lesson(2), lesson(3), lesson(1)];

  it('пара, що йде зараз, з прогресом часу', () => {
    const r = pickCurrent(day, bells, 10 * 60 + 40); // 10:40
    expect(r.state).toBe('ongoing');
    expect(r.lesson?.pairNumber).toBe(2);
    expect(r.progress).toBeCloseTo(40 / 80, 5);
  });
  it('між парами — наступна', () => {
    expect(pickCurrent(day, bells, 11 * 60 + 25)).toMatchObject({
      state: 'next',
      lesson: { pairNumber: 3 },
    });
  });
  it('до початку дня — перша пара; межі: початок входить, кінець — ні', () => {
    expect(pickCurrent(day, bells, 7 * 60).lesson?.pairNumber).toBe(1);
    expect(pickCurrent(day, bells, 10 * 60).state).toBe('ongoing');
    expect(pickCurrent(day, bells, 11 * 60 + 20).state).toBe('next');
  });
  it('після останньої пари — нічого', () => {
    expect(pickCurrent(day, bells, 14 * 60)).toEqual({ state: 'none', lesson: null, progress: 0 });
  });
  it('скасовані й перенесені ігноруються', () => {
    const r = pickCurrent([lesson(2, 'CANCELLED'), lesson(3, 'MOVED')], bells, 10 * 60 + 30);
    expect(r.state).toBe('none');
  });
  it('пара без розкладу дзвінків пропускається', () => {
    expect(pickCurrent([lesson(9)], bells, 10 * 60).state).toBe('none');
  });
});

describe('допоміжні', () => {
  it('час за Києвом', () => {
    expect(kyivMinutes(new Date('2026-10-12T09:15:00Z'))).toBe(12 * 60 + 15); // UTC+3
  });
  it('підпис часу пари', () => {
    expect(pairTime(bells, 2)).toBe('10:00–11:20');
    expect(pairTime(bells, 7)).toBe('');
  });
});
