import type { LoadDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import { journalsOf, loadNav } from './loadNav';

const load = (
  id: string,
  discipline: string,
  group: string,
  kind: LoadDto['kind'],
  subgroup: string | null = null,
  hours = { held: 2, planned: 10 },
): LoadDto =>
  ({
    id,
    kind,
    plannedHours: hours.planned,
    hours: { held: hours.held },
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
  load('1p', 'inf', 'ПДт-12', 'PRACTICE'),
  load('2', 'inf', 'ПДт-12', 'LAB', '1 підгрупа'),
  load('3', 'inf', 'ПДт-12', 'LAB', '2 підгрупа'),
  load('4', 'inf', 'ПДт-11', 'LECTURE'),
  load('5', 'met', 'ПДт-13', 'LECTURE'),
  load('6', 'met', 'ПДт-12', 'PRACTICE'),
];

describe('journalsOf', () => {
  it('один журнал на дисципліну, групу й підгрупу; види занять зведені', () => {
    const journals = journalsOf(loads);
    const whole = journals.find(
      (j) => j.group.id === 'ПДт-12' && j.discipline.id === 'inf' && !j.subgroup,
    );
    // Лекція й практична — один журнал; основне навантаження — практична
    expect(whole).toMatchObject({
      primaryId: '1p',
      kinds: ['LECTURE', 'PRACTICE'],
      held: 4,
      planned: 20,
    });
    expect(journals).toHaveLength(6); // inf: ПДт-11, ПДт-12, 2 підгрупи; met: ПДт-12, ПДт-13
  });

  it('сортує за дисципліною, групою, підгрупою', () => {
    expect(
      journalsOf(loads).map((j) => `${j.discipline.id}:${j.group.name}:${j.subgroup?.name ?? ''}`),
    ).toEqual([
      'inf:ПДт-11:',
      'inf:ПДт-12:',
      'inf:ПДт-12:1 підгрупа',
      'inf:ПДт-12:2 підгрупа',
      'met:ПДт-12:',
      'met:ПДт-13:',
    ]);
  });
});

describe('loadNav', () => {
  it('невідоме навантаження — null', () => {
    expect(loadNav(loads, 'x')).toBeNull();
  });

  it('перелічує дисципліни, групи й підгрупи поточної дисципліни та групи', () => {
    const nav = loadNav(loads, '1');
    expect(nav?.disciplines.map((d) => d.id)).toEqual(['inf', 'met']);
    expect(nav?.groups.map((g) => g.name)).toEqual(['ПДт-11', 'ПДт-12']);
    expect(nav?.subgroups).toEqual([
      { id: null, name: null },
      { id: '1 підгрупа', name: '1 підгрупа' },
      { id: '2 підгрупа', name: '2 підгрупа' },
    ]);
  });

  it('перехід на іншу дисципліну: та сама група, інакше перша за назвою; веде в основне навантаження', () => {
    expect(loadNav(loads, '1')?.forDiscipline('met')).toBe('6'); // група ПДт-12 є в «met»
    expect(loadNav(loads, '4')?.forDiscipline('met')).toBe('6'); // ПДт-11 немає → перша за назвою (ПДт-12)
    expect(loadNav(loads, '1')?.forDiscipline('inf')).toBe('1p');
    expect(loadNav(loads, '1')?.forDiscipline('nope')).toBeNull();
  });

  it('перехід на іншу групу: уся група, інакше перша підгрупа', () => {
    expect(loadNav(loads, '1')?.forGroup('ПДт-11')).toBe('4');
    expect(loadNav(loads, '4')?.forGroup('ПДт-12')).toBe('1p');
    expect(loadNav(loads, '1')?.forGroup('немає')).toBeNull();
  });

  it('перехід на підгрупу', () => {
    const nav = loadNav(loads, '1p');
    expect(nav?.forSubgroup('1 підгрупа')).toBe('2');
    expect(nav?.forSubgroup(null)).toBe('1p');
    expect(nav?.forSubgroup('3 підгрупа')).toBeNull();
  });
});
