import type { LoadDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import { hoursCsv, hoursRows, hoursTotals } from './model';

const load = (
  id: string,
  teacher: string,
  discipline: string,
  hours: Partial<LoadDto['hours']> = {},
  subgroup: string | null = null,
): LoadDto =>
  ({
    id,
    kind: 'LECTURE',
    teacher: { id: teacher, fullName: teacher },
    discipline: { id: discipline, title: discipline, shortTitle: discipline, color: '#000' },
    group: { id: 'g', name: 'ПДт-11' },
    subgroup: subgroup ? { id: 's', name: subgroup } : null,
    hours: { planned: 40, held: 10, forecast: 36, deficit: 4, extraPairsNeeded: 2, ...hours },
  }) as LoadDto;

describe('hoursRows', () => {
  it('сортує за викладачем, потім за дисципліною; підгрупа в назві групи', () => {
    const rows = hoursRows([
      load('1', 'Петренко', 'Фізика'),
      load('2', 'Іваненко', 'Хімія', {}, '1 підгрупа'),
      load('3', 'Іваненко', 'Алгебра'),
    ]);
    expect(rows.map((r) => r.loadId)).toEqual(['3', '2', '1']);
    expect(rows[1]?.group).toBe('ПДт-11 (1 підгрупа)');
  });
});

describe('hoursTotals', () => {
  it('підсумовує години', () => {
    const rows = hoursRows([load('1', 'А', 'Х'), load('2', 'Б', 'Х', { held: 20, deficit: 0 })]);
    expect(hoursTotals(rows)).toEqual({
      planned: 80,
      held: 30,
      forecast: 72,
      deficit: 4,
      extraPairs: 4,
    });
    expect(hoursTotals([])).toMatchObject({ planned: 0 });
  });
});

describe('hoursCsv', () => {
  it('екранує службові символи й починається з BOM', () => {
    const csv = hoursCsv(hoursRows([load('1', 'А "Б"', 'Х;Y')]), ['a', 'b'], () => 'Лекція');
    expect(csv.startsWith('\uFEFFa;b\r\n')).toBe(true);
    expect(csv).toContain('"А ""Б""";"Х;Y";ПДт-11;Лекція;40;10;36;4;2');
  });
});
