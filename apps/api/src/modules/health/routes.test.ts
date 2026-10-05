import { describe, expect, it } from 'vitest';

import { buildApp } from '../../app.js';

describe('GET /api/v1/health', () => {
  it('повертає db: down, якщо БД недоступна', async () => {
    const app = await buildApp({
      NODE_ENV: 'test',
      API_PORT: 0,
      DATABASE_URL: 'postgresql://ge:ge@127.0.0.1:1/none',
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'down' });
    await app.close();
  });
});
