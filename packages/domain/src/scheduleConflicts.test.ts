import { describe, expect, it } from 'vitest';

import { detectScheduleConflicts } from './scheduleConflicts.js';
import type { LoadInput, ScheduleSlotInput } from './types.js';

const load = (id: string, o: Partial<LoadInput> = {}): LoadInput => ({
  id,
  groupId: 'g1',
  subgroupId: null,
  teacherId: `t-${id}`,
  kind: 'LECTURE',
  plannedHours: 32,
  controlForm: 'EXAM',
  ...o,
});

const slot = (
  id: string,
  loadId: string,
  o: Partial<ScheduleSlotInput> = {},
): ScheduleSlotInput => ({
  id,
  loadId,
  weekday: 1,
  pairNumber: 1,
  parity: 'EVERY',
  roomId: null,
  validFrom: '2026-09-01',
  validTo: null,
  ...o,
});

const types = (c: ReturnType<typeof detectScheduleConflicts>) => c.map((x) => x.type).sort();

describe('detectScheduleConflicts', () => {
  it('без конфліктів на різних парах', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a'), slot('s2', 'b', { pairNumber: 2 })],
      [load('a'), load('b', { groupId: 'g2' })],
    );
    expect(c).toEqual([]);
  });

  it('слот з невідомим навантаженням ігнорується', () => {
    const c = detectScheduleConflicts([slot('s1', 'a'), slot('s2', 'ghost')], [load('a')]);
    expect(c).toEqual([]);
  });

  it('TEACHER_BUSY: той самий викладач у різних групах', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a'), slot('s2', 'b')],
      [load('a', { teacherId: 'x' }), load('b', { teacherId: 'x', groupId: 'g2' })],
    );
    expect(types(c)).toEqual(['TEACHER_BUSY']);
    expect(c[0]?.slotIds).toEqual(['s1', 's2']);
  });

  it('ROOM_BUSY: та сама аудиторія', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a', { roomId: 'r1' }), slot('s2', 'b', { roomId: 'r1' })],
      [load('a'), load('b', { groupId: 'g2' })],
    );
    expect(types(c)).toEqual(['ROOM_BUSY']);
  });

  it('аудиторія null не вважається спільною', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a'), slot('s2', 'b')],
      [load('a'), load('b', { groupId: 'g2' })],
    );
    expect(c).toEqual([]);
  });

  it('GROUP_BUSY: ця сама група', () => {
    const c = detectScheduleConflicts([slot('s1', 'a'), slot('s2', 'b')], [load('a'), load('b')]);
    expect(types(c)).toEqual(['GROUP_BUSY']);
  });

  it('TOP і BOTTOM в одній клітинці — не конфлікт', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a', { parity: 'TOP' }), slot('s2', 'b', { parity: 'BOTTOM' })],
      [load('a'), load('b')],
    );
    expect(c).toEqual([]);
  });

  it('EVERY + TOP — конфлікт', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a', { parity: 'EVERY' }), slot('s2', 'b', { parity: 'TOP' })],
      [load('a'), load('b')],
    );
    expect(types(c)).toEqual(['GROUP_BUSY']);
  });

  it('TOP + TOP — конфлікт', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a', { parity: 'TOP' }), slot('s2', 'b', { parity: 'TOP' })],
      [load('a'), load('b')],
    );
    expect(types(c)).toEqual(['GROUP_BUSY']);
  });

  it('різні підгрупи однієї групи в різних аудиторіях — не конфлікт', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a', { roomId: 'r1' }), slot('s2', 'b', { roomId: 'r2' })],
      [load('a', { subgroupId: 'sg1' }), load('b', { subgroupId: 'sg2' })],
    );
    expect(c).toEqual([]);
  });

  it('підгрупа + вся група — конфлікт', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a'), slot('s2', 'b')],
      [load('a', { subgroupId: 'sg1' }), load('b', { subgroupId: null })],
    );
    expect(types(c)).toEqual(['GROUP_BUSY']);
  });

  it('та сама підгрупа — конфлікт', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a'), slot('s2', 'b')],
      [load('a', { subgroupId: 'sg1' }), load('b', { subgroupId: 'sg1' })],
    );
    expect(types(c)).toEqual(['GROUP_BUSY']);
  });

  it('слоти з непересічними періодами дії — не конфлікт', () => {
    const c = detectScheduleConflicts(
      [
        slot('s1', 'a', { validFrom: '2026-09-01', validTo: '2026-10-31' }),
        slot('s2', 'b', { validFrom: '2026-11-01' }),
      ],
      [load('a'), load('b')],
    );
    expect(c).toEqual([]);
  });

  it('кілька типів конфліктів одночасно', () => {
    const c = detectScheduleConflicts(
      [slot('s1', 'a', { roomId: 'r1' }), slot('s2', 'b', { roomId: 'r1' })],
      [load('a', { teacherId: 'x' }), load('b', { teacherId: 'x' })],
    );
    expect(types(c)).toEqual(['GROUP_BUSY', 'ROOM_BUSY', 'TEACHER_BUSY']);
  });

  describe('HOURS_EXCEEDED', () => {
    it('не перевіряється без weeks', () => {
      expect(detectScheduleConflicts([slot('s1', 'a')], [load('a', { plannedHours: 2 })])).toEqual(
        [],
      );
    });

    it('щотижневий слот: 16 тижнів × 2 год = 32', () => {
      const ok = detectScheduleConflicts([slot('s1', 'a')], [load('a', { plannedHours: 32 })], {
        weeks: 16,
      });
      expect(ok).toEqual([]);
      const over = detectScheduleConflicts([slot('s1', 'a')], [load('a', { plannedHours: 30 })], {
        weeks: 16,
      });
      expect(types(over)).toEqual(['HOURS_EXCEEDED']);
    });

    it('верхній/нижній тиждень рахуються з округленням', () => {
      const loads = [load('a', { plannedHours: 16 })];
      // 15 тижнів: TOP = 8 пар = 16 год (ок), BOTTOM = 7 пар = 14 год
      expect(
        detectScheduleConflicts([slot('s1', 'a', { parity: 'TOP' })], loads, { weeks: 15 }),
      ).toEqual([]);
      expect(
        detectScheduleConflicts([slot('s1', 'a', { parity: 'BOTTOM' })], loads, { weeks: 15 }),
      ).toEqual([]);
      expect(
        detectScheduleConflicts(
          [slot('s1', 'a', { parity: 'TOP' })],
          [load('a', { plannedHours: 14 })],
          { weeks: 15 },
        ),
      ).toHaveLength(1);
    });

    it('сума слотів одного навантаження', () => {
      const slots = [slot('s1', 'a'), slot('s2', 'a', { weekday: 2 })];
      const c = detectScheduleConflicts(slots, [load('a', { plannedHours: 32 })], { weeks: 16 });
      expect(c[0]?.slotIds).toEqual(['s1', 's2']);
    });
  });
});
