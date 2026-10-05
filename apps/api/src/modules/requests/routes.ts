import {
  approveRequestSchema,
  createRescheduleRequestSchema,
  freeSlotDtoSchema,
  freeSlotsQuerySchema,
  idParamSchema,
  pageOf,
  rejectRequestSchema,
  requestListQuerySchema,
  rescheduleRequestDtoSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { notFound } from '../../errors.js';

import * as service from './service.js';

export function requestRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = (req: Parameters<typeof app.requireAuth>[0]) => app.requireAuth(req);
  const read = app.authorize('directory:read');
  const resolve = app.authorize('request:resolve');

  // Створює запит лише власник заняття (can: request:create + teacherId заняття)
  const create = app.authorize('request:create', async (req) => {
    const ctx = await auth(req);
    const { lessonId } = req.body as { lessonId?: string };
    const lesson = lessonId
      ? await ctx.db.lesson.findFirst({
          where: {
            id: lessonId,
            deletedAt: null,
            load: { semester: { academicYear: { organizationId: ctx.organization.id } } },
          },
        })
      : null;
    if (!lesson) throw notFound('Заняття не знайдено');
    return { organizationId: ctx.organization.id, teacherId: lesson.teacherId };
  });

  r.get(
    '/reschedule-requests',
    {
      preHandler: read,
      schema: {
        querystring: requestListQuerySchema,
        response: { 200: pageOf(rescheduleRequestDtoSchema) },
      },
    },
    async (req) => service.listRequests(await auth(req), req.query),
  );
  r.get(
    '/reschedule-requests/:id',
    {
      preHandler: read,
      schema: { params: idParamSchema, response: { 200: rescheduleRequestDtoSchema } },
    },
    async (req) => service.getRequest(await auth(req), req.params.id),
  );
  r.get(
    '/reschedule-requests/:id/free-slots',
    {
      preHandler: resolve,
      schema: {
        params: idParamSchema,
        querystring: freeSlotsQuerySchema,
        response: { 200: z.array(freeSlotDtoSchema) },
      },
    },
    async (req) => service.freeSlotsForRequest(await auth(req), req.params.id, req.query),
  );
  r.post(
    '/reschedule-requests',
    {
      preHandler: create,
      schema: {
        body: createRescheduleRequestSchema,
        response: { 201: rescheduleRequestDtoSchema },
      },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createRequest(await auth(req), req.body)),
  );
  r.post(
    '/reschedule-requests/:id/approve',
    {
      preHandler: resolve,
      schema: {
        params: idParamSchema,
        body: approveRequestSchema,
        response: { 200: rescheduleRequestDtoSchema },
      },
    },
    async (req) => service.approveRequest(await auth(req), req.params.id, req.body),
  );
  r.post(
    '/reschedule-requests/:id/reject',
    {
      preHandler: resolve,
      schema: {
        params: idParamSchema,
        body: rejectRequestSchema,
        response: { 200: rescheduleRequestDtoSchema },
      },
    },
    async (req) => service.rejectRequest(await auth(req), req.params.id, req.body.comment),
  );
}
