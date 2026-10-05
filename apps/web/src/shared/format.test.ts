import { describe, expect, it } from 'vitest';

import { formatDate, formatShortDate, formatWeekdayDate } from './format';

describe('формат дат українською', () => {
  it('повна дата', () => {
    expect(formatDate('2026-10-05')).toContain('5 жовтня 2026');
  });
  it('коротка дата', () => {
    expect(formatShortDate('2026-10-05')).toMatch(/5 жовт/);
  });
  it('день тижня', () => {
    expect(formatWeekdayDate('2026-10-05')).toMatch(/пн/);
  });
});
