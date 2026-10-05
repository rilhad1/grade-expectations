import { describe, expect, it } from 'vitest';

import { hoursProgress, type HoursLesson } from './hoursProgress.js';

const l = (status: HoursLesson['status'], date: string, hours = 2): HoursLesson => ({
  status,
  date,
  hours,
});
const today = '2026-10-05';

describe('hoursProgress', () => {
  it('факт — лише HELD; прогноз додає майбутні PLANNED', () => {
    const r = hoursProgress(
      { plannedHours: 10 },
      [
        l('HELD', '2026-09-01'),
        l('HELD', '2026-09-08'),
        l('PLANNED', '2026-10-05'),
        l('PLANNED', '2026-10-12'),
        l('PLANNED', '2026-09-20'), // у минулому, не проведене — не рахується
        l('CANCELLED', '2026-10-19'),
      ],
      today,
    );
    expect(r).toEqual({ planned: 10, held: 4, forecast: 8, deficit: 2, extraPairsNeeded: 1 });
  });

  it('без нестачі', () => {
    const r = hoursProgress(
      { plannedHours: 4 },
      [l('HELD', '2026-09-01'), l('PLANNED', '2026-10-12')],
      today,
    );
    expect(r.deficit).toBe(0);
    expect(r.extraPairsNeeded).toBe(0);
  });

  it('надлишок не дає від’ємної нестачі', () => {
    expect(
      hoursProgress({ plannedHours: 2 }, [l('HELD', '2026-09-01'), l('HELD', '2026-09-02')], today)
        .deficit,
    ).toBe(0);
  });

  it('нестача 3 год → 2 додаткові пари', () => {
    expect(hoursProgress({ plannedHours: 3 }, [], today).extraPairsNeeded).toBe(2);
  });
});
