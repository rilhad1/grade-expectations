import { describe, expect, it } from 'vitest';

import { buildIcs, escapeIcsText, foldLine } from './icsCalendar.js';

const generatedAt = new Date('2026-10-12T07:30:00.123Z');

describe('escapeIcsText', () => {
  it('екранує службові символи', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
});

describe('foldLine', () => {
  it('короткі рядки не змінює', () => {
    expect(foldLine('SUMMARY:abc')).toBe('SUMMARY:abc');
  });

  it('довгі ріже за 75 октетів, не розриваючи символи UTF-8', () => {
    const folded = foldLine(`SUMMARY:${'Математика '.repeat(20)}`);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, part] of parts.entries()) {
      const text = i === 0 ? part : part.slice(1);
      expect(part.startsWith(' ') || i === 0).toBe(true);
      expect(new TextEncoder().encode(i === 0 ? part : part).length).toBeLessThanOrEqual(75);
      expect(text).not.toContain('�');
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'Математика '.repeat(20)}`);
  });
});

describe('buildIcs', () => {
  const ics = buildIcs({
    name: 'Розклад, Іваненко',
    timezone: 'Europe/Kyiv',
    generatedAt,
    events: [
      {
        uid: 'a@ge',
        date: '2026-10-12',
        start: '08:30',
        end: '09:50',
        summary: 'Математика · ПДт-11',
        location: 'ауд. 101',
        description: 'Тема: Границі',
      },
      {
        uid: 'b@ge',
        date: '2026-10-13',
        start: '10:10',
        end: '11:30',
        summary: 'X',
        cancelled: true,
      },
    ],
  });

  it('має обрамлення календаря й CRLF', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('X-WR-CALNAME:Розклад\\, Іваненко');
    expect(ics).toContain('X-WR-TIMEZONE:Europe/Kyiv');
  });

  it('описує події з локальним часом', () => {
    expect(ics).toContain('DTSTAMP:20261012T073000Z');
    expect(ics).toContain('DTSTART:20261012T083000');
    expect(ics).toContain('DTEND:20261012T095000');
    expect(ics).toContain('LOCATION:ауд. 101');
    expect(ics).toContain('DESCRIPTION:Тема: Границі');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('скасовані пари мають STATUS:CANCELLED, без місця й опису — без відповідних полів', () => {
    const second = ics.split('BEGIN:VEVENT')[2] ?? '';
    expect(second).toContain('STATUS:CANCELLED');
    expect(second).not.toContain('LOCATION');
    expect(second).not.toContain('DESCRIPTION');
  });
});
