import { meResponseSchema, publicConfigSchema } from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
export function meRoutes(app: FastifyInstance, opts: { googleEnabled: boolean }): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get('/me', { schema: { response: { 200: meResponseSchema } } }, async (request) => {
    const ctx = await app.requireAuth(request);
    return { user: ctx.user, organization: ctx.organization, roles: [...ctx.roles] };
  });

  // Налаштування, потрібні до входу (екран логіну)
  typed.get('/public-config', { schema: { response: { 200: publicConfigSchema } } }, () => ({
    googleEnabled: opts.googleEnabled,
  }));
}
