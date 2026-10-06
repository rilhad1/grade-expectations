import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PgBoss } from 'pg-boss';

import type { Env } from '../env.js';
import { processDocument } from '../modules/documents/service.js';

export const DOCUMENTS_QUEUE = 'documents';

declare module 'fastify' {
  interface FastifyInstance {
    jobs: {
      /** Ставить формування документа в чергу. */
      enqueue: (documentId: string) => Promise<void>;
      /** Чекає завершення поточних inline-задач (для тестів). */
      idle: () => Promise<void>;
    };
  }
}

/**
 * Фонові задачі. pg-boss тримає чергу в тій самій Postgres, тож нових сервісів не потрібно.
 * Драйвер inline виконує задачу в процесі одразу (тести, локальна розробка без черги).
 */
export const jobsPlugin = fp(async (app: FastifyInstance, opts: { env: Env }) => {
  const run = (documentId: string) =>
    processDocument(
      (userId) => app.contextFor(userId),
      app.prisma,
      documentId,
      opts.env.GOTENBERG_URL,
      app.log,
    );

  if (opts.env.JOBS_DRIVER === 'inline') {
    const running = new Set<Promise<void>>();
    app.decorate('jobs', {
      enqueue: (documentId: string) => {
        const task = run(documentId).finally(() => running.delete(task));
        running.add(task);
        return Promise.resolve();
      },
      idle: async () => {
        await Promise.all(running);
      },
    });
    return;
  }

  // pg не знає параметра ?schema= з рядка Prisma
  const url = new URL(opts.env.DATABASE_URL);
  url.searchParams.delete('schema');
  const boss = new PgBoss({ connectionString: url.toString(), schema: opts.env.PGBOSS_SCHEMA });
  boss.on('error', (error) => {
    app.log.error({ err: error }, 'pg-boss');
  });
  await boss.start();
  await boss.createQueue(DOCUMENTS_QUEUE);
  await boss.work<{ documentId: string }>(DOCUMENTS_QUEUE, async (jobs) => {
    for (const job of jobs) await run(job.data.documentId);
  });
  app.decorate('jobs', {
    enqueue: async (documentId: string) => {
      await boss.send(DOCUMENTS_QUEUE, { documentId });
    },
    idle: () => Promise.resolve(),
  });
  app.addHook('onClose', async () => {
    await boss.stop({ graceful: true, timeout: 10_000 });
  });
});
