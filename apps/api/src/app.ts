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
import { attestationRoutes } from './modules/attestations/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { calendarRoutes } from './modules/calendar/routes.js';
import { directoryRoutes } from './modules/directory/routes.js';
import { documentRoutes } from './modules/documents/routes.js';
import { groupRoutes } from './modules/groups/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { journalRoutes } from './modules/journal/routes.js';
import { lessonExceptionRoutes } from './modules/lessons/routes.js';
import { loadRoutes } from './modules/loads/routes.js';
import { meRoutes } from './modules/me/routes.js';
import { programRoutes } from './modules/programs/routes.js';
import { requestRoutes } from './modules/requests/routes.js';
import { scheduleRoutes } from './modules/schedules/routes.js';
import { semesterRoutes } from './modules/semesters/routes.js';
import { syncRoutes } from './modules/sync/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { errorsPlugin } from './plugins/errors.js';
import { jobsPlugin } from './plugins/jobs.js';
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
  // preHandler: ключ ліміту входу використовує email з тіла запиту
  await app.register(rateLimit, { global: false, hook: 'preHandler' });
  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(errorsPlugin);
  await app.register(sessionPlugin, { env });
  await app.register(permissionsPlugin);
  await app.register(jobsPlugin, { env });
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1', signInLimit: env.AUTH_SIGNIN_LIMIT });
  await app.register(semesterRoutes, { prefix: '/api/v1' });
  await app.register(directoryRoutes, { prefix: '/api/v1' });
  await app.register(groupRoutes, { prefix: '/api/v1' });
  await app.register(userRoutes, { prefix: '/api/v1' });
  await app.register(loadRoutes, { prefix: '/api/v1' });
  await app.register(scheduleRoutes, { prefix: '/api/v1' });
  await app.register(lessonExceptionRoutes, { prefix: '/api/v1' });
  await app.register(requestRoutes, { prefix: '/api/v1' });
  await app.register(journalRoutes, { prefix: '/api/v1' });
  await app.register(programRoutes, { prefix: '/api/v1' });
  await app.register(attestationRoutes, { prefix: '/api/v1' });
  await app.register(calendarRoutes, { prefix: '/api/v1' });
  await app.register(syncRoutes, { prefix: '/api/v1' });
  await app.register(documentRoutes, { prefix: '/api/v1', gotenbergUrl: env.GOTENBERG_URL });
  await app.register(meRoutes, {
    prefix: '/api/v1',
    googleEnabled: env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined,
    pdfEnabled: env.GOTENBERG_URL !== undefined,
  });

  app.get('/api/v1/openapi.json', () => app.swagger());

  return app;
}
