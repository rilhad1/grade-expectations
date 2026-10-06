import {
  attendanceMarksSchema,
  createGradeSchema,
  gradebookDtoSchema,
  gradebookQuerySchema,
  idParamSchema,
  lessonDetailDtoSchema,
  todayDtoSchema,
  updateGradeSchema,
  updateLessonSchema,
} from '@ge/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { getGradebook, loadOwner } from './gradebook.js';
import * as service from './service.js';
import { getToday } from './today.js';

export function journalRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = (req: FastifyRequest) => app.requireAuth(req);
  const idOf = (req: FastifyRequest) => (req.params as { id: string }).id;

  /** Права за власником заняття (хто веде фактично) або навантаження (власник журналу). */
  const byLesson = (action: Parameters<typeof app.authorize>[0]) =>
    app.authorize(action, async (req) => {
      const ctx = await auth(req);
      return {
        organizationId: ctx.organization.id,
        teacherId: await service.lessonOwner(ctx, idOf(req)),
      };
    });
  const byGrade = (action: Parameters<typeof app.authorize>[0]) =>
    app.authorize(action, async (req) => {
      const ctx = await auth(req);
      return {
        organizationId: ctx.organization.id,
        teacherId: await service.gradeOwner(ctx, idOf(req)),
      };
    });
  const byLoad = (action: Parameters<typeof app.authorize>[0]) =>
    app.authorize(action, async (req) => {
      const ctx = await auth(req);
      return { organizationId: ctx.organization.id, teacherId: await loadOwner(ctx, idOf(req)) };
    });

  r.get(
    '/today',
    { preHandler: app.authorize('directory:read'), schema: { response: { 200: todayDtoSchema } } },
    async (req) => getToday(await auth(req)),
  );

  // ── Заняття «На парі» ──
  r.get(
    '/lessons/:id',
    {
      preHandler: byLesson('gradebook:read'),
      schema: { params: idParamSchema, response: { 200: lessonDetailDtoSchema } },
    },
    async (req) => service.getLessonDetail(await auth(req), req.params.id),
  );
  r.patch(
    '/lessons/:id',
    {
      preHandler: byLesson('lesson:update'),
      schema: {
        params: idParamSchema,
        body: updateLessonSchema,
        response: { 200: lessonDetailDtoSchema },
      },
    },
    async (req) => service.updateLesson(await auth(req), req.params.id, req.body),
  );
  r.post(
    '/lessons/:id/finish',
    {
      preHandler: byLesson('lesson:update'),
      schema: { params: idParamSchema, response: { 200: lessonDetailDtoSchema } },
    },
    async (req) => service.finishLesson(await auth(req), req.params.id),
  );
  r.post(
    '/lessons/:id/reopen',
    {
      preHandler: byLesson('lesson:update'),
      schema: { params: idParamSchema, response: { 200: lessonDetailDtoSchema } },
    },
    async (req) => service.reopenLesson(await auth(req), req.params.id),
  );
  r.put(
    '/lessons/:id/attendance',
    {
      preHandler: byLesson('attendance:write'),
      schema: {
        params: idParamSchema,
        body: attendanceMarksSchema,
        response: { 200: lessonDetailDtoSchema },
      },
    },
    async (req) => service.markAttendance(await auth(req), req.params.id, req.body),
  );
  r.post(
    '/lessons/:id/grades',
    {
      preHandler: byLesson('grade:write'),
      schema: {
        params: idParamSchema,
        body: createGradeSchema,
        response: { 201: lessonDetailDtoSchema },
      },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createGrade(await auth(req), req.params.id, req.body)),
  );
  r.patch(
    '/grades/:id',
    {
      preHandler: byGrade('grade:write'),
      schema: {
        params: idParamSchema,
        body: updateGradeSchema,
        response: { 200: lessonDetailDtoSchema },
      },
    },
    async (req) => service.updateGrade(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/grades/:id',
    {
      preHandler: byGrade('grade:write'),
      schema: { params: idParamSchema, response: { 200: lessonDetailDtoSchema } },
    },
    async (req) => service.deleteGrade(await auth(req), req.params.id),
  );

  // ── Журнал ──
  r.get(
    '/loads/:id/gradebook',
    {
      preHandler: byLoad('gradebook:read'),
      schema: {
        params: idParamSchema,
        querystring: gradebookQuerySchema,
        response: { 200: gradebookDtoSchema },
      },
    },
    async (req) => getGradebook(await auth(req), req.params.id, req.query),
  );
}
