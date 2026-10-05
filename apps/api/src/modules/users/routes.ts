import {
  createUserResultSchema,
  createUserSchema,
  pageOf,
  pageQuerySchema,
  updateUserRolesSchema,
  userDtoSchema,
  uuidSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as service from './service.js';

export function userRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  // Список користувачів містить пошту, тому доступний лише деканату
  const write = app.authorize('structure:write');
  const auth = (req: Parameters<typeof app.requireAuth>[0]) => app.requireAuth(req);

  r.get(
    '/users',
    {
      preHandler: write,
      schema: { querystring: pageQuerySchema, response: { 200: pageOf(userDtoSchema) } },
    },
    async (req) => service.listUsers(await auth(req), req.query.cursor, req.query.limit),
  );
  r.post(
    '/users',
    {
      preHandler: write,
      schema: { body: createUserSchema, response: { 201: createUserResultSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createUser(await auth(req), req.body)),
  );
  r.put(
    '/users/:userId/roles',
    {
      preHandler: write,
      schema: {
        params: z.object({ userId: uuidSchema }),
        body: updateUserRolesSchema,
        response: { 200: userDtoSchema },
      },
    },
    async (req) => service.updateUserRoles(await auth(req), req.params.userId, req.body.roles),
  );
}
