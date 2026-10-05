import { describe, expect, it } from 'vitest';

import { uuidv7 } from './uuid.js';

describe('uuidv7', () => {
  it('має версію 7 і варіант RFC 4122', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('кодує час у перших 48 бітах', () => {
    const ts = 0x0123456789ab;
    expect(uuidv7(ts).replace(/-/g, '').slice(0, 12)).toBe('0123456789ab');
  });

  it('сортується за часом', () => {
    const ids = [3000, 1000, 2000].map((t) => uuidv7(t));
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('дає унікальні значення в одну мілісекунду', () => {
    const set = new Set(Array.from({ length: 1000 }, () => uuidv7(5)));
    expect(set.size).toBe(1000);
  });
});
