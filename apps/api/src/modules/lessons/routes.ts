import {
  cancelLessonSchema,
  createExtraLessonSchema,
  idParamSchema,
  substituteLessonSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as service from './service.js';

/** Винятки для окремих занять (деканат): скасування, заміна викладача, додаткова пара. */
export function lessonExceptionRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const write = app.authorize('schedule:write');
  const auth = (req: Parameters<typeof app.requireAuth>[0]) => app.requireAuth(req);

  r.post(
    '/lessons/:id/cancel',
    { preHandler: write, schema: { params: idParamSchema, body: cancelLessonSchema } },
    async (req, reply) => {
      await service.cancelLesson(await auth(req), req.params.id, req.body.reason);
      return reply.status(204).send();
    },
  );
  r.post(
    '/lessons/:id/substitute',
    { preHandler: write, schema: { params: idParamSchema, body: substituteLessonSchema } },
    async (req, reply) => {
      await service.substituteLesson(await auth(req), req.params.id, req.body.teacherId);
      return reply.status(204).send();
    },
  );
  r.post(
    '/lessons',
    {
      preHandler: write,
      schema: { body: createExtraLessonSchema, response: { 201: z.object({ id: z.uuid() }) } },
    },
    async (req, reply) =>
      reply.status(201).send({ id: await service.createExtraLesson(await auth(req), req.body) }),
  );
}
