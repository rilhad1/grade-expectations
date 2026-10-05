import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// TODO(етап 2): Prisma-розширення, що додає organizationId до кожного запиту (tenant-ізоляція).
export const prismaPlugin = fp((app: FastifyInstance, opts: { databaseUrl: string }) => {
  const prisma = new PrismaClient({ datasourceUrl: opts.databaseUrl });
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
