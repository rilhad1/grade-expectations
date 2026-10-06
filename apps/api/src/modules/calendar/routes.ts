import { calendarFeedDtoSchema } from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { notFound } from '../../errors.js';

import * as service from './service.js';

const TOKEN_FILE = /^([A-Za-z0-9_-]{16,64})\.ics$/;

export function calendarRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/me/calendar', { schema: { response: { 200: calendarFeedDtoSchema } } }, async (req) =>
    service.getFeed(app.prisma, await app.requireAuth(req)),
  );
  r.post(
    '/me/calendar/rotate',
    { schema: { response: { 200: calendarFeedDtoSchema } } },
    async (req) => service.rotateFeed(app.prisma, await app.requireAuth(req)),
  );

  // Публічний маршрут: календарні клієнти не передають cookie, доступ — за секретним токеном
  r.get(
    '/calendar/:file',
    { schema: { params: z.object({ file: z.string() }) } },
    async (req, reply) => {
      const token = TOKEN_FILE.exec(req.params.file)?.[1];
      if (!token) throw notFound('Календар не знайдено');
      const ics = await service.renderFeed(
        app.prisma,
        (userId) => app.contextFor(userId),
        token,
        new Date(),
      );
      return reply
        .header('content-type', 'text/calendar; charset=utf-8')
        .header('cache-control', 'private, max-age=300')
        .send(ics);
    },
  );
}
