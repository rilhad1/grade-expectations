import type { LoadDto, SlotDto } from '@ge/shared';
import { describe, expect, it } from 'vitest';

import {
  loadCaption,
  loadsForView,
  scheduledHoursByLoad,
  slotsForView,
  slotsInCell,
  unplacedLoads,
  weeksBetween,
} from './model';

const semester = {
  startDate: '2026-09-01',
  endDate: '2026-12-28',
  firstWeekParity: 'TOP' as const,
  parityAfterBreak: 'CONTINUE' as const,
  periods: [{ kind: 'HOLIDAY' as const, startDate: '2026-10-26', endDate: '2026-11-01' }],
};

const load = (id: string, o: Partial<LoadDto> = {}): LoadDto => ({
  id,
  semesterId: 's',
  kind: 'LECTURE',
  plannedHours: 32,
  controlForm: 'EXAM',
  gradingRules: {
    scale: 'TWELVE',
    weights: {},
    minGrades: 3,
    maxUnexcusedAbsencePercent: 50,
    rounding: 'HALF_UP',
    missedTest: 'IGNORE',
  },
  discipline: { id: 'd', title: 'Інформатика', shortTitle: 'Інформ.', color: '#000000' },
  group: { id: 'g1', name: 'ПДт-12' },
  subgroup: null,
  teacher: { id: 't1', fullName: 'Бойчук В.В.' },
  hours: { planned: 32, held: 0, forecast: 0, deficit: 32, extraPairsNeeded: 16 },
  version: 0,
  ...o,
});

const slot = (id: string, loadId: string, o: Partial<SlotDto> = {}): SlotDto => ({
  id,
  scheduleId: 'sc',
  loadId,
  weekday: 1,
  pairNumber: 2,
  parity: 'EVERY',
  roomId: null,
  validFrom: '2026-09-01',
  validTo: null,
  version: 0,
  ...o,
});

describe('scheduledHoursByLoad', () => {
  it('щотижневий понеділок: 16 пар × 2 год (канікули виключені)', () => {
    expect(scheduledHoursByLoad(semester, [slot('s1', 'a')]).get('a')).toBe(32);
  });
  it('верхній тиждень дає менше годин', () => {
    expect(
      scheduledHoursByLoad(semester, [slot('s1', 'a', { parity: 'TOP' })]).get('a'),
    ).toBeLessThan(20);
  });
  it('без слотів порожньо', () => {
    expect(scheduledHoursByLoad(semester, []).size).toBe(0);
  });
});

describe('unplacedLoads', () => {
  it('нерозставлене навантаження повертається з нестачею годин', () => {
    const r = unplacedLoads([load('a')], [], semester, 17);
    expect(r).toHaveLength(1);
    expect(r[0]?.missingHours).toBe(32);
    expect(r[0]?.pairsPerWeek).toBe(1);
  });
  it('повністю розставлене зникає, часткове лишається', () => {
    expect(unplacedLoads([load('a')], [slot('s1', 'a')], semester, 17)).toEqual([]);
    const partial = unplacedLoads([load('a')], [slot('s1', 'a', { parity: 'TOP' })], semester, 17);
    expect(partial[0]?.missingHours).toBeGreaterThan(10);
  });
});

describe('вигляди', () => {
  const loads = [
    load('a'),
    load('b', { group: { id: 'g2', name: 'ПДт-13' }, teacher: { id: 't2', fullName: 'Інший' } }),
  ];
  const byId = new Map(loads.map((l) => [l.id, l]));
  const slots = [slot('s1', 'a', { roomId: 'r1' }), slot('s2', 'b', { roomId: 'r2' })];

  it('за групою', () => {
    expect(slotsForView('group', 'g1', slots, byId).map((s) => s.id)).toEqual(['s1']);
    expect(loadsForView('group', 'g2', loads).map((l) => l.id)).toEqual(['b']);
  });
  it('за викладачем', () => {
    expect(slotsForView('teacher', 't2', slots, byId).map((s) => s.id)).toEqual(['s2']);
    expect(loadsForView('teacher', 't1', loads).map((l) => l.id)).toEqual(['a']);
  });
  it('за аудиторією: лівої панелі немає', () => {
    expect(slotsForView('room', 'r1', slots, byId).map((s) => s.id)).toEqual(['s1']);
    expect(loadsForView('room', 'r1', loads)).toEqual([]);
  });
  it('слот з невідомим навантаженням ігнорується', () => {
    expect(slotsForView('group', 'g1', [slot('x', 'ghost')], byId)).toEqual([]);
  });
});

describe('допоміжні', () => {
  it('слоти клітинки: спершу щотижня, потім верхній і нижній', () => {
    const cell = slotsInCell(
      [
        slot('b', 'a', { parity: 'BOTTOM' }),
        slot('t', 'a', { parity: 'TOP' }),
        slot('e', 'a'),
        slot('o', 'a', { weekday: 2 }),
      ],
      1,
      2,
    );
    expect(cell.map((s) => s.id)).toEqual(['e', 't', 'b']);
  });
  it('підпис навантаження', () => {
    expect(loadCaption(load('a'))).toBe('Інформ. · ПДт-12');
    expect(loadCaption(load('a', { subgroup: { id: 's', name: '2 підгрупа' } }))).toBe(
      'Інформ. · ПДт-12 · 2 підгрупа',
    );
  });
  it('кількість тижнів семестру', () => {
    expect(weeksBetween('2026-09-01', '2026-12-28')).toBe(17);
    expect(weeksBetween('2026-09-01', '2026-09-01')).toBe(1);
  });
});
