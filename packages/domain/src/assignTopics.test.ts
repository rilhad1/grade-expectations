import { describe, expect, it } from 'vitest';

import { assignTopics } from './assignTopics.js';

const lessons = (n: number, hours = 2) =>
  Array.from({ length: n }, (_, i) => ({ id: `l${i + 1}`, hours }));

describe('assignTopics', () => {
  it('призначає теми по черзі', () => {
    const result = assignTopics(lessons(3), [
      { id: 't1', hours: 2 },
      { id: 't2', hours: 2 },
      { id: 't3', hours: 2 },
    ]);
    expect(result.map((r) => r.topicId)).toEqual(['t1', 't2', 't3']);
  });

  it('тема на 4 години займає два заняття', () => {
    const result = assignTopics(lessons(3), [
      { id: 't1', hours: 4 },
      { id: 't2', hours: 2 },
    ]);
    expect(result.map((r) => r.topicId)).toEqual(['t1', 't1', 't2']);
  });

  it('заняття понад план лишаються без теми', () => {
    const result = assignTopics(lessons(3), [{ id: 't1', hours: 2 }]);
    expect(result.map((r) => r.topicId)).toEqual(['t1', null, null]);
  });

  it('пропускає теми без годин', () => {
    const result = assignTopics(lessons(2), [
      { id: 't0', hours: 0 },
      { id: 't1', hours: 2 },
      { id: 't2', hours: 2 },
    ]);
    expect(result.map((r) => r.topicId)).toEqual(['t1', 't2']);
  });

  it('порожні вхідні дані', () => {
    expect(assignTopics([], [{ id: 't1', hours: 2 }])).toEqual([]);
    expect(assignTopics(lessons(1), [])).toEqual([{ lessonId: 'l1', topicId: null }]);
  });

  it('тема на 3 години при парах по 2 год: друге заняття завершує тему', () => {
    const result = assignTopics(lessons(3), [
      { id: 't1', hours: 3 },
      { id: 't2', hours: 2 },
    ]);
    expect(result.map((r) => r.topicId)).toEqual(['t1', 't1', 't2']);
  });
});
