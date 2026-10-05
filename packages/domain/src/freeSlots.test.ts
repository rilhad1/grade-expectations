import { describe, expect, it } from 'vitest';

import { findFreeSlots, type BusySlot, type FreeSlotQuery } from './freeSlots.js';

const lesson: FreeSlotQuery['lesson'] = { teacherId: 't1', groupId: 'g1', subgroupId: null };
const busy = (over: Partial<BusySlot>): BusySlot => ({
  date: '2026-10-12',
  pairNumber: 1,
  teacherId: 'tx',
  groupId: 'gx',
  subgroupId: null,
  roomId: null,
  ...over,
});
const query = (b: BusySlot[], l = lesson) => ({
  dates: ['2026-10-12'],
  pairNumbers: [1, 2],
  roomIds: ['r1', 'r2'],
  busy: b,
  lesson: l,
});

describe('findFreeSlots', () => {
  it('усе вільне: всі пари з усіма аудиторіями', () => {
    expect(findFreeSlots(query([]))).toEqual([
      { date: '2026-10-12', pairNumber: 1, freeRoomIds: ['r1', 'r2'] },
      { date: '2026-10-12', pairNumber: 2, freeRoomIds: ['r1', 'r2'] },
    ]);
  });

  it('виключає пару, коли зайнятий викладач', () => {
    const r = findFreeSlots(query([busy({ teacherId: 't1' })]));
    expect(r.map((s) => s.pairNumber)).toEqual([2]);
  });

  it('виключає пару, коли зайнята група', () => {
    const r = findFreeSlots(query([busy({ groupId: 'g1' })]));
    expect(r.map((s) => s.pairNumber)).toEqual([2]);
  });

  it('аудиторія, зайнята іншими, зникає зі списку, але слот лишається', () => {
    const r = findFreeSlots(query([busy({ roomId: 'r1' })]));
    expect(r[0]).toEqual({ date: '2026-10-12', pairNumber: 1, freeRoomIds: ['r2'] });
  });

  it('підгрупи: інша підгрупа не заважає, вся група — заважає', () => {
    const sub = { teacherId: 't1', groupId: 'g1', subgroupId: 's1' };
    expect(
      findFreeSlots(query([busy({ groupId: 'g1', subgroupId: 's2' })], sub)).map(
        (s) => s.pairNumber,
      ),
    ).toEqual([1, 2]);
    expect(
      findFreeSlots(query([busy({ groupId: 'g1', subgroupId: 's1' })], sub)).map(
        (s) => s.pairNumber,
      ),
    ).toEqual([2]);
    expect(
      findFreeSlots(query([busy({ groupId: 'g1', subgroupId: null })], sub)).map(
        (s) => s.pairNumber,
      ),
    ).toEqual([2]);
    expect(
      findFreeSlots(query([busy({ groupId: 'g1', subgroupId: 's1' })])).map((s) => s.pairNumber),
    ).toEqual([2]);
  });

  it('інша дата не впливає', () => {
    const r = findFreeSlots(query([busy({ date: '2026-10-13', teacherId: 't1' })]));
    expect(r).toHaveLength(2);
  });

  it('без аудиторій слот усе одно вільний', () => {
    const r = findFreeSlots({ ...query([]), roomIds: [] });
    expect(r.every((s) => s.freeRoomIds.length === 0)).toBe(true);
    expect(r).toHaveLength(2);
  });
});
