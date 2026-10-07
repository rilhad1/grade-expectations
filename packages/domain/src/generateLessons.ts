import type { IsoDate } from '@ge/shared';

import { eachDay, isoWeekday } from './dates.js';
import { teachingDays } from './teachingDays.js';
import type { ExistingLesson, GeneratedLesson, ScheduleSlotInput, SemesterInput } from './types.js';
import { weekParity } from './weekParity.js';

export interface GenerateLessonsResult {
  /** Нові заняття, яких ще немає. */
  create: GeneratedLesson[];
  /** id наявних занять, що залишаються без змін. */
  keep: string[];
  /** id майбутніх запланованих занять без відміток, яких більше немає в розкладі. */
  cancel: string[];
}

export interface GenerateLessonsOptions {
  /** Поточна дата: минуле не створюється і не скасовується. Без неї обробляється весь семестр. */
  today?: IsoDate;
  /** Курс групи кожного навантаження: сесія й практика одного курсу не блокують інші. */
  loadCourses?: ReadonlyMap<string, number>;
}

/** Детермінований ключ заняття: повторний запуск нічого не дублює. */
export const lessonKey = (loadId: string, date: IsoDate, pairNumber: number): string =>
  `${loadId}|${date}|${pairNumber}`;

/**
 * Генерує заняття з опублікованого розкладу й календаря семестру.
 * Проведені, відмічені й змінені вручну заняття ніколи не скасовуються.
 */
export function generateLessons(
  semester: SemesterInput,
  schedule: { version: number; slots: readonly ScheduleSlotInput[] },
  existing: readonly ExistingLesson[],
  options: GenerateLessonsOptions = {},
): GenerateLessonsResult {
  const { today, loadCourses } = options;
  const wanted = new Map<string, GeneratedLesson>();

  // Навчальні дні рахуються по курсах: сесія 2–3 курсів не скасовує пари першого
  const daysByCourse = new Map<number | undefined, ReadonlySet<IsoDate>>();
  const daysFor = (course: number | undefined): ReadonlySet<IsoDate> => {
    let days = daysByCourse.get(course);
    if (!days) {
      days = new Set(teachingDays(semester, course));
      daysByCourse.set(course, days);
    }
    return days;
  };

  for (const date of eachDay(semester.startDate, semester.endDate)) {
    const weekday = isoWeekday(date);
    if (weekday > 6) continue;
    const parity = weekParity(date, semester);
    for (const slot of schedule.slots) {
      if (slot.weekday !== weekday) continue;
      if (!daysFor(loadCourses?.get(slot.loadId)).has(date)) continue;
      if (date < slot.validFrom || (slot.validTo !== null && date > slot.validTo)) continue;
      if (slot.parity !== 'EVERY' && slot.parity !== parity) continue;
      wanted.set(lessonKey(slot.loadId, date, slot.pairNumber), {
        loadId: slot.loadId,
        slotId: slot.id,
        date,
        pairNumber: slot.pairNumber,
        roomId: slot.roomId,
        scheduleVersion: schedule.version,
      });
    }
  }

  const existingKeys = new Set(existing.map((l) => lessonKey(l.loadId, l.date, l.pairNumber)));

  const create = [...wanted.entries()]
    .filter(
      ([key, lesson]) => !existingKeys.has(key) && (today === undefined || lesson.date >= today),
    )
    .map(([, lesson]) => lesson);

  const keep: string[] = [];
  const cancel: string[] = [];
  for (const lesson of existing) {
    const stale = !wanted.has(lessonKey(lesson.loadId, lesson.date, lesson.pairNumber));
    const protectedLesson =
      lesson.status !== 'PLANNED' ||
      lesson.hasMarks ||
      lesson.manuallyEdited ||
      lesson.slotId === null || // додаткова пара
      (today !== undefined && lesson.date < today);
    if (stale && !protectedLesson) cancel.push(lesson.id);
    else keep.push(lesson.id);
  }

  return { create, keep, cancel };
}
