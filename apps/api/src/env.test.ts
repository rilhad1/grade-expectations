import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('підставляє значення за замовчуванням', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://x' });
    expect(env.API_PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('падає без DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow();
  });
});
