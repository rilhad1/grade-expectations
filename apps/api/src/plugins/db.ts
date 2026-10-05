import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import pg from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    pool: pg.Pool;
  }
}

// TODO: на етапі 1 замінити на Prisma-клієнт; поки лише для перевірки доступності БД.
export const dbPlugin = fp((app: FastifyInstance, opts: { connectionString: string }) => {
  const pool = new pg.Pool({ connectionString: opts.connectionString, max: 5 });
  app.decorate('pool', pool);
  app.addHook('onClose', async () => {
    await pool.end();
  });
});
