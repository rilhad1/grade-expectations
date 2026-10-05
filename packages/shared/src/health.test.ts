import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('приймає коректну відповідь', () => {
    expect(healthResponseSchema.parse({ status: 'ok', db: 'ok' })).toEqual({
      status: 'ok',
      db: 'ok',
    });
  });

  it('відхиляє невідомий стан БД', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok', db: 'maybe' }).success).toBe(false);
  });
});
