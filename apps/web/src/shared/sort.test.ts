import { describe, expect, it } from 'vitest';

import { compareGroups, sectionsByCourse, sortByCourseDisciplineGroup } from './sort';

const item = (course: number | undefined, discipline: string, group: string, sub?: string) => ({
  discipline: { title: discipline },
  group: { name: group, ...(course !== undefined && { course }) },
  subgroup: sub ? { name: sub } : null,
});
const label = (x: ReturnType<typeof item>) =>
  `${String(x.group.course)}|${x.discipline.title}|${x.group.name}|${x.subgroup?.name ?? ''}`;

describe('сортування за замовчуванням: курс → предмет → група', () => {
  it('спершу курс, потім предмет, потім група; підгрупи за назвою', () => {
    const sorted = sortByCourseDisciplineGroup([
      item(3, 'Метрологія', 'КІт-32'),
      item(1, 'Інформатика', 'ПДт-12'),
      item(3, 'Метрологія', 'КІт-31'),
      item(1, 'Інформатика', 'АТт-11'),
      item(2, 'Інформатика', 'АТТт-21'),
      item(1, 'Інформатика', 'ПДт-12', '2 підгрупа'),
      item(1, 'Інформатика', 'ПДт-12', '1 підгрупа'),
    ]);
    expect(sorted.map(label)).toEqual([
      '1|Інформатика|АТт-11|',
      '1|Інформатика|ПДт-12|',
      '1|Інформатика|ПДт-12|1 підгрупа',
      '1|Інформатика|ПДт-12|2 підгрупа',
      '2|Інформатика|АТТт-21|',
      '3|Метрологія|КІт-31|',
      '3|Метрологія|КІт-32|',
    ]);
  });

  it('числа в назвах групи порівнюються як числа; невідомий курс — наприкінці; вхід не змінюється', () => {
    const input = [item(undefined, 'А', 'Я-1'), item(1, 'А', 'ПДт-11'), item(1, 'А', 'ПДт-2')];
    const sorted = sortByCourseDisciplineGroup(input);
    expect(sorted.map((x) => x.group.name)).toEqual(['ПДт-2', 'ПДт-11', 'Я-1']);
    expect(input[0]?.group.name).toBe('Я-1');
  });

  it('групи: за курсом, потім за назвою', () => {
    const groups = [
      { name: 'КІт-31', course: 3 },
      { name: 'ПДт-11', course: 1 },
      { name: 'АТт-31', course: 3 },
    ];
    expect([...groups].sort(compareGroups).map((g) => g.name)).toEqual([
      'ПДт-11',
      'АТт-31',
      'КІт-31',
    ]);
  });

  it('секції за курсом для заголовків', () => {
    const sections = sectionsByCourse(
      sortByCourseDisciplineGroup([item(2, 'А', 'Г1'), item(1, 'А', 'Г2'), item(1, 'Б', 'Г3')]),
    );
    expect(sections.map((s) => [s.course, s.items.length])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });
});
