import {
  academicYearDtoSchema,
  cloneSemesterResultSchema,
  createAcademicYearSchema,
  createSemesterSchema,
  idParamSchema,
  pageOf,
  pageQuerySchema,
  semesterDtoSchema,
  semesterListQuerySchema,
  updateAcademicYearSchema,
  updateSemesterSchema,
  uuidSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import * as service from './service.js';

export function semesterRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const read = app.authorize('directory:read');
  const write = app.authorize('structure:write');

  // ── Навчальні роки ──
  r.get(
    '/academic-years',
    {
      preHandler: read,
      schema: { querystring: pageQuerySchema, response: { 200: pageOf(academicYearDtoSchema) } },
    },
    async (req) => service.listYears(await app.requireAuth(req), req.query.cursor, req.query.limit),
  );

  r.post(
    '/academic-years',
    {
      preHandler: write,
      schema: { body: createAcademicYearSchema, response: { 201: academicYearDtoSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createYear(await app.requireAuth(req), req.body)),
  );

  r.patch(
    '/academic-years/:id',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: updateAcademicYearSchema,
        response: { 200: academicYearDtoSchema },
      },
    },
    async (req) => service.updateYear(await app.requireAuth(req), req.params.id, req.body),
  );

  // ── Семестри ──
  r.get(
    '/semesters',
    {
      preHandler: read,
      schema: {
        querystring: semesterListQuerySchema,
        response: { 200: z.array(semesterDtoSchema) },
      },
    },
    async (req) => service.listSemesters(await app.requireAuth(req), req.query),
  );

  r.get(
    '/semesters/:id',
    { preHandler: read, schema: { params: idParamSchema, response: { 200: semesterDtoSchema } } },
    async (req) => service.getSemester(await app.requireAuth(req), req.params.id),
  );

  r.post(
    '/semesters',
    {
      preHandler: write,
      schema: { body: createSemesterSchema, response: { 201: semesterDtoSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createSemester(await app.requireAuth(req), req.body)),
  );

  r.patch(
    '/semesters/:id',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: updateSemesterSchema,
        response: { 200: semesterDtoSchema },
      },
    },
    async (req) => service.updateSemester(await app.requireAuth(req), req.params.id, req.body),
  );

  r.post(
    '/semesters/:id/activate',
    { preHandler: write, schema: { params: idParamSchema, response: { 200: semesterDtoSchema } } },
    async (req) => service.activateSemester(await app.requireAuth(req), req.params.id),
  );

  r.post(
    '/semesters/:id/close',
    { preHandler: write, schema: { params: idParamSchema, response: { 200: semesterDtoSchema } } },
    async (req) => service.closeSemester(await app.requireAuth(req), req.params.id),
  );

  r.post(
    '/semesters/:id/clone-from/:sourceId',
    {
      preHandler: write,
      schema: {
        params: z.object({ id: uuidSchema, sourceId: uuidSchema }),
        response: { 200: cloneSemesterResultSchema },
      },
    },
    async (req) =>
      service.cloneSemester(await app.requireAuth(req), req.params.id, req.params.sourceId),
  );
}
