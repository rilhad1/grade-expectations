import {
  pullQuerySchema,
  pullResponseSchema,
  pushRequestSchema,
  pushResponseSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import * as service from './service.js';

/**
 * Синхронізація офлайн-змін «На парі». Права перевіряються для кожної операції окремо,
 * тому на рівні маршруту потрібна лише автентифікація.
 */
export function syncRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/sync/push',
    { schema: { body: pushRequestSchema, response: { 200: pushResponseSchema } } },
    async (req) => service.push(await app.requireAuth(req), req.body.ops),
  );
  r.get(
    '/sync/pull',
    { schema: { querystring: pullQuerySchema, response: { 200: pullResponseSchema } } },
    async (req) => service.pull(await app.requireAuth(req), req.query.since),
  );
}
