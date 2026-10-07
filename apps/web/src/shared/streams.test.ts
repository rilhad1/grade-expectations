import { describe, expect, it } from 'vitest';

import { compressGroupNames, mergeStreamLessons } from './streams';

const lesson = (id: string, group: string, streamId: string | null, marked = 0, total = 10) => ({
  id,
  streamId,
  date: '2026-10-12',
  pairNumber: 5,
  group: { id: `g-${group}`, name: group },
  marked,
  total,
});

describe('compressGroupNames', () => {
  it('спільний префікс до дефіса не повторюється', () => {
    expect(compressGroupNames(['КІт-31', 'КІт-32', 'КІт-33'])).toBe('КІт-31, 32, 33');
  });
  it('різні префікси та одна група виводяться повністю', () => {
    expect(compressGroupNames(['КІт-31', 'ПДт-11'])).toBe('КІт-31, ПДт-11');
    expect(compressGroupNames(['КІт-31'])).toBe('КІт-31');
    expect(compressGroupNames(['Група А', 'Група Б'])).toBe('Група А, Група Б');
  });
});

describe('mergeStreamLessons', () => {
  it('зливає пари потоку в одну картку: групи, відмітки й склад сумуються', () => {
    const merged = mergeStreamLessons([
      lesson('b', 'КІт-32', 's1', 3, 20),
      lesson('a', 'КІт-31', 's1', 5, 28),
      lesson('x', 'ПДт-11', null),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: 'b',
      streamLessonIds: ['b', 'a'],
      marked: 8,
      total: 48,
      group: { name: 'КІт-31, 32' },
    });
    expect(merged[1]?.streamLessonIds).toEqual(['x']);
  });

  it('різні пари чи потоки не зливаються; порядок зберігається', () => {
    const other = { ...lesson('c', 'КІт-33', 's1'), pairNumber: 6 };
    const merged = mergeStreamLessons([
      lesson('a', 'КІт-31', 's1'),
      other,
      lesson('d', 'КІт-34', 's2'),
    ]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'c', 'd']);
  });
});
