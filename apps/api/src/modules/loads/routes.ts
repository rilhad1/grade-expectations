import {
  createLoadSchema,
  idParamSchema,
  loadDtoSchema,
  loadListQuerySchema,
  pageOf,
  updateLoadSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import * as service from './service.js';

export function loadRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const read = app.authorize('load:read');
  const write = app.authorize('load:write');
  const auth = (req: Parameters<typeof app.requireAuth>[0]) => app.requireAuth(req);

  r.get(
    '/loads',
    {
      preHandler: read,
      schema: { querystring: loadListQuerySchema, response: { 200: pageOf(loadDtoSchema) } },
    },
    async (req) => service.listLoads(await auth(req), req.query),
  );
  r.get(
    '/loads/:id',
    { preHandler: read, schema: { params: idParamSchema, response: { 200: loadDtoSchema } } },
    async (req) => service.getLoad(await auth(req), req.params.id),
  );
  r.post(
    '/loads',
    { preHandler: write, schema: { body: createLoadSchema, response: { 201: loadDtoSchema } } },
    async (req, reply) =>
      reply.status(201).send(await service.createLoad(await auth(req), req.body)),
  );
  r.patch(
    '/loads/:id',
    {
      preHandler: write,
      schema: { params: idParamSchema, body: updateLoadSchema, response: { 200: loadDtoSchema } },
    },
    async (req) => service.updateLoad(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/loads/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.deleteLoad(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );
}
