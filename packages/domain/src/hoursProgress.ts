import type { IsoDate, LessonStatus } from '@ge/shared';

export interface HoursLesson {
  status: LessonStatus;
  date: IsoDate;
  hours: number;
}

export interface HoursProgress {
  planned: number;
  /** Факт: сума годин проведених занять. */
  held: number;
  /** Прогноз: факт + заплановані заняття від сьогодні. */
  forecast: number;
  /** Нестача годин у прогнозі відносно плану. */
  deficit: number;
  /** Скільки додаткових пар потрібно, щоб закрити нестачу. */
  extraPairsNeeded: number;
}

export function hoursProgress(
  load: { plannedHours: number },
  lessons: readonly HoursLesson[],
  today: IsoDate,
  hoursPerPair = 2,
): HoursProgress {
  const held = lessons.filter((l) => l.status === 'HELD').reduce((s, l) => s + l.hours, 0);
  const upcoming = lessons
    .filter((l) => l.status === 'PLANNED' && l.date >= today)
    .reduce((s, l) => s + l.hours, 0);
  const forecast = held + upcoming;
  const deficit = Math.max(0, load.plannedHours - forecast);
  return {
    planned: load.plannedHours,
    held,
    forecast,
    deficit,
    extraPairsNeeded: Math.ceil(deficit / hoursPerPair),
  };
}
