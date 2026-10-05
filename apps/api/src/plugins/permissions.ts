import { can, type Action, type Resource } from '@ge/domain';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { forbidden } from '../errors.js';

type ResourceResolver = (request: FastifyRequest) => Resource | Promise<Resource>;

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * preHandler: автентифікація + перевірка can(). Права на сервері — єдине джерело істини,
     * клієнт лише ховає недоступні дії. Ресурс за замовчуванням — поточний коледж.
     */
    authorize: (
      action: Action,
      resolve?: ResourceResolver,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const permissionsPlugin = fp((app: FastifyInstance) => {
  app.decorate('authorize', (action: Action, resolve?: ResourceResolver) => {
    return async (request: FastifyRequest): Promise<void> => {
      const ctx = await app.requireAuth(request);
      const resource = resolve ? await resolve(request) : { organizationId: ctx.organization.id };
      const allowed = can(
        { userId: ctx.user.id, organizationId: ctx.organization.id, roles: ctx.roles },
        action,
        resource,
      );
      if (!allowed) throw forbidden(`Дія ${action} недоступна`);
    };
  });
});
