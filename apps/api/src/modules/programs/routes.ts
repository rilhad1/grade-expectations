import {
  idParamSchema,
  loadDtoSchema,
  replaceTopicsSchema,
  topicPlanDtoSchema,
  updateGradingRulesSchema,
} from '@ge/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { loadOwner } from '../journal/gradebook.js';

import * as service from './service.js';

export function programRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = (req: FastifyRequest) => app.requireAuth(req);
  const byLoad = (action: Parameters<typeof app.authorize>[0]) =>
    app.authorize(action, async (req) => {
      const ctx = await auth(req);
      return {
        organizationId: ctx.organization.id,
        teacherId: await loadOwner(ctx, (req.params as { id: string }).id),
      };
    });

  r.get(
    '/loads/:id/topics',
    {
      preHandler: byLoad('gradebook:read'),
      schema: { params: idParamSchema, response: { 200: topicPlanDtoSchema } },
    },
    async (req) => service.getTopicPlan(await auth(req), req.params.id),
  );
  r.put(
    '/loads/:id/topics',
    {
      preHandler: byLoad('program:write'),
      schema: {
        params: idParamSchema,
        body: replaceTopicsSchema,
        response: { 200: topicPlanDtoSchema },
      },
    },
    async (req) => service.replaceTopics(await auth(req), req.params.id, req.body.topics),
  );
  r.put(
    '/loads/:id/grading-rules',
    {
      preHandler: byLoad('gradingRules:write'),
      schema: {
        params: idParamSchema,
        body: updateGradingRulesSchema,
        response: { 200: loadDtoSchema },
      },
    },
    async (req) => service.updateGradingRules(await auth(req), req.params.id, req.body.rules),
  );
}
