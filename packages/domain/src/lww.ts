/**
 * Конфлікти відвідуваності й оцінок: «останній запис перемагає» по клітинці (студент × заняття).
 * Порівнюється час редагування на пристрої, а не час доходу операції до сервера: офлайн-запис
 * 10:00, що прийшов о 10:30, програє онлайн-запису з іншого пристрою о 10:10.
 */
export type LwwDecision = 'apply' | 'skip';

export function resolveLww(existingEditedAt: string | null, opAt: string): LwwDecision {
  if (existingEditedAt === null) return 'apply';
  return Date.parse(opAt) >= Date.parse(existingEditedAt) ? 'apply' : 'skip';
}

/** Годинник пристрою не може бути «з майбутнього»: час операції обмежується серверним «зараз». */
export function clampOpTime(opAt: string, now: string): string {
  return Date.parse(opAt) > Date.parse(now) ? now : opAt;
}
