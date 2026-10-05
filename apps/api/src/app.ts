import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import type { Env } from './env.js';
import { authRoutes } from './modules/auth/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { meRoutes } from './modules/me/routes.js';
import { semesterRoutes } from './modules/semesters/routes.js';
import { errorsPlugin } from './plugins/errors.js';
import { permissionsPlugin } from './plugins/permissions.js';
import { prismaPlugin } from './plugins/prisma.js';
import { sessionPlugin } from './plugins/session.js';

export async function buildApp(env: Env): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: { openapi: '3.1.0', info: { title: 'Grade Expectations API', version: '0.0.0' } },
    transform: jsonSchemaTransform,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(errorsPlugin);
  await app.register(sessionPlugin, { env });
  await app.register(permissionsPlugin);
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(semesterRoutes, { prefix: '/api/v1' });
  await app.register(meRoutes, {
    prefix: '/api/v1',
    googleEnabled: env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined,
  });

  app.get('/api/v1/openapi.json', () => app.swagger());

  return app;
}
