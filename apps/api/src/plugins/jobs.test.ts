import type { DocumentDto } from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';
import {
  client,
  createOrganization,
  deleteOrganization,
  login,
  testEnv,
  testPrisma,
} from '../test/helpers.js';

const prisma = testPrisma();
let app: FastifyInstance;
let organizationId = '';
let teacher: ReturnType<typeof client>;

beforeAll(async () => {
  app = await buildApp({ ...testEnv(), JOBS_DRIVER: 'pgboss' });
  const org = await createOrganization(prisma, 'boss', { teacher: ['TEACHER'] });
  organizationId = org.organizationId;
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
}, 60_000);

afterAll(async () => {
  await deleteOrganization(prisma, organizationId);
  await prisma.$disconnect();
  await app.close();
}, 30_000);

describe('pg-boss', () => {
  it('документ формується фоновою задачею з черги Postgres', async () => {
    const created = await teacher<DocumentDto>('POST', '/documents', { kind: 'DATA_EXPORT' });
    expect(created.status).toBe(202);
    expect(created.body.status).toBe('PENDING');

    let status = 'PENDING';
    for (let i = 0; i < 100 && status === 'PENDING'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      status = (await teacher<DocumentDto>('GET', `/documents/${created.body.id}`)).body.status;
    }
    expect(status).toBe('READY');
  }, 30_000);
});
