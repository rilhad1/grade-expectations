import type { IsoDate } from '@ge/shared';

export interface IcsEvent {
  uid: string;
  date: IsoDate;
  /** Локальний час початку «HH:MM» (без часового поясу: календар підставить пояс користувача). */
  start: string;
  end: string;
  summary: string;
  location?: string | undefined;
  description?: string | undefined;
  cancelled?: boolean | undefined;
}

// TextEncoder є і в Node 22, і в браузері; пакет не підключає типи Node/DOM.
declare const TextEncoder: new () => { encode: (input: string) => { length: number } };
const encoder = new TextEncoder();

/** RFC 5545: екранування тексту. */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545: рядки не довші за 75 октетів, продовження починається з пробілу. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Перший рядок вміщує 75 октетів, продовження — 74 (пробіл на початку)
    const limit = parts.length === 0 ? 75 : 74;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
const localTime = (date: IsoDate, time: string) =>
  `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

/**
 * Календар розкладу в форматі iCalendar. Час «плаваючий» (без TZID): пари показуються в локальному
 * часі користувача, а X-WR-TIMEZONE підказує пояс коледжу.
 */
export function buildIcs(options: {
  name: string;
  timezone: string;
  events: readonly IcsEvent[];
  generatedAt: Date;
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grade Expectations//Schedule//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(options.name)}`,
    `X-WR-TIMEZONE:${options.timezone}`,
  ];
  for (const event of options.events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp(options.generatedAt)}`,
      `DTSTART:${localTime(event.date, event.start)}`,
      `DTEND:${localTime(event.date, event.end)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
      ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
      `STATUS:${event.cancelled === true ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
