import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  createOrganization,
  deleteOrganization,
  login,
  testPrisma,
} from '../test/helpers.js';

const prisma = testPrisma();
let app: FastifyInstance;
let organizationId: string;
let cookies: Record<string, string> = {};
let ids: Record<string, string> = {};

beforeAll(async () => {
  app = await buildTestApp();

  // Тестові маршрути, що навішують authorize() так само, як це робитимуть реальні модулі
  app.post(
    '/test/grade/:ownerId',
    {
      preHandler: app.authorize('grade:write', async (req) => ({
        organizationId: (await app.requireAuth(req)).organization.id,
        teacherId: (req.params as { ownerId: string }).ownerId,
      })),
    },
    () => ({ ok: true }),
  );
  app.post('/test/publish', { preHandler: app.authorize('schedule:publish') }, () => ({
    ok: true,
  }));
  app.post(
    '/test/foreign-org',
    {
      preHandler: app.authorize('schedule:publish', () => ({
        organizationId: 'another-org',
      })),
    },
    () => ({ ok: true }),
  );
  app.post(
    '/test/validated',
    { schema: { body: (await import('zod')).z.object({ n: (await import('zod')).z.number() }) } },
    () => ({ ok: true }),
  );

  const org = await createOrganization(prisma, 'perm', {
    teacher: ['TEACHER'],
    otherTeacher: ['TEACHER'],
    moderator: ['MODERATOR'],
    both: ['TEACHER', 'MODERATOR'],
  });
  organizationId = org.organizationId;
  for (const [name, user] of Object.entries(org.users)) {
    cookies[name] = await login(app, user.email);
    ids[name] = user.id;
  }
});

afterAll(async () => {
  await deleteOrganization(prisma, organizationId);
  await prisma.$disconnect();
  await app.close();
  cookies = {};
  ids = {};
});

const post = (url: string, who?: string) =>
  app.inject({ method: 'POST', url, ...(who ? { headers: { cookie: cookies[who] ?? '' } } : {}) });

describe('authorize(): прив’язка can() до маршрутів', () => {
  it('анонім → 401', async () => {
    expect((await post('/test/publish')).statusCode).toBe(401);
  });

  it('викладач ставить оцінку у своєму навантаженні → 200', async () => {
    expect((await post(`/test/grade/${ids['teacher']}`, 'teacher')).statusCode).toBe(200);
  });

  it('викладач намагається змінити оцінку в чужому навантаженні → 403 problem+json', async () => {
    const res = await post(`/test/grade/${ids['otherTeacher']}`, 'teacher');
    expect(res.statusCode).toBe(403);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json<{ code: string }>().code).toBe('FORBIDDEN');
  });

  it('модератор не редагує чужі оцінки (OQ-3) → 403', async () => {
    expect((await post(`/test/grade/${ids['teacher']}`, 'moderator')).statusCode).toBe(403);
  });

  it('публікація розкладу: модератор → 200, викладач → 403', async () => {
    expect((await post('/test/publish', 'moderator')).statusCode).toBe(200);
    expect((await post('/test/publish', 'teacher')).statusCode).toBe(403);
  });

  it('користувач із двома ролями: публікує розклад і веде свої оцінки, але не чужі', async () => {
    expect((await post('/test/publish', 'both')).statusCode).toBe(200);
    expect((await post(`/test/grade/${ids['both']}`, 'both')).statusCode).toBe(200);
    expect((await post(`/test/grade/${ids['teacher']}`, 'both')).statusCode).toBe(403);
  });

  it('ресурс з іншого коледжу → 403 навіть для модератора', async () => {
    expect((await post('/test/foreign-org', 'moderator')).statusCode).toBe(403);
  });

  it('помилка валідації тіла → 400 problem+json', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/validated',
      payload: { n: 'не число' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json<{ code: string }>().code).toBe('VALIDATION_ERROR');
  });
});
