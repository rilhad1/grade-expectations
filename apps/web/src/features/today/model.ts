import type { BellDto, LessonItemDto } from '@ge/shared';

export type CurrentState = 'ongoing' | 'next' | 'none';

export interface CurrentLesson {
  state: CurrentState;
  lesson: LessonItemDto | null;
  /** Частка пройденого часу пари (0..1) для ongoing. */
  progress: number;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

/** Хвилини від початку доби за київським часом. */
export function kyivMinutes(now: Date): number {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return toMinutes(parts);
}

/**
 * Поточна пара дня: та, що йде зараз; інакше найближча наступна; інакше — немає.
 * Скасовані й перенесені заняття не враховуються.
 */
export function pickCurrent(
  lessons: readonly LessonItemDto[],
  bells: readonly BellDto[],
  minutes: number,
): CurrentLesson {
  const active = lessons
    .filter((l) => l.status !== 'CANCELLED' && l.status !== 'MOVED')
    .sort((a, b) => a.pairNumber - b.pairNumber);
  const times = (pair: number) => {
    const bell = bells.find((b) => b.pairNumber === pair);
    return bell ? { start: toMinutes(bell.startsAt), end: toMinutes(bell.endsAt) } : null;
  };

  for (const lesson of active) {
    const t = times(lesson.pairNumber);
    if (t && minutes >= t.start && minutes < t.end) {
      return { state: 'ongoing', lesson, progress: (minutes - t.start) / (t.end - t.start) };
    }
  }
  const next = active.find((l) => {
    const t = times(l.pairNumber);
    return t !== null && t.start > minutes;
  });
  if (next) return { state: 'next', lesson: next, progress: 0 };
  return { state: 'none', lesson: null, progress: 0 };
}

/** «10:00–11:20» */
export function pairTime(bells: readonly BellDto[], pair: number): string {
  const bell = bells.find((b) => b.pairNumber === pair);
  return bell ? `${bell.startsAt}–${bell.endsAt}` : '';
}
