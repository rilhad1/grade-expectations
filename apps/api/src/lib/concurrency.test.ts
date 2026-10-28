import { describe, expect, it } from 'vitest';

import { mapLimit } from './concurrency.js';

describe('mapLimit', () => {
  it('зберігає порядок і не перевищує ліміт одночасних викликів', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([5, 1, 4, 2, 3, 6], 2, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running -= 1;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30, 60]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('порожній список і ліміт більший за довжину', async () => {
    expect(await mapLimit([], 4, (n: number) => Promise.resolve(n))).toEqual([]);
    expect(await mapLimit([1, 2], 10, (n) => Promise.resolve(n + 1))).toEqual([2, 3]);
  });
});
