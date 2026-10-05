import type {
  BellDto,
  CohortDto,
  CreateCohortInput,
  CreateDisciplineInput,
  CreateRoomInput,
  DisciplineDto,
  RoomDto,
  UpdateCohortInput,
  UpdateDisciplineInput,
  UpdateRoomInput,
} from '@ge/shared';

import { notFound } from '../../errors.js';
import { definedOnly, newId, pageArgs, toPage, versionedUpdate } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';

// ── Дисципліни ───────────────────────────────────────
type DisciplineRow = NonNullable<Awaited<ReturnType<AuthContext['db']['discipline']['findFirst']>>>;
const disciplineDto = (d: DisciplineRow): DisciplineDto => ({
  id: d.id,
  title: d.title,
  shortTitle: d.shortTitle,
  code: d.code,
  color: d.color,
  defaultScale: d.defaultScale,
  version: d.version,
});

export async function listDisciplines(ctx: AuthContext, cursor: string | undefined, limit: number) {
  const rows = await ctx.db.discipline.findMany({
    where: { deletedAt: null },
    ...pageArgs(cursor, limit),
  });
  const page = toPage(rows, limit);
  return { items: page.items.map(disciplineDto), nextCursor: page.nextCursor };
}

export async function createDiscipline(ctx: AuthContext, input: CreateDisciplineInput) {
  const { id, ...data } = input;
  return disciplineDto(
    await ctx.db.discipline.create({
      data: { ...data, id: newId(id), organizationId: ctx.organization.id },
    }),
  );
}

export async function updateDiscipline(ctx: AuthContext, id: string, input: UpdateDisciplineInput) {
  const { version, ...data } = input;
  const row = await versionedUpdate({
    update: () =>
      ctx.db.discipline.updateMany({
        where: { id, version, deletedAt: null },
        data: { ...definedOnly(data), version: { increment: 1 } },
      }),
    load: () => ctx.db.discipline.findFirst({ where: { id, deletedAt: null } }),
    what: 'Дисципліну',
  });
  return disciplineDto(row);
}

export async function deleteDiscipline(ctx: AuthContext, id: string) {
  const { count } = await ctx.db.discipline.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
  if (count === 0) throw notFound('Дисципліну не знайдено');
}

// ── Аудиторії ────────────────────────────────────────
type RoomRow = NonNullable<Awaited<ReturnType<AuthContext['db']['room']['findFirst']>>>;
const roomDto = (r: RoomRow): RoomDto => ({
  id: r.id,
  name: r.name,
  capacity: r.capacity,
  kind: r.kind,
  version: r.version,
});

export async function listRooms(ctx: AuthContext, cursor: string | undefined, limit: number) {
  const page = toPage(
    await ctx.db.room.findMany({ where: { deletedAt: null }, ...pageArgs(cursor, limit) }),
    limit,
  );
  return { items: page.items.map(roomDto), nextCursor: page.nextCursor };
}

export async function createRoom(ctx: AuthContext, input: CreateRoomInput) {
  const { id, ...data } = input;
  return roomDto(
    await ctx.db.room.create({
      data: { ...data, id: newId(id), organizationId: ctx.organization.id },
    }),
  );
}

export async function updateRoom(ctx: AuthContext, id: string, input: UpdateRoomInput) {
  const { version, ...data } = input;
  const row = await versionedUpdate({
    update: () =>
      ctx.db.room.updateMany({
        where: { id, version, deletedAt: null },
        data: { ...definedOnly(data), version: { increment: 1 } },
      }),
    load: () => ctx.db.room.findFirst({ where: { id, deletedAt: null } }),
    what: 'Аудиторію',
  });
  return roomDto(row);
}

export async function deleteRoom(ctx: AuthContext, id: string) {
  const { count } = await ctx.db.room.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), version: { increment: 1 } },
  });
  if (count === 0) throw notFound('Аудиторію не знайдено');
}

// ── Розклад дзвінків ─────────────────────────────────
export async function listBells(ctx: AuthContext): Promise<BellDto[]> {
  const rows = await ctx.db.bellTime.findMany({
    where: { deletedAt: null },
    orderBy: { pairNumber: 'asc' },
  });
  return rows.map((b) => ({ pairNumber: b.pairNumber, startsAt: b.startsAt, endsAt: b.endsAt }));
}

/** Повна заміна розкладу дзвінків: відсутні пари м'яко видаляються, наявні оновлюються. */
export async function replaceBells(
  ctx: AuthContext,
  bells: readonly BellDto[],
): Promise<BellDto[]> {
  const organizationId = ctx.organization.id;
  await ctx.db.$transaction(async (tx) => {
    await tx.bellTime.updateMany({
      where: { pairNumber: { notIn: bells.map((b) => b.pairNumber) }, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    for (const bell of bells) {
      await tx.bellTime.upsert({
        where: { organizationId_pairNumber: { organizationId, pairNumber: bell.pairNumber } },
        create: { organizationId, ...bell },
        update: {
          startsAt: bell.startsAt,
          endsAt: bell.endsAt,
          deletedAt: null,
          version: { increment: 1 },
        },
      });
    }
  });
  return listBells(ctx);
}

// ── Потоки ───────────────────────────────────────────
type CohortRow = NonNullable<Awaited<ReturnType<AuthContext['db']['cohort']['findFirst']>>>;
const cohortDto = (c: CohortRow): CohortDto => ({
  id: c.id,
  specialty: c.specialty,
  entryYear: c.entryYear,
  version: c.version,
});

export async function listCohorts(ctx: AuthContext, cursor: string | undefined, limit: number) {
  const page = toPage(
    await ctx.db.cohort.findMany({ where: { deletedAt: null }, ...pageArgs(cursor, limit) }),
    limit,
  );
  return { items: page.items.map(cohortDto), nextCursor: page.nextCursor };
}

export async function createCohort(ctx: AuthContext, input: CreateCohortInput) {
  const { id, ...data } = input;
  return cohortDto(
    await ctx.db.cohort.create({
      data: { ...data, id: newId(id), organizationId: ctx.organization.id },
    }),
  );
}

export async function updateCohort(ctx: AuthContext, id: string, input: UpdateCohortInput) {
  const { version, ...data } = input;
  const row = await versionedUpdate({
    update: () =>
      ctx.db.cohort.updateMany({
        where: { id, version, deletedAt: null },
        data: { ...definedOnly(data), version: { increment: 1 } },
      }),
    load: () => ctx.db.cohort.findFirst({ where: { id, deletedAt: null } }),
    what: 'Потік',
  });
  return cohortDto(row);
}
