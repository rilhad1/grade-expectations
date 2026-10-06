import { randomBytes } from 'node:crypto';

import { buildIcs, type IcsEvent } from '@ge/domain';
import { uuidv7, type CalendarFeedDto } from '@ge/shared';
import type { PrismaClient } from '@prisma/client';

import { notFound } from '../../errors.js';
import { addDaysIso, dateOf, isoOf } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';

const TIMEZONE = 'Europe/Kyiv';
/** Вікно подій в підписці: трохи минулого й до кінця навчального року. */
const PAST_DAYS = 14;
const FUTURE_DAYS = 240;

export const feedPath = (token: string) => `/api/v1/calendar/${token}.ics`;

const newToken = () => randomBytes(24).toString('base64url');

const toDto = (feed: { token: string; rotatedAt: Date }): CalendarFeedDto => ({
  path: feedPath(feed.token),
  rotatedAt: feed.rotatedAt.toISOString(),
});

/** Посилання створюється при першому зверненні; повторні виклики повертають те саме. */
export async function getFeed(prisma: PrismaClient, ctx: AuthContext): Promise<CalendarFeedDto> {
  const feed =
    (await prisma.calendarFeed.findUnique({ where: { userId: ctx.user.id } })) ??
    (await prisma.calendarFeed.create({
      data: { id: uuidv7(), userId: ctx.user.id, token: newToken() },
    }));
  return toDto(feed);
}

/** Заміна токена: старе посилання перестає працювати. */
export async function rotateFeed(prisma: PrismaClient, ctx: AuthContext): Promise<CalendarFeedDto> {
  const feed = await prisma.calendarFeed.upsert({
    where: { userId: ctx.user.id },
    create: { id: uuidv7(), userId: ctx.user.id, token: newToken() },
    update: { token: newToken(), rotatedAt: new Date() },
  });
  return toDto(feed);
}

/** Публічний ICS за токеном (без сесії): розклад викладача, у т.ч. скасовані пари. */
export async function renderFeed(
  prisma: PrismaClient,
  contextFor: (userId: string) => Promise<AuthContext>,
  token: string,
  now: Date,
): Promise<string> {
  const feed = await prisma.calendarFeed.findUnique({ where: { token } });
  if (!feed) throw notFound('Календар не знайдено');
  const ctx = await contextFor(feed.userId);

  const today = ctx.today();
  const lessons = await ctx.db.lesson.findMany({
    where: {
      teacherId: ctx.user.id,
      deletedAt: null,
      status: { not: 'MOVED' },
      date: {
        gte: dateOf(addDaysIso(today, -PAST_DAYS)),
        lte: dateOf(addDaysIso(today, FUTURE_DAYS)),
      },
    },
    include: {
      room: true,
      topic: true,
      load: { include: { discipline: true, group: true, subgroup: true } },
    },
    orderBy: [{ date: 'asc' }, { pairNumber: 'asc' }],
  });
  const bells = await ctx.db.bellTime.findMany({ where: { deletedAt: null } });

  const events: IcsEvent[] = lessons.flatMap((l) => {
    const bell = bells.find((b) => b.pairNumber === l.pairNumber);
    if (!bell) return [];
    const group = l.load.subgroup
      ? `${l.load.group.name} (${l.load.subgroup.name})`
      : l.load.group.name;
    const topic = l.topicText ?? l.topic?.title;
    return [
      {
        uid: `${l.id}@grade-expectations`,
        date: isoOf(l.date),
        start: bell.startsAt,
        end: bell.endsAt,
        summary: `${l.load.discipline.shortTitle} · ${group}`,
        location: l.room?.name,
        description: topic ? `Тема: ${topic}` : undefined,
        cancelled: l.status === 'CANCELLED',
      },
    ];
  });

  return buildIcs({
    name: `Розклад: ${ctx.user.fullName}`,
    timezone: TIMEZONE,
    events,
    generatedAt: now,
  });
}
