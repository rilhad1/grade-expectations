const formatter = new Intl.DateTimeFormat('uk-UA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const short = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayShort = new Intl.DateTimeFormat('uk-UA', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

const at = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** «5 жовтня 2026» */
export const formatDate = (iso: string): string => formatter.format(at(iso));
/** «5 жовт.» */
export const formatShortDate = (iso: string): string => short.format(at(iso));
/** «пн, 5 жовт.» */
export const formatWeekdayDate = (iso: string): string => weekdayShort.format(at(iso));
