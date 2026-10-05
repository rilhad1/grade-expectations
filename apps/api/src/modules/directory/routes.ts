import {
  bellDtoSchema,
  cohortDtoSchema,
  createCohortSchema,
  createDisciplineSchema,
  createRoomSchema,
  disciplineDtoSchema,
  idParamSchema,
  pageOf,
  pageQuerySchema,
  replaceBellsSchema,
  roomDtoSchema,
  updateCohortSchema,
  updateDisciplineSchema,
  updateRoomSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as service from './service.js';

export function directoryRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const read = app.authorize('directory:read');
  const write = app.authorize('structure:write');
  const auth = (req: Parameters<typeof app.requireAuth>[0]) => app.requireAuth(req);

  // ── Дисципліни ──
  r.get(
    '/disciplines',
    {
      preHandler: read,
      schema: { querystring: pageQuerySchema, response: { 200: pageOf(disciplineDtoSchema) } },
    },
    async (req) => service.listDisciplines(await auth(req), req.query.cursor, req.query.limit),
  );
  r.post(
    '/disciplines',
    {
      preHandler: write,
      schema: { body: createDisciplineSchema, response: { 201: disciplineDtoSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createDiscipline(await auth(req), req.body)),
  );
  r.patch(
    '/disciplines/:id',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: updateDisciplineSchema,
        response: { 200: disciplineDtoSchema },
      },
    },
    async (req) => service.updateDiscipline(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/disciplines/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.deleteDiscipline(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );

  // ── Аудиторії ──
  r.get(
    '/rooms',
    {
      preHandler: read,
      schema: { querystring: pageQuerySchema, response: { 200: pageOf(roomDtoSchema) } },
    },
    async (req) => service.listRooms(await auth(req), req.query.cursor, req.query.limit),
  );
  r.post(
    '/rooms',
    { preHandler: write, schema: { body: createRoomSchema, response: { 201: roomDtoSchema } } },
    async (req, reply) =>
      reply.status(201).send(await service.createRoom(await auth(req), req.body)),
  );
  r.patch(
    '/rooms/:id',
    {
      preHandler: write,
      schema: { params: idParamSchema, body: updateRoomSchema, response: { 200: roomDtoSchema } },
    },
    async (req) => service.updateRoom(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/rooms/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.deleteRoom(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );

  // ── Розклад дзвінків ──
  r.get(
    '/bells',
    { preHandler: read, schema: { response: { 200: z.array(bellDtoSchema) } } },
    async (req) => service.listBells(await auth(req)),
  );
  r.put(
    '/bells',
    {
      preHandler: write,
      schema: { body: replaceBellsSchema, response: { 200: z.array(bellDtoSchema) } },
    },
    async (req) => service.replaceBells(await auth(req), req.body),
  );

  // ── Потоки ──
  r.get(
    '/cohorts',
    {
      preHandler: read,
      schema: { querystring: pageQuerySchema, response: { 200: pageOf(cohortDtoSchema) } },
    },
    async (req) => service.listCohorts(await auth(req), req.query.cursor, req.query.limit),
  );
  r.post(
    '/cohorts',
    { preHandler: write, schema: { body: createCohortSchema, response: { 201: cohortDtoSchema } } },
    async (req, reply) =>
      reply.status(201).send(await service.createCohort(await auth(req), req.body)),
  );
  r.patch(
    '/cohorts/:id',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: updateCohortSchema,
        response: { 200: cohortDtoSchema },
      },
    },
    async (req) => service.updateCohort(await auth(req), req.params.id, req.body),
  );
}
