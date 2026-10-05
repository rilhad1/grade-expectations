import {
  createEnrollmentSchema,
  createGroupSchema,
  createStudentSchema,
  createSubgroupSchema,
  enrollmentDtoSchema,
  groupDetailDtoSchema,
  groupDtoSchema,
  groupListQuerySchema,
  idParamSchema,
  importStudentsResultSchema,
  importStudentsSchema,
  pageOf,
  pageQuerySchema,
  promoteGroupsResultSchema,
  promoteGroupsSchema,
  studentDtoSchema,
  studentListQuerySchema,
  subgroupDtoSchema,
  updateEnrollmentSchema,
  updateGroupSchema,
  updateStudentSchema,
  updateSubgroupSchema,
} from '@ge/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import * as service from './service.js';

export function groupRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const read = app.authorize('directory:read');
  const write = app.authorize('structure:write');
  const auth = (req: Parameters<typeof app.requireAuth>[0]) => app.requireAuth(req);

  // ── Групи ──
  r.get(
    '/groups',
    {
      preHandler: read,
      schema: {
        querystring: pageQuerySchema.extend(groupListQuerySchema.shape),
        response: { 200: pageOf(groupDtoSchema) },
      },
    },
    async (req) => service.listGroups(await auth(req), req.query),
  );
  r.get(
    '/groups/:id',
    {
      preHandler: read,
      schema: { params: idParamSchema, response: { 200: groupDetailDtoSchema } },
    },
    async (req) => service.getGroup(await auth(req), req.params.id),
  );
  r.post(
    '/groups',
    { preHandler: write, schema: { body: createGroupSchema, response: { 201: groupDtoSchema } } },
    async (req, reply) =>
      reply.status(201).send(await service.createGroup(await auth(req), req.body)),
  );
  r.post(
    '/groups/promote',
    {
      preHandler: write,
      schema: { body: promoteGroupsSchema, response: { 200: promoteGroupsResultSchema } },
    },
    async (req) => service.promoteGroups(await auth(req), req.body),
  );
  r.patch(
    '/groups/:id',
    {
      preHandler: write,
      schema: { params: idParamSchema, body: updateGroupSchema, response: { 200: groupDtoSchema } },
    },
    async (req) => service.updateGroup(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/groups/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.deleteGroup(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );

  // ── Підгрупи ──
  r.post(
    '/groups/:id/subgroups',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: createSubgroupSchema,
        response: { 201: subgroupDtoSchema },
      },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(await service.createSubgroup(await auth(req), req.params.id, req.body)),
  );
  r.patch(
    '/subgroups/:id',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: updateSubgroupSchema,
        response: { 200: subgroupDtoSchema },
      },
    },
    async (req) => service.updateSubgroup(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/subgroups/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.deleteSubgroup(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );

  // ── Студенти ──
  r.get(
    '/students',
    {
      preHandler: read,
      schema: { querystring: studentListQuerySchema, response: { 200: pageOf(studentDtoSchema) } },
    },
    async (req) => service.listStudents(await auth(req), req.query),
  );
  r.post(
    '/students',
    {
      preHandler: write,
      schema: { body: createStudentSchema, response: { 201: studentDtoSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createStudent(await auth(req), req.body)),
  );
  r.post(
    '/students/import',
    {
      preHandler: write,
      schema: { body: importStudentsSchema, response: { 200: importStudentsResultSchema } },
    },
    async (req) => service.importStudents(await auth(req), req.body),
  );
  r.patch(
    '/students/:id',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: updateStudentSchema,
        response: { 200: studentDtoSchema },
      },
    },
    async (req) => service.updateStudent(await auth(req), req.params.id, req.body),
  );
  r.delete(
    '/students/:id',
    { preHandler: write, schema: { params: idParamSchema } },
    async (req, reply) => {
      await service.deleteStudent(await auth(req), req.params.id);
      return reply.status(204).send();
    },
  );

  // ── Зарахування ──
  r.post(
    '/enrollments',
    {
      preHandler: write,
      schema: { body: createEnrollmentSchema, response: { 201: enrollmentDtoSchema } },
    },
    async (req, reply) =>
      reply.status(201).send(await service.createEnrollment(await auth(req), req.body)),
  );
  r.patch(
    '/enrollments/:id',
    {
      preHandler: write,
      schema: {
        params: idParamSchema,
        body: updateEnrollmentSchema,
        response: { 200: enrollmentDtoSchema },
      },
    },
    async (req) => service.updateEnrollment(await auth(req), req.params.id, req.body),
  );
}
