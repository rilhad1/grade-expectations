import {
  attestationKindParamSchema,
  attestationSheetDtoSchema,
  idParamSchema,
  loadAttestationsDtoSchema,
  saveAttestationResultsSchema,
} from '@ge/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { loadOwner } from '../journal/gradebook.js';

import * as service from './service.js';

export function attestationRoutes(app: FastifyInstance): void {
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
    '/loads/:id/attestations',
    {
      preHandler: byLoad('attestation:read'),
      schema: { params: idParamSchema, response: { 200: loadAttestationsDtoSchema } },
    },
    async (req) => service.listLoadAttestations(await auth(req), req.params.id),
  );
  r.get(
    '/loads/:id/attestations/:kind',
    {
      preHandler: byLoad('attestation:read'),
      schema: { params: attestationKindParamSchema, response: { 200: attestationSheetDtoSchema } },
    },
    async (req) => service.getSheet(await auth(req), req.params.id, req.params.kind),
  );
  r.put(
    '/loads/:id/attestations/:kind/results',
    {
      preHandler: byLoad('attestation:write'),
      schema: {
        params: attestationKindParamSchema,
        body: saveAttestationResultsSchema,
        response: { 200: attestationSheetDtoSchema },
      },
    },
    async (req) => service.saveResults(await auth(req), req.params.id, req.params.kind, req.body),
  );
}
