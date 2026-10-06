import {
  createDocumentSchema,
  documentDtoSchema,
  documentListSchema,
  idParamSchema,
} from '@ge/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { loadOwner } from '../journal/gradebook.js';

import * as service from './service.js';

export function documentRoutes(app: FastifyInstance, opts: { gotenbergUrl: string | undefined }) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = (req: FastifyRequest) => app.requireAuth(req);
  const deps = { enqueue: (id: string) => app.jobs.enqueue(id), gotenbergUrl: opts.gotenbergUrl };
  /** Відомість: право attestation:read на навантаження; експорт даних — будь-який автентифікований викладач. */
  const create = app.authorize('load:read', async (req) => {
    const ctx = await auth(req);
    const body = req.body as { kind?: string; loadId?: string } | undefined;
    return {
      organizationId: ctx.organization.id,
      ...(body?.kind === 'STATEMENT' &&
        body.loadId !== undefined && { teacherId: await loadOwner(ctx, body.loadId) }),
    };
  });
  const own = app.authorize('load:read');

  r.get(
    '/documents',
    { preHandler: own, schema: { response: { 200: documentListSchema } } },
    async (req) => ({ items: await service.listDocuments(await auth(req)) }),
  );
  r.post(
    '/documents',
    {
      preHandler: create,
      schema: { body: createDocumentSchema, response: { 202: documentDtoSchema } },
    },
    async (req, reply) =>
      reply.status(202).send(await service.createDocument(await auth(req), req.body, deps)),
  );
  r.get(
    '/documents/:id',
    { preHandler: own, schema: { params: idParamSchema, response: { 200: documentDtoSchema } } },
    async (req) => service.getDocument(await auth(req), req.params.id),
  );
  r.get(
    '/documents/:id/file',
    { preHandler: own, schema: { params: idParamSchema } },
    async (req, reply) => {
      const file = await service.getDocumentFile(await auth(req), req.params.id);
      const ascii = file.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
      return reply
        .header('content-type', file.mimeType)
        .header(
          'content-disposition',
          `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        )
        .send(file.content);
    },
  );
}
