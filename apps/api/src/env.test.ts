import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('підставляє значення за замовчуванням', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://x', BETTER_AUTH_SECRET: 'x'.repeat(32) });
    expect(env.API_PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('падає без DATABASE_URL', () => {
    expect(() => loadEnv({ BETTER_AUTH_SECRET: 'x'.repeat(32) })).toThrow();
  });

  it('падає, якщо секрет Better Auth коротший за 32 символи', () => {
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://x', BETTER_AUTH_SECRET: 'short' }),
    ).toThrow();
  });

  it('FAKE_TODAY дозволений поза production і заборонений у production', () => {
    const base = {
      DATABASE_URL: 'postgresql://x',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      FAKE_TODAY: '2026-10-12',
    };
    expect(loadEnv({ ...base, NODE_ENV: 'development' }).FAKE_TODAY).toBe('2026-10-12');
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow();
    expect(() => loadEnv({ ...base, FAKE_TODAY: 'вчора' })).toThrow();
  });

  it('Google необов’язковий', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://x', BETTER_AUTH_SECRET: 'x'.repeat(32) });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });
});
