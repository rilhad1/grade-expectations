import { healthResponseSchema } from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

export function healthRoutes(app: FastifyInstance): void {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get('/health', { schema: { response: { 200: healthResponseSchema } } }, async () => {
      let db: 'ok' | 'down' = 'ok';
      try {
        await app.prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        app.log.error({ err: error }, 'перевірка БД не пройшла');
        db = 'down';
      }
      return { status: 'ok' as const, db };
    });
}
