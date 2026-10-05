import {
  conflictDtoSchema,
  createScheduleSchema,
  createSlotSchema,
  idParamSchema,
  lessonItemDtoSchema,
  lessonListQuerySchema,
  publishResultSchema,
  publishSchema,
  scheduleDetailDtoSchema,
  scheduleDtoSchema,
  scheduleListQuerySchema,
  slotDtoSchema,
  updateSlotSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as service from './service.js';

export function scheduleRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const write = app.authorize('schedule:write');
  const publish = app.authorize('schedule:publish');
  const auth = (req: Parameters<typeof app.requireAuth>[0]) => app.requireAuth(req);

  // Читання: викладач бачить лише опубліковане (фільтрація в сервісі, права — тут)
  const readList = app.authorize('schedule:read', async (req) => ({
    organizationId: (await auth(req)).organization.id,
    scheduleStatus: 'PUBLISHED' as const,
  }));
  const readOne = app.authorize('schedule:read', async (req) => {
    const ctx = await auth(req);
    const { id } = req.params as { id: string };
    return {
      organizationId: ctx.organization.id,
      scheduleStatus: await service.scheduleStatusOf(ctx, id),
    };
  });

  r.get(
    '/schedules',
    {
      preHandler: readList,
      schema: {
        querystring: scheduleListQuerySchema,
        response: { 200: z.array(scheduleDtoSchema) },
      },
    },
    async (req) => service.listSchedules(await auth(req), req.query.semesterId),
  );
  r.get(
    '/schedules/:id',
    {
      preHandler: readOne,
      schema: { params: idParamSchema, response: { 200: scheduleDetailDtoSchema } },
    },
    async (req) => service.getSchedule(await auth(req), req.params.id),
  );
  r.get(
    '/schedules/:id/conflicts',
    {
      preHandler: write,
      schema: { params: idParamSchema, response: { 200: z.array(conflictDtoSchema) } },
    },
    async (req) => service.getConflicts(await auth(req), req.params.id),
  );

  r.post(
    '/schedules',
    {
      preHandler: write,
      schema: { body: createScheduleSchema, response: { 201: scheduleDetailDtoSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createSchedule(await auth(req), req.body)),
  );
  r.delete(
    '/schedules/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.discardSchedule(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );
  r.post(
    '/schedules/:id/publish',
    {
      preHandler: publish,
      schema: {
        params: idParamSchema,
        body: publishSchema,
        response: { 200: publishResultSchema },
      },
    },
    async (req) => service.publishSchedule(await auth(req), req.params.id, req.body.dryRun),
  );

  r.post(
    '/schedules/:id/slots',
    {
      preHandler: write,
      schema: { params: idParamSchema, body: createSlotSchema, response: { 201: slotDtoSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createSlot(await auth(req), req.params.id, req.body)),
  );
  r.patch(
    '/schedule-slots/:id',
    {
      preHandler: write,
      schema: { params: idParamSchema, body: updateSlotSchema, response: { 200: slotDtoSchema } },
    },
    async (req) => service.updateSlot(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/schedule-slots/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.deleteSlot(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );

  // ── Заняття ──
  r.get(
    '/lessons',
    {
      preHandler: readList,
      schema: {
        querystring: lessonListQuerySchema,
        response: { 200: z.array(lessonItemDtoSchema) },
      },
    },
    async (req) => service.listLessons(await auth(req), req.query),
  );
}
