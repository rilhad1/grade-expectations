import type { IsoDate } from '@ge/shared';

/** Зайнятий слот: що вже стоїть у календарі на дату й пару. */
export interface BusySlot {
  date: IsoDate;
  pairNumber: number;
  teacherId: string;
  groupId: string;
  subgroupId: string | null;
  roomId: string | null;
}

export interface FreeSlot {
  date: IsoDate;
  pairNumber: number;
  /** Аудиторії, вільні на цей час. */
  freeRoomIds: string[];
}

export interface FreeSlotQuery {
  /** Кандидати: навчальні дати, у які можна ставити пари. */
  dates: readonly IsoDate[];
  pairNumbers: readonly number[];
  roomIds: readonly string[];
  busy: readonly BusySlot[];
  /** Заняття, яке переносимо: його викладач і група мають бути вільні. */
  lesson: { teacherId: string; groupId: string; subgroupId: string | null };
}

/** Підгрупа + вся група перетинаються; різні підгрупи — ні. */
const groupsOverlap = (
  a: { groupId: string; subgroupId: string | null },
  b: { groupId: string; subgroupId: string | null },
): boolean =>
  a.groupId === b.groupId &&
  (a.subgroupId === null || b.subgroupId === null || a.subgroupId === b.subgroupId);

/**
 * Слоти, де одночасно вільні викладач і група (підгрупа), та вказані вільні аудиторії.
 * Слот без жодної вільної аудиторії теж повертається (якщо аудиторій у коледжі немає, список порожній
 * і це не заважає): аудиторію деканат обирає окремо.
 */
export function findFreeSlots(query: FreeSlotQuery): FreeSlot[] {
  const free: FreeSlot[] = [];
  for (const date of query.dates) {
    for (const pairNumber of query.pairNumbers) {
      const here = query.busy.filter((b) => b.date === date && b.pairNumber === pairNumber);
      const teacherBusy = here.some((b) => b.teacherId === query.lesson.teacherId);
      const groupBusy = here.some((b) => groupsOverlap(b, query.lesson));
      if (teacherBusy || groupBusy) continue;

      const usedRooms = new Set(here.flatMap((b) => (b.roomId === null ? [] : [b.roomId])));
      free.push({ date, pairNumber, freeRoomIds: query.roomIds.filter((r) => !usedRooms.has(r)) });
    }
  }
  return free;
}
