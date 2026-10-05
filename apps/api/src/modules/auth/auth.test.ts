import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  TEST_PASSWORD,
  WEB_ORIGIN,
  buildTestApp,
  createOrganization,
  deleteOrganization,
  login,
  testPrisma,
} from '../../test/helpers.js';

const prisma = testPrisma();
let app: FastifyInstance;
let organizationId: string;
let teacherEmail: string;
let bothEmail: string;

beforeAll(async () => {
  app = await buildTestApp();
  const org = await createOrganization(prisma, 'auth', {
    teacher: ['TEACHER'],
    both: ['TEACHER', 'MODERATOR'],
  });
  organizationId = org.organizationId;
  teacherEmail = org.users['teacher']?.email ?? '';
  bothEmail = org.users['both']?.email ?? '';
});

afterAll(async () => {
  await deleteOrganization(prisma, organizationId);
  await prisma.$disconnect();
  await app.close();
});

describe('вхід і сесія', () => {
  it('email+пароль → cookie сесії → /me повертає користувача, коледж і ролі', async () => {
    const cookie = await login(app, teacherEmail);
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      user: { email: string };
      organization: { id: string };
      roles: string[];
    }>();
    expect(body.user.email).toBe(teacherEmail);
    expect(body.organization.id).toBe(organizationId);
    expect(body.roles).toEqual(['TEACHER']);
  });

  it('користувач із кількома ролями отримує їх усі', async () => {
    const cookie = await login(app, bothEmail);
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    expect(res.json<{ roles: string[] }>().roles.sort()).toEqual(['MODERATOR', 'TEACHER']);
  });

  it('cookie сесії httpOnly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
      payload: { email: teacherEmail, password: TEST_PASSWORD },
    });
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  it('невірний пароль → 401 без сесії', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
      payload: { email: teacherEmail, password: 'wrong-password-1' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('без cookie /me → 401 problem+json з кодом UNAUTHENTICATED', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json<{ code: string }>().code).toBe('UNAUTHENTICATED');
  });

  it('самореєстрація вимкнена', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-up/email',
      headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
      payload: { email: 'new.user@test.local', password: 'some-password-1', name: 'Новий' },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const exists = await prisma.user.findUnique({ where: { email: 'new.user@test.local' } });
    expect(exists).toBeNull();
  });

  it('вихід знищує сесію', async () => {
    const cookie = await login(app, teacherEmail);
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-out',
      headers: { cookie, origin: WEB_ORIGIN, 'content-type': 'application/json' },
      payload: {},
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    expect(res.statusCode).toBe(401);
  });

  it('користувач без членства в коледжі не отримує доступу', async () => {
    const orphan = await createOrganization(prisma, 'orphan', { nobody: ['TEACHER'] });
    const email = orphan.users['nobody']?.email ?? '';
    const cookie = await login(app, email);
    await prisma.membership.deleteMany({ where: { organizationId: orphan.organizationId } });
    const res = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } });
    expect(res.statusCode).toBe(401);
    await deleteOrganization(prisma, orphan.organizationId);
  });

  it('/public-config доступний без входу і показує, що Google вимкнено', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/public-config' });
    expect(res.json()).toEqual({ googleEnabled: false });
  });
});

describe('обмеження спроб входу', () => {
  const attempt = (email: string) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/sign-in/email',
      headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
      payload: { email, password: 'wrong-password-1' },
    });

  it('перебір пароля одного облікового запису блокується (429 problem+json), інші користувачі не страждають', async () => {
    const victim = `bruteforce.${Date.now()}@test.local`; // окрема адреса: квота не змішується з іншими тестами
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await attempt(victim)).statusCode);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);

    const blocked = await attempt(victim);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(blocked.json<{ code: string }>().code).toBe('RATE_LIMITED');

    // інший обліковий запис з того самого IP, як і правильний вхід, працює
    expect((await attempt(teacherEmail)).statusCode).toBe(401);
    const cookie = await login(app, teacherEmail);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie } })).statusCode,
    ).toBe(200);
  });

  it('get-session не обмежується', async () => {
    const cookie = await login(app, teacherEmail);
    for (let i = 0; i < 30; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/get-session',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
    }
  });
});
