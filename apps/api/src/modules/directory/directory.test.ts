import type { BellDto, CohortDto, DisciplineDto, RoomDto } from '@ge/shared';
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

const prisma = testPrisma();
let app: FastifyInstance;
let orgs: string[] = [];
let mod: ReturnType<typeof client>;
let teacher: ReturnType<typeof client>;
let otherMod: ReturnType<typeof client>;

type Page<T> = { items: T[]; nextCursor: string | null };

beforeAll(async () => {
  app = await buildTestApp();
  const org = await createOrganization(prisma, 'dir', { mod: ['MODERATOR'], teacher: ['TEACHER'] });
  const other = await createOrganization(prisma, 'dir-other', { mod: ['MODERATOR'] });
  orgs = [org.organizationId, other.organizationId];
  mod = client(app, await login(app, org.users['mod']?.email ?? ''));
  teacher = client(app, await login(app, org.users['teacher']?.email ?? ''));
  otherMod = client(app, await login(app, other.users['mod']?.email ?? ''));
});

afterAll(async () => {
  for (const id of orgs) await deleteOrganization(prisma, id);
  await prisma.$disconnect();
  await app.close();
});

describe('дисципліни', () => {
  let discipline: DisciplineDto;

  it('модератор створює, викладач читає, але не створює', async () => {
    const created = await mod<DisciplineDto>('POST', '/disciplines', {
      title: 'Інформатика',
      shortTitle: 'Інформ.',
      color: '#3B6EA5',
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ defaultScale: 'TWELVE', code: null, version: 0 });
    discipline = created.body;

    const list = await teacher<Page<DisciplineDto>>('GET', '/disciplines');
    expect(list.body.items.map((d) => d.title)).toEqual(['Інформатика']);
    expect(
      (await teacher('POST', '/disciplines', { title: 'x', shortTitle: 'x', color: '#000000' }))
        .status,
    ).toBe(403);
  });

  it('валідація кольору', async () => {
    const res = await mod('POST', '/disciplines', {
      title: 'x',
      shortTitle: 'x',
      color: 'червоний',
    });
    expect(res.status).toBe(400);
  });

  it('оновлення за версією та м’яке видалення', async () => {
    const ok = await mod<DisciplineDto>('PATCH', `/disciplines/${discipline.id}`, {
      title: 'Інформатика (нова)',
      version: 0,
    });
    expect(ok.body.version).toBe(1);
    expect(
      (await mod('PATCH', `/disciplines/${discipline.id}`, { title: 'ще', version: 0 })).status,
    ).toBe(409);

    expect((await mod('DELETE', `/disciplines/${discipline.id}`)).status).toBe(204);
    expect((await mod<Page<DisciplineDto>>('GET', '/disciplines')).body.items).toHaveLength(0);
    expect((await mod('DELETE', `/disciplines/${discipline.id}`)).status).toBe(404);
    const row = await prisma.discipline.findUnique({ where: { id: discipline.id } });
    expect(row?.deletedAt).not.toBeNull(); // запис лишається для синхронізації
  });

  it('чужий коледж не бачить дисциплін', async () => {
    await mod('POST', '/disciplines', { title: 'Фізика', shortTitle: 'Фіз', color: '#112233' });
    expect((await otherMod<Page<DisciplineDto>>('GET', '/disciplines')).body.items).toHaveLength(0);
  });
});

describe('аудиторії', () => {
  it('створення, дублікат назви, оновлення, видалення', async () => {
    const room = await mod<RoomDto>('POST', '/rooms', { name: '214', capacity: 30 });
    expect(room.status).toBe(201);
    expect((await mod('POST', '/rooms', { name: '214' })).status).toBe(409);
    const upd = await mod<RoomDto>('PATCH', `/rooms/${room.body.id}`, {
      capacity: 28,
      kind: 'лекційна',
      version: 0,
    });
    expect(upd.body).toMatchObject({ capacity: 28, kind: 'лекційна', version: 1 });
    expect((await mod('DELETE', `/rooms/${room.body.id}`)).status).toBe(204);
    expect((await mod<Page<RoomDto>>('GET', '/rooms')).body.items).toHaveLength(0);
  });
});

describe('розклад дзвінків', () => {
  const bells: BellDto[] = [
    { pairNumber: 1, startsAt: '08:30', endsAt: '09:50' },
    { pairNumber: 2, startsAt: '10:00', endsAt: '11:20' },
    { pairNumber: 3, startsAt: '11:40', endsAt: '13:00' },
  ];

  it('PUT замінює весь розклад; відсутні пари зникають, повернені — відновлюються', async () => {
    expect((await mod<BellDto[]>('PUT', '/bells', bells)).body).toEqual(bells);
    const shorter = await mod<BellDto[]>('PUT', '/bells', [
      { pairNumber: 1, startsAt: '08:00', endsAt: '09:20' },
    ]);
    expect(shorter.body).toEqual([{ pairNumber: 1, startsAt: '08:00', endsAt: '09:20' }]);
    const back = await mod<BellDto[]>('PUT', '/bells', bells);
    expect(back.body).toEqual(bells);
    expect((await teacher<BellDto[]>('GET', '/bells')).body).toHaveLength(3);
  });

  it('відхиляє дублікати номерів, некоректний час і порожній список', async () => {
    expect((await mod('PUT', '/bells', [bells[0], bells[0]])).status).toBe(400);
    expect(
      (await mod('PUT', '/bells', [{ pairNumber: 1, startsAt: '25:00', endsAt: '26:00' }])).status,
    ).toBe(400);
    expect(
      (await mod('PUT', '/bells', [{ pairNumber: 1, startsAt: '10:00', endsAt: '09:00' }])).status,
    ).toBe(400);
    expect((await mod('PUT', '/bells', [])).status).toBe(400);
  });

  it('викладач не редагує дзвінки', async () => {
    expect((await teacher('PUT', '/bells', bells)).status).toBe(403);
  });
});

describe('потоки', () => {
  it('створення й оновлення', async () => {
    const c = await mod<CohortDto>('POST', '/cohorts', {
      specialty: 'Програмне забезпечення',
      entryYear: 2026,
    });
    expect(c.status).toBe(201);
    expect(
      (await mod('POST', '/cohorts', { specialty: 'Програмне забезпечення', entryYear: 2026 }))
        .status,
    ).toBe(409);
    const u = await mod<CohortDto>('PATCH', `/cohorts/${c.body.id}`, {
      entryYear: 2025,
      version: 0,
    });
    expect(u.body.entryYear).toBe(2025);
  });
});
