import type { LoadDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import { loadNav } from './loadNav';

const load = (
  id: string,
  discipline: string,
  group: string,
  kind: LoadDto['kind'],
  subgroup: string | null = null,
): LoadDto =>
  ({
    id,
    kind,
    discipline: {
      id: discipline,
      title: discipline.toUpperCase(),
      shortTitle: discipline,
      color: '#000',
    },
    group: { id: group, name: group },
    subgroup: subgroup ? { id: subgroup, name: subgroup } : null,
  }) as LoadDto;

const loads = [
  load('1', 'inf', 'ПДт-12', 'LECTURE'),
  load('2', 'inf', 'ПДт-12', 'LAB', '1 підгрупа'),
  load('3', 'inf', 'ПДт-12', 'LAB', '2 підгрупа'),
  load('4', 'inf', 'ПДт-11', 'LECTURE'),
  load('5', 'met', 'ПДт-13', 'LECTURE'),
  load('6', 'met', 'ПДт-12', 'PRACTICE'),
];

describe('loadNav', () => {
  it('невідоме навантаження — null', () => {
    expect(loadNav(loads, 'x')).toBeNull();
  });

  it('перелічує дисципліни, групи й варіанти поточної дисципліни та групи', () => {
    const nav = loadNav(loads, '1');
    expect(nav?.disciplines.map((d) => d.id)).toEqual(['inf', 'met']);
    expect(nav?.groups.map((g) => g.name)).toEqual(['ПДт-11', 'ПДт-12']);
    expect(nav?.variants.map((v) => v.id)).toEqual(['1', '2', '3']);
    expect(nav?.variants[1]).toMatchObject({ kind: 'LAB', subgroupName: '1 підгрупа' });
  });

  it('перехід на іншу дисципліну: та сама група, інакше перша за назвою', () => {
    expect(loadNav(loads, '1')?.forDiscipline('met')).toBe('6'); // група ПДт-12 є в «met»
    expect(loadNav(loads, '4')?.forDiscipline('met')).toBe('6'); // ПДт-11 немає → перша за назвою (ПДт-12)
    expect(loadNav(loads, '1')?.forDiscipline('nope')).toBeNull();
    // збігається вид: з лекції на лекцію тієї ж групи
    expect(
      loadNav([...loads, load('7', 'met', 'ПДт-12', 'LECTURE')], '1')?.forDiscipline('met'),
    ).toBe('7');
  });

  it('перехід на іншу групу: той самий вид, інакше перше навантаження', () => {
    expect(loadNav(loads, '1')?.forGroup('ПДт-11')).toBe('4');
    expect(loadNav(loads, '2')?.forGroup('ПДт-12')).toBe('2'); // вид і підгрупа збігаються
    expect(loadNav(loads, '4')?.forGroup('ПДт-12')).toBe('1');
    expect(loadNav(loads, '2')?.forGroup('ПДт-11')).toBe('4'); // лабораторних у групі немає
    expect(loadNav(loads, '1')?.forGroup('немає')).toBeNull();
  });
});
