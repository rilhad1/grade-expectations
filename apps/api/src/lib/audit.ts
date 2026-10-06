import type { Prisma } from '@prisma/client';

import type { AuthContext } from '../plugins/session.js';
import type { TenantClient } from '../plugins/tenant.js';

type Tx = Pick<TenantClient, 'changeLog'>;

/** Запис в аудит (ChangeLog): хто, коли, з якого пристрою, значення до/після. */
export async function audit(
  tx: Tx,
  ctx: AuthContext,
  entry: {
    entity: string;
    entityId: string;
    op: 'UPSERT' | 'DELETE';
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
  },
): Promise<void> {
  await tx.changeLog.create({
    data: {
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      entity: entry.entity,
      entityId: entry.entityId,
      op: entry.op,
      ...(entry.before != null && { before: entry.before }),
      ...(entry.after != null && { after: entry.after }),
      deviceId: ctx.deviceId,
    },
  });
}
