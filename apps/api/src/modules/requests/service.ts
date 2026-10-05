import {
  uuidv7,
  type ApproveRequestInput,
  type CreateRescheduleRequestInput,
  type FreeSlotDto,
  type RescheduleRequestDto,
} from '@ge/shared';
import type { Prisma } from '@prisma/client';

import { conflict, notFound, unprocessable } from '../../errors.js';
import { addDaysIso, dateOf, isoOf, newId, pageArgs, toPage } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';
import { assertSlotFree, freeSlotsFor, semesterInputOf } from '../lessons/availability.js';
import { semesterScope } from '../semesters/repo.js';

const isModerator = (ctx: AuthContext) => ctx.roles.includes('MODERATOR');

const include = {
  lesson: { include: { load: { include: { discipline: true, group: true, subgroup: true } } } },
} satisfies Prisma.RescheduleRequestInclude;

type RequestRow = Prisma.RescheduleRequestGetPayload<{ include: typeof include }>;

async function usersById(ctx: AuthContext, ids: string[]) {
  const users = await ctx.db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

async function toDtos(ctx: AuthContext, rows: RequestRow[]): Promise<RescheduleRequestDto[]> {
  const people = await usersById(ctx, [
    ...new Set(rows.flatMap((r) => [r.requestedById, ...(r.resolvedById ? [r.resolvedById] : [])])),
  ]);
  const person = (id: string) => people.get(id) ?? { id, fullName: '—' };
  return rows.map((r) => ({
    id: r.id,
    lessonId: r.lessonId,
    status: r.status,
    reason: r.reason,
    proposedDate: isoOf(r.proposedDate),
    proposedPair: r.proposedPair,
    proposedRoomId: r.proposedRoomId,
    resolverComment: r.resolverComment,
    createdAt: r.createdAt.toISOString(),
    requestedBy: person(r.requestedById),
    resolvedBy: r.resolvedById ? person(r.resolvedById) : null,
    lesson: {
      date: isoOf(r.lesson.date),
      pairNumber: r.lesson.pairNumber,
      kind: r.lesson.load.kind,
      discipline: {
        id: r.lesson.load.discipline.id,
        title: r.lesson.load.discipline.title,
        shortTitle: r.lesson.load.discipline.shortTitle,
        color: r.lesson.load.discipline.color,
      },
      group: { id: r.lesson.load.group.id, name: r.lesson.load.group.name },
      subgroup: r.lesson.load.subgroup
        ? { id: r.lesson.load.subgroup.id, name: r.lesson.load.subgroup.name }
        : null,
    },
    version: r.version,
  }));
}

const requestScope = (ctx: AuthContext): Prisma.RescheduleRequestWhereInput => ({
  deletedAt: null,
  lesson: { load: { semester: semesterScope(ctx.organization.id) } },
  // Викладач бачить лише власні запити
  ...(!isModerator(ctx) && { requestedById: ctx.user.id }),
});

async function findRequest(ctx: AuthContext, id: string): Promise<RequestRow> {
  const row = await ctx.db.rescheduleRequest.findFirst({
    where: { id, ...requestScope(ctx) },
    include,
  });
  if (!row) throw notFound('Запит не знайдено');
  return row;
}

export async function listRequests(
  ctx: AuthContext,
  filter: {
    cursor?: string | undefined;
    limit: number;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
  },
) {
  const rows = await ctx.db.rescheduleRequest.findMany({
    where: { ...requestScope(ctx), ...(filter.status !== undefined && { status: filter.status }) },
    include,
    ...pageArgs(filter.cursor, filter.limit),
  });
  const page = toPage(rows, filter.limit);
  return { items: await toDtos(ctx, page.items), nextCursor: page.nextCursor };
}

export async function getRequest(ctx: AuthContext, id: string): Promise<RescheduleRequestDto> {
  const [dto] = await toDtos(ctx, [await findRequest(ctx, id)]);
  if (!dto) throw notFound('Запит не знайдено');
  return dto;
}

/** Заняття, яке можна переносити, разом з даними для перевірки вільних слотів. */
async function movableLesson(ctx: AuthContext, lessonId: string) {
  const lesson = await ctx.db.lesson.findFirst({
    where: {
      id: lessonId,
      deletedAt: null,
      load: { semester: semesterScope(ctx.organization.id) },
    },
    include: { load: true },
  });
  if (!lesson) throw notFound('Заняття не знайдено');
  return lesson;
}

export async function createRequest(
  ctx: AuthContext,
  input: CreateRescheduleRequestInput,
): Promise<RescheduleRequestDto> {
  const lesson = await movableLesson(ctx, input.lessonId);
  if (lesson.teacherId !== ctx.user.id) throw notFound('Заняття не знайдено');
  if (lesson.status !== 'PLANNED' || isoOf(lesson.date) < ctx.today()) {
    throw conflict('LESSON_NOT_MOVABLE', 'Переносити можна лише майбутні заплановані заняття');
  }

  const semester = await semesterInputOf(ctx, lesson.load.semesterId);
  if (
    !semester ||
    input.proposedDate < semester.startDate ||
    input.proposedDate > semester.endDate
  ) {
    throw unprocessable('DATE_OUT_OF_SEMESTER', 'Бажана дата виходить за межі семестру');
  }
  if (input.proposedDate < ctx.today())
    throw unprocessable('DATE_IN_PAST', 'Бажана дата вже минула');
  const pair = await ctx.db.bellTime.findFirst({
    where: { pairNumber: input.proposedPair, deletedAt: null },
  });
  if (!pair)
    throw unprocessable('UNKNOWN_PAIR', `Пари №${input.proposedPair} немає в розкладі дзвінків`);
  if (input.proposedRoomId) {
    const room = await ctx.db.room.findFirst({
      where: { id: input.proposedRoomId, deletedAt: null },
    });
    if (!room) throw unprocessable('ROOM_NOT_FOUND', 'Аудиторію не знайдено');
  }

  const pending = await ctx.db.rescheduleRequest.findFirst({
    where: { lessonId: lesson.id, status: 'PENDING', deletedAt: null },
  });
  if (pending) throw conflict('REQUEST_PENDING', 'Для цього заняття вже є запит на розгляді');

  const id = newId(input.id);
  await ctx.db.rescheduleRequest.create({
    data: {
      id,
      lessonId: lesson.id,
      requestedById: ctx.user.id,
      proposedDate: dateOf(input.proposedDate),
      proposedPair: input.proposedPair,
      proposedRoomId: input.proposedRoomId,
      reason: input.reason,
    },
  });
  return getRequest(ctx, id);
}

/** Підказка деканату: слоти, де група, викладач і аудиторія одночасно вільні. */
export async function freeSlotsForRequest(
  ctx: AuthContext,
  id: string,
  window: { from?: string | undefined; to?: string | undefined },
): Promise<FreeSlotDto[]> {
  const request = await findRequest(ctx, id);
  const proposed = isoOf(request.proposedDate);
  const from = window.from ?? addDaysIso(proposed, -7);
  const to = window.to ?? addDaysIso(proposed, 7);
  const free = await freeSlotsFor(
    ctx,
    { id: request.lessonId, teacherId: request.lesson.teacherId, load: request.lesson.load },
    { from, to },
  );
  const distance = (d: string) => Math.abs(Date.parse(d) - Date.parse(proposed));
  return free
    .filter((s) => s.date >= ctx.today())
    .sort(
      (a, b) =>
        distance(a.date) - distance(b.date) ||
        a.date.localeCompare(b.date) ||
        a.pairNumber - b.pairNumber,
    )
    .slice(0, 100);
}

export async function approveRequest(
  ctx: AuthContext,
  id: string,
  input: ApproveRequestInput,
): Promise<RescheduleRequestDto> {
  const request = await findRequest(ctx, id);
  if (request.status !== 'PENDING') throw conflict('REQUEST_NOT_PENDING', 'Запит уже розглянуто');
  const lesson = request.lesson;
  if (lesson.status !== 'PLANNED' || lesson.deletedAt !== null) {
    throw conflict('LESSON_NOT_MOVABLE', 'Заняття вже не можна перенести');
  }

  const target = {
    date: input.date ?? isoOf(request.proposedDate),
    pairNumber: input.pairNumber ?? request.proposedPair,
    roomId: input.roomId === undefined ? request.proposedRoomId : input.roomId,
  };
  await assertSlotFree(
    ctx,
    { id: lesson.id, teacherId: lesson.teacherId, load: lesson.load },
    target,
  );

  await ctx.db.$transaction(async (tx) => {
    const claimed = await tx.rescheduleRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        resolvedById: ctx.user.id,
        resolverComment: input.comment,
        version: { increment: 1 },
      },
    });
    if (claimed.count === 0) throw conflict('REQUEST_NOT_PENDING', 'Запит уже розглянуто');

    // Оригінал лишається як «перенесене» (щоб повторна генерація не створила його знову),
    // а нове заняття стає окремим записом на новий час.
    await tx.lesson.update({
      where: { id: lesson.id },
      data: {
        status: 'MOVED',
        note: `Перенесено на ${target.date}, пара ${target.pairNumber}`,
        version: { increment: 1 },
      },
    });

    const data = {
      loadId: lesson.loadId,
      slotId: null,
      teacherId: lesson.teacherId,
      scheduleVersion: lesson.scheduleVersion,
      date: dateOf(target.date),
      pairNumber: target.pairNumber,
      roomId: target.roomId,
      hours: lesson.hours,
      status: 'PLANNED' as const,
      topicId: lesson.topicId,
      topicText: lesson.topicText,
      homework: lesson.homework,
      note: lesson.note,
      manuallyEdited: true,
    };
    const occupant = await tx.lesson.findFirst({
      where: { loadId: lesson.loadId, date: dateOf(target.date), pairNumber: target.pairNumber },
    });
    if (occupant && occupant.deletedAt === null && occupant.status !== 'CANCELLED') {
      throw conflict('SLOT_NOT_FREE', 'На цей час у навантаження вже є заняття');
    }
    if (occupant) {
      // Раніше скасоване/видалене заняття на цьому ключі відновлюємо замість створення нового
      await tx.lesson.update({
        where: { id: occupant.id },
        data: { ...data, deletedAt: null, version: { increment: 1 } },
      });
    } else {
      await tx.lesson.create({ data: { id: uuidv7(), ...data } });
    }
  });
  return getRequest(ctx, id);
}

export async function rejectRequest(
  ctx: AuthContext,
  id: string,
  comment: string,
): Promise<RescheduleRequestDto> {
  await findRequest(ctx, id);
  const { count } = await ctx.db.rescheduleRequest.updateMany({
    where: { id, status: 'PENDING', deletedAt: null },
    data: {
      status: 'REJECTED',
      resolvedById: ctx.user.id,
      resolverComment: comment,
      version: { increment: 1 },
    },
  });
  if (count === 0) throw conflict('REQUEST_NOT_PENDING', 'Запит уже розглянуто');
  return getRequest(ctx, id);
}
