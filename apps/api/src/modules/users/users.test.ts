import type { UserDto } from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  client,
  createOrganization,
  deleteOrganization,
  login,
  testPrisma,
} from '../../test/helpers.js';

import { generateTemporaryPassword } from './service.js';

const prisma = testPrisma();
let app: FastifyInstance;
let orgs: string[] = [];
let modId = '';
let mod: ReturnType<typeof client>;
let teacher: ReturnType<typeof client>;
const createdEmails: string[] = [];

type Page<T> = { items: T[]; nextCursor: string | null };
type Created = UserDto & { temporaryPassword: string };

beforeAll(async () => {
  app = await buildTestApp();
  const org = await createOrganization(prisma, 'usr', { mod: ['MODERATOR'], teacher: ['TEACHER'] });
  orgs = [org.organizationId];
  modId = org.users['mod']?.id ?? '';
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
});

afterAll(async () => {
  // Користувачі, створені API, не входять у фікстуру: прибираємо їх окремо
  const users = await prisma.user.findMany({ where: { email: { in: createdEmails } } });
  const ids = users.map((u) => u.id);
  await prisma.membership.deleteMany({ where: { userId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.account.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
});

describe('generateTemporaryPassword', () => {
  it('має потрібну довжину й лише однозначні символи', () => {
    const p = generateTemporaryPassword();
    expect(p).toHaveLength(12);
    expect(p).toMatch(/^[a-hj-km-np-zA-HJ-NP-Z2-9]+$/);
    expect(generateTemporaryPassword()).not.toBe(p);
  });
});

describe('користувачі коледжу', () => {
  it('деканат створює викладача; той входить із тимчасовим паролем і бачить свою роль', async () => {
    const email = `new.teacher.${Date.now()}@test.local`;
    createdEmails.push(email);
    const res = await mod<Created>('POST', '/users', {
      email: email.toUpperCase(),
      fullName: 'Новий Викладач',
      roles: ['TEACHER'],
    });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(email); // пошта нормалізується
    expect(res.body.temporaryPassword).toHaveLength(12);

    const cookie = await login(app, email, res.body.temporaryPassword);
    const me = await client(app, cookie)<{ roles: string[]; organization: { id: string } }>(
      'GET',
      '/me',
    );
    expect(me.body.roles).toEqual(['TEACHER']);
    expect(me.body.organization.id).toBe(orgs[0]);
  });

  it('дублікат пошти → 409', async () => {
    const email = `dup.${Date.now()}@test.local`;
    createdEmails.push(email);
    await mod('POST', '/users', { email, fullName: 'Один', roles: ['TEACHER'] });
    expect(
      (await mod('POST', '/users', { email, fullName: 'Два', roles: ['TEACHER'] })).status,
    ).toBe(409);
  });

  it('список доступний лише деканату', async () => {
    const list = await mod<Page<UserDto>>('GET', '/users');
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(list.body)).not.toContain('password');
    expect((await teacher('GET', '/users')).status).toBe(403);
    expect(
      (
        await teacher('POST', '/users', {
          email: 'x@test.local',
          fullName: 'x',
          roles: ['MODERATOR'],
        })
      ).status,
    ).toBe(403);
  });

  it('зміна ролей; не можна забрати у себе роль модератора', async () => {
    const email = `roles.${Date.now()}@test.local`;
    createdEmails.push(email);
    const created = await mod<Created>('POST', '/users', {
      email,
      fullName: 'Ролі',
      roles: ['TEACHER'],
    });
    const upd = await mod<UserDto>('PUT', `/users/${created.body.id}/roles`, {
      roles: ['TEACHER', 'MODERATOR'],
    });
    expect(upd.body.roles.sort()).toEqual(['MODERATOR', 'TEACHER']);

    const self = await mod<{ code: string }>('PUT', `/users/${modId}/roles`, {
      roles: ['TEACHER'],
    });
    expect(self.status).toBe(422);
    expect(self.body.code).toBe('CANNOT_REMOVE_OWN_MODERATOR');
    expect(
      (await mod('PUT', `/users/${crypto.randomUUID()}/roles`, { roles: ['TEACHER'] })).status,
    ).toBe(404);
  });

  it('вимагає хоча б одну роль і коректну пошту', async () => {
    expect(
      (await mod('POST', '/users', { email: 'x@test.local', fullName: 'x', roles: [] })).status,
    ).toBe(400);
    expect(
      (await mod('POST', '/users', { email: 'не-пошта', fullName: 'x', roles: ['TEACHER'] }))
        .status,
    ).toBe(400);
  });
});
