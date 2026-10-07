import {
  assessmentDtoSchema,
  assessmentGradeDtoSchema,
  attendanceMarksSchema,
  createAssessmentSchema,
  createGradeSchema,
  gradebookDtoSchema,
  gradebookQuerySchema,
  idParamSchema,
  lessonDetailDtoSchema,
  setAssessmentGradeSchema,
  todayDtoSchema,
  updateAssessmentSchema,
  updateGradeSchema,
  updateLessonSchema,
} from '@ge/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  assessmentOwner,
  clearAssessmentGrade,
  createAssessment,
  deleteAssessment,
  setAssessmentGrade,
  updateAssessment,
} from './assessments.js';
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
  const byAssessment = (action: Parameters<typeof app.authorize>[0]) =>
    app.authorize(action, async (req) => {
      const ctx = await auth(req);
      return {
        organizationId: ctx.organization.id,
        teacherId: await assessmentOwner(ctx, idOf(req)),
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

  // ── Колонки оцінювання (практичні, модулі) ──
  r.post(
    '/loads/:id/assessments',
    {
      preHandler: byLoad('grade:write'),
      schema: {
        params: idParamSchema,
        body: createAssessmentSchema,
        response: { 201: assessmentDtoSchema },
      },
    },
    async (req, reply) =>
      reply.status(201).send(await createAssessment(await auth(req), req.params.id, req.body)),
  );
  r.patch(
    '/assessments/:id',
    {
      preHandler: byAssessment('grade:write'),
      schema: {
        params: idParamSchema,
        body: updateAssessmentSchema,
        response: { 200: assessmentDtoSchema },
      },
    },
    async (req) => updateAssessment(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/assessments/:id',
    { preHandler: byAssessment('grade:write'), schema: { params: idParamSchema } },
    async (req, reply) => {
      await deleteAssessment(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );
  const gradeParams = z.object({ id: z.uuid(), enrollmentId: z.uuid() });
  r.put(
    '/assessments/:id/grades/:enrollmentId',
    {
      preHandler: byAssessment('grade:write'),
      schema: {
        params: gradeParams,
        body: setAssessmentGradeSchema,
        response: { 200: assessmentGradeDtoSchema },
      },
    },
    async (req) =>
      setAssessmentGrade(await auth(req), req.params.id, req.params.enrollmentId, req.body),
  );
  r.delete(
    '/assessments/:id/grades/:enrollmentId',
    { preHandler: byAssessment('grade:write'), schema: { params: gradeParams } },
    async (req, reply) => {
      await clearAssessmentGrade(await auth(req), req.params.id, req.params.enrollmentId);
      return reply.status(204).send();
    },
  );
}
