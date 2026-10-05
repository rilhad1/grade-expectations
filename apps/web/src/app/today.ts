/** Сьогодні у форматі YYYY-MM-DD за київським часом. */
export function todayKyiv(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(now);
}
