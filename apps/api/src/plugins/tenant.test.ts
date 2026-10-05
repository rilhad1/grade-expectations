import { uuidv7 } from '@ge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createOrganization, deleteOrganization, testPrisma } from '../test/helpers.js';

import { forOrganization } from './tenant.js';

const prisma = testPrisma();
let orgA = '';
let orgB = '';
let studentB = '';

const student = (organizationId: string, lastName: string) => ({
  id: uuidv7(),
  organizationId,
  lastName,
  firstName: 'Тест',
});

beforeAll(async () => {
  orgA = (await createOrganization(prisma, 'tenant-a', {})).organizationId;
  orgB = (await createOrganization(prisma, 'tenant-b', {})).organizationId;
  const a = student(orgA, 'Алфа');
  const b = student(orgB, 'Браво');
  studentB = b.id;
  await prisma.student.createMany({ data: [a, b] });
});

afterAll(async () => {
  await deleteOrganization(prisma, orgA);
  await deleteOrganization(prisma, orgB);
  await prisma.$disconnect();
});

describe('forOrganization(): ізоляція за коледжем', () => {
  it('findMany і count бачать лише свій коледж', async () => {
    const db = forOrganization(prisma, orgA);
    const rows = await db.student.findMany();
    expect(rows.map((r) => r.lastName)).toEqual(['Алфа']);
    expect(await db.student.count()).toBe(1);
  });

  it('чужий запис за id не знаходиться', async () => {
    const db = forOrganization(prisma, orgA);
    expect(await db.student.findUnique({ where: { id: studentB } })).toBeNull();
    expect(await db.student.findFirst({ where: { id: studentB } })).toBeNull();
  });

  it('спроба підмінити organizationId у where ігнорується', async () => {
    const db = forOrganization(prisma, orgA);
    const rows = await db.student.findMany({ where: { organizationId: orgB } });
    expect(rows.map((r) => r.lastName)).toEqual(['Алфа']);
  });

  it('чужий запис не можна змінити чи видалити', async () => {
    const db = forOrganization(prisma, orgA);
    await expect(
      db.student.update({ where: { id: studentB }, data: { note: 'злам' } }),
    ).rejects.toThrow();
    expect(
      (await db.student.updateMany({ where: { id: studentB }, data: { note: 'злам' } })).count,
    ).toBe(0);
    expect((await db.student.deleteMany({ where: { id: studentB } })).count).toBe(0);
    const intact = await prisma.student.findUnique({ where: { id: studentB } });
    expect(intact?.note).toBeNull();
  });

  it('create проставляє organizationId сам і ігнорує чужий', async () => {
    const db = forOrganization(prisma, orgA);
    const created = await db.student.create({
      data: { id: uuidv7(), organizationId: orgB, lastName: 'Створений', firstName: 'Тест' },
    });
    expect(created.organizationId).toBe(orgA);
  });

  it('createMany проставляє organizationId кожному рядку', async () => {
    const db = forOrganization(prisma, orgA);
    await db.student.createMany({
      data: [
        { id: uuidv7(), organizationId: orgB, lastName: 'М1', firstName: 'Тест' },
        { id: uuidv7(), organizationId: orgB, lastName: 'М2', firstName: 'Тест' },
      ],
    });
    const inB = await prisma.student.count({
      where: { organizationId: orgB, lastName: { in: ['М1', 'М2'] } },
    });
    expect(inB).toBe(0);
  });

  it('upsert не торкається чужого запису', async () => {
    const db = forOrganization(prisma, orgA);
    const result = await db.student
      .upsert({
        where: { id: studentB },
        create: { id: studentB, organizationId: orgB, lastName: 'Новий', firstName: 'Тест' },
        update: { note: 'злам' },
      })
      .catch((e: unknown) => e);
    // Запису studentB для orgA немає: або створення впирається в унікальність id, або запит відхиляється
    expect(result instanceof Error).toBe(true);
    const intact = await prisma.student.findUnique({ where: { id: studentB } });
    expect(intact?.lastName).toBe('Браво');
    expect(intact?.note).toBeNull();
  });

  it('моделі без прямого organizationId (Semester) не фільтруються розширенням', async () => {
    const db = forOrganization(prisma, orgA);
    await expect(db.semester.count()).resolves.toBeTypeOf('number');
  });
});
