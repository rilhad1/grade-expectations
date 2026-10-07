import type { IsoDate, SlotParity } from '@ge/shared';

import type { LoadInput, ScheduleSlotInput } from './types.js';

export type ConflictType = 'TEACHER_BUSY' | 'ROOM_BUSY' | 'GROUP_BUSY' | 'HOURS_EXCEEDED';

export interface ScheduleConflict {
  type: ConflictType;
  slotIds: string[];
  loadIds: string[];
  message: string;
}

export interface ConflictOptions {
  /** Кількість тижнів у семестрі: потрібна для перевірки HOURS_EXCEEDED. */
  weeks?: number;
  /** Годин в одній парі (за замовчуванням 2). */
  hoursPerPair?: number;
}

const parityOverlaps = (a: SlotParity, b: SlotParity): boolean =>
  a === 'EVERY' || b === 'EVERY' || a === b;

const rangeOverlaps = (a: ScheduleSlotInput, b: ScheduleSlotInput): boolean => {
  const aEnd: IsoDate = a.validTo ?? '9999-12-31';
  const bEnd: IsoDate = b.validTo ?? '9999-12-31';
  return a.validFrom <= bEnd && b.validFrom <= aEnd;
};

/** Підгрупа + вся група — конфлікт; різні підгрупи однієї групи — ні. */
const groupsOverlap = (a: LoadInput, b: LoadInput): boolean => {
  if (a.groupId !== b.groupId) return false;
  if (a.subgroupId === null || b.subgroupId === null) return true;
  return a.subgroupId === b.subgroupId;
};

/** Кількість пар на семестр для слота (верхній тиждень — ceil, нижній — floor). */
const pairsPerSemester = (parity: SlotParity, weeks: number): number => {
  if (parity === 'EVERY') return weeks;
  return parity === 'TOP' ? Math.ceil(weeks / 2) : Math.floor(weeks / 2);
};

/** Знаходить конфлікти розкладу: викладач, аудиторія, група, перевищення годин. */
export function detectScheduleConflicts(
  slots: readonly ScheduleSlotInput[],
  loads: readonly LoadInput[],
  options: ConflictOptions = {},
): ScheduleConflict[] {
  const loadById = new Map(loads.map((l) => [l.id, l]));
  const conflicts: ScheduleConflict[] = [];

  for (const [i, a] of slots.entries()) {
    for (const b of slots.slice(i + 1)) {
      if (a.weekday !== b.weekday || a.pairNumber !== b.pairNumber) continue;
      if (!parityOverlaps(a.parity, b.parity) || !rangeOverlaps(a, b)) continue;

      const la = loadById.get(a.loadId);
      const lb = loadById.get(b.loadId);
      if (!la || !lb) continue;

      const where = `день ${a.weekday}, пара ${a.pairNumber}`;
      const pair = { slotIds: [a.id, b.id], loadIds: [la.id, lb.id] };
      // Одна пара потоку для кількох груп: викладач і аудиторія в неї спільні, це не конфлікт
      const sameStream = la.streamId != null && la.streamId === lb.streamId;

      if (la.teacherId === lb.teacherId && !sameStream) {
        conflicts.push({
          type: 'TEACHER_BUSY',
          ...pair,
          message: `Викладач уже зайнятий (${where})`,
        });
      }
      if (a.roomId !== null && a.roomId === b.roomId && !sameStream) {
        conflicts.push({ type: 'ROOM_BUSY', ...pair, message: `Аудиторія зайнята (${where})` });
      }
      if (groupsOverlap(la, lb)) {
        conflicts.push({
          type: 'GROUP_BUSY',
          ...pair,
          message: `У групи дві пари одночасно (${where})`,
        });
      }
    }
  }

  const { weeks, hoursPerPair = 2 } = options;
  if (weeks !== undefined) {
    for (const load of loads) {
      const own = slots.filter((s) => s.loadId === load.id);
      const scheduled = own.reduce(
        (sum, s) => sum + pairsPerSemester(s.parity, weeks) * hoursPerPair,
        0,
      );
      if (scheduled > load.plannedHours) {
        conflicts.push({
          type: 'HOURS_EXCEEDED',
          slotIds: own.map((s) => s.id),
          loadIds: [load.id],
          message: `У розкладі ${scheduled} год, а за навантаженням ${load.plannedHours} год`,
        });
      }
    }
  }

  return conflicts;
}
