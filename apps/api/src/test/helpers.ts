import { uuidv7, type Role } from '@ge/shared';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../app.js';
import type { Env } from '../env.js';

export const TEST_PASSWORD = 'test-password-123';
export const WEB_ORIGIN = 'http://localhost:5173';

export const testEnv = (): Env => ({
  NODE_ENV: 'test',
  API_PORT: 0,
  DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? 'postgresql://ge:ge@localhost:5432/ge_test',
  BETTER_AUTH_SECRET: 'test-only-secret-0123456789abcdef0123',
  WEB_ORIGIN,
});

export const buildTestApp = (): Promise<FastifyInstance> => buildApp(testEnv());

export const testPrisma = (): PrismaClient =>
  new PrismaClient({ datasourceUrl: testEnv().DATABASE_URL });

export interface TestUser {
  id: string;
  email: string;
  organizationId: string;
}

/** Створює коледж з користувачами (кожен із власним набором ролей) і паролем TEST_PASSWORD. */
export async function createOrganization(
  prisma: PrismaClient,
  label: string,
  members: Record<string, Role[]>,
): Promise<{ organizationId: string; users: Record<string, TestUser> }> {
  const organizationId = uuidv7();
  await prisma.organization.create({ data: { id: organizationId, title: `Тест ${label}` } });
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const users: Record<string, TestUser> = {};

  for (const [name, roles] of Object.entries(members)) {
    const id = uuidv7();
    const email = `${name}.${id}@test.local`.toLowerCase(); // Better Auth нормалізує регістр
    await prisma.user.create({
      data: { id, email, fullName: `${name} ${label}`, emailVerified: true },
    });
    await prisma.account.create({
      data: {
        id: uuidv7(),
        userId: id,
        accountId: id,
        providerId: 'credential',
        password: passwordHash,
      },
    });
    await prisma.membership.create({ data: { id: uuidv7(), userId: id, organizationId, roles } });
    users[name] = { id, email, organizationId };
  }
  return { organizationId, users };
}

export async function deleteOrganization(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const memberships = await prisma.membership.findMany({ where: { organizationId } });
  const userIds = memberships.map((m) => m.userId);
  await prisma.student.deleteMany({ where: { organizationId } });
  await prisma.membership.deleteMany({ where: { organizationId } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.organization.delete({ where: { id: organizationId } });
}

/** Входить через API і повертає значення Cookie для наступних запитів. */
export async function login(
  app: FastifyInstance,
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-in/email',
    headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
    payload: { email, password },
  });
  if (res.statusCode !== 200) throw new Error(`Вхід не вдався: ${res.statusCode} ${res.body}`);
  const cookies = res.headers['set-cookie'];
  const list = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}
