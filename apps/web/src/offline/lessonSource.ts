import { lessonItemDtoSchema, type LessonDetailDto, type TodayDto } from '@ge/shared';

import { fetchLesson, fetchToday } from '../api/teaching';
import { todayKyiv } from '../app/today';

import { db } from './db';
import { isNetworkError } from './network';
import { rebaseOnPending } from './outbox';

/**
 * Заняття «На парі»: з сервера (і в локальну копію), а без зв'язку — з локальної копії.
 * Ще не відправлені зміни завжди накладаються поверх відповіді сервера.
 */
export async function loadLesson(id: string): Promise<LessonDetailDto> {
  try {
    const detail = await rebaseOnPending(await fetchLesson(id));
    await db.lessons.put({ id, date: detail.date, detail });
    return detail;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const record = await db.lessons.get(id);
    if (!record) throw error;
    // Старі локальні копії можуть не мати нових полів: схема доповнює їх значеннями за замовчуванням
    return withDefaults(record.detail);
  }
}

type Stored = Omit<LessonDetailDto, 'stream' | 'streamId'> &
  Partial<Pick<LessonDetailDto, 'stream' | 'streamId'>>;

/** Локальна копія, збережена попередньою версією, не має полів потоку: доповнюємо за замовчуванням. */
function withDefaults(stored: Stored): LessonDetailDto {
  return { ...stored, streamId: stored.streamId ?? null, stream: stored.stream ?? [] };
}

/**
 * «Сьогодні»: онлайн — повна відповідь сервера; офлайн — пари з локальної копії
 * (атестації, зона ризику й вичитка потребують сервера й не показуються).
 */
export async function loadToday(): Promise<TodayDto> {
  try {
    return await fetchToday();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const date = todayKyiv();
    const records = await db.lessons.where('date').equals(date).toArray();
    if (records.length === 0 && (await db.lessons.count()) === 0) throw error;
    return {
      date,
      lessons: records
        .map((r) => r.detail)
        .sort((a, b) => a.pairNumber - b.pairNumber)
        .map((d) => ({
          ...lessonItemDtoSchema.parse(d),
          marked: d.roster.filter((r) => r.marked).length,
          total: d.roster.length,
        })),
      attestations: [],
      risk: [],
      hours: [],
    };
  }
}
