import { generateLessons, type SemesterInput } from '@ge/domain';
import type { LoadDto, SlotDto } from '@ge/shared';

export type BuilderView = 'group' | 'teacher' | 'room';
export type SlotParityValue = 'EVERY' | 'TOP' | 'BOTTOM';

const PAIR_HOURS = 2;

/** Години, які дають слоти за навантаженням: з реального календаря семестру (канікули, парність). */
export function scheduledHoursByLoad(
  semester: SemesterInput,
  slots: readonly SlotDto[],
): Map<string, number> {
  const { create } = generateLessons(
    semester,
    {
      version: 0,
      slots: slots.map((s) => ({
        id: s.id,
        loadId: s.loadId,
        weekday: s.weekday,
        pairNumber: s.pairNumber,
        parity: s.parity,
        roomId: s.roomId,
        validFrom: s.validFrom,
        validTo: s.validTo,
      })),
    },
    [],
  );
  const hours = new Map<string, number>();
  for (const lesson of create)
    hours.set(lesson.loadId, (hours.get(lesson.loadId) ?? 0) + PAIR_HOURS);
  return hours;
}

export interface UnplacedLoad {
  load: LoadDto;
  /** Скільки годин ще не розставлено. */
  missingHours: number;
  /** Орієнтовно пар на тиждень (для підпису картки). */
  pairsPerWeek: number;
}

/** Навантаження, для якого розставлено менше годин, ніж за планом. */
export function unplacedLoads(
  loads: readonly LoadDto[],
  slots: readonly SlotDto[],
  semester: SemesterInput,
  weeks: number,
): UnplacedLoad[] {
  const placed = scheduledHoursByLoad(semester, slots);
  return loads.flatMap((load) => {
    const missing = load.plannedHours - (placed.get(load.id) ?? 0);
    if (missing <= 0) return [];
    return [
      {
        load,
        missingHours: missing,
        pairsPerWeek: Math.max(1, Math.round(load.plannedHours / PAIR_HOURS / Math.max(1, weeks))),
      },
    ];
  });
}

/** Кількість тижнів семестру (для підпису «N пар/тиж»). */
export function weeksBetween(startDate: string, endDate: string): number {
  const ms = Date.parse(endDate) - Date.parse(startDate);
  return Math.max(1, Math.ceil((ms / 86_400_000 + 1) / 7));
}

/** Слоти, що належать вибраному вигляду. */
export function slotsForView(
  view: BuilderView,
  id: string,
  slots: readonly SlotDto[],
  loadsById: ReadonlyMap<string, LoadDto>,
): SlotDto[] {
  return slots.filter((s) => {
    const load = loadsById.get(s.loadId);
    if (!load) return false;
    if (view === 'group') return load.group.id === id;
    if (view === 'teacher') return load.teacher.id === id;
    return s.roomId === id;
  });
}

/** Навантаження для вибраного вигляду (для аудиторії лівої панелі немає). */
export function loadsForView(view: BuilderView, id: string, loads: readonly LoadDto[]): LoadDto[] {
  if (view === 'group') return loads.filter((l) => l.group.id === id);
  if (view === 'teacher') return loads.filter((l) => l.teacher.id === id);
  return [];
}

/** Слоти клітинки (день + пара), впорядковані за парністю. */
export function slotsInCell(
  slots: readonly SlotDto[],
  weekday: number,
  pairNumber: number,
): SlotDto[] {
  const order = { EVERY: 0, TOP: 1, BOTTOM: 2 } as const;
  return slots
    .filter((s) => s.weekday === weekday && s.pairNumber === pairNumber)
    .sort((a, b) => order[a.parity] - order[b.parity]);
}

/** Підпис навантаження на картці: «Інформ. · ПДт-12 · 2 підгр.» */
export function loadCaption(load: LoadDto): string {
  return [load.discipline.shortTitle, load.group.name, load.subgroup?.name]
    .filter(Boolean)
    .join(' · ');
}
