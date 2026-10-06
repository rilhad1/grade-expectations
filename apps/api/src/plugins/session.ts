import type { Role } from '@ge/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { createAuth, type Auth } from '../auth.js';
import type { Env } from '../env.js';
import { unauthenticated } from '../errors.js';

import { forOrganization, type TenantClient } from './tenant.js';

export interface AuthContext {
  user: { id: string; email: string; fullName: string };
  organization: { id: string; title: string };
  roles: readonly Role[];
  /** Клієнт Prisma з ізоляцією за коледжем. */
  db: TenantClient;
  /** Сьогодні (YYYY-MM-DD, Europe/Kyiv). Джерело часу в сервісах; у тестах підміняється. */
  today: () => string;
  /** Пристрій, з якого прийшла зміна (для аудиту й синхронізації). */
  deviceId: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    auth: Auth;
    clock: { today: () => string };
    requireAuth: (request: FastifyRequest) => Promise<AuthContext>;
    /** Контекст користувача поза HTTP-запитом (фонові задачі). */
    contextFor: (userId: string) => Promise<AuthContext>;
  }
  interface FastifyRequest {
    authContext?: AuthContext;
  }
}

function toHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value))
      value.forEach((v) => {
        headers.append(key, v);
      });
    else if (value !== undefined) headers.set(key, value);
  }
  return headers;
}

/**
 * Читає сесію Better Auth, знаходить членство в коледжі й будує контекст запиту.
 * Користувач без членства вважається неавтентифікованим (немає доступу до жодного коледжу).
 * MVP: один коледж на користувача; TODO: вибір активного коледжу, коли їх буде кілька.
 */
export const sessionPlugin = fp((app: FastifyInstance, opts: { env: Env }) => {
  const auth = createAuth(app.prisma, opts.env);
  app.decorate('auth', auth);
  app.decorate('clock', {
    today: () =>
      opts.env.FAKE_TODAY ??
      new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Kyiv' }).format(new Date()),
  });

  async function buildContext(
    userId: string,
    user: { email: string; fullName: string },
    deviceId: string,
  ): Promise<AuthContext> {
    const membership = await app.prisma.membership.findFirst({
      where: { userId, deletedAt: null },
      include: { organization: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) throw unauthenticated();
    return {
      user: { id: userId, ...user },
      organization: membership.organization,
      roles: membership.roles,
      db: forOrganization(app.prisma, membership.organizationId),
      today: () => app.clock.today(),
      deviceId,
    };
  }

  app.decorate('contextFor', async (userId: string): Promise<AuthContext> => {
    const user = await app.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw unauthenticated();
    return buildContext(userId, { email: user.email, fullName: user.fullName }, 'job');
  });

  app.decorate('requireAuth', async (request: FastifyRequest): Promise<AuthContext> => {
    if (request.authContext) return request.authContext;

    const session = await auth.api.getSession({ headers: toHeaders(request) });
    if (!session) throw unauthenticated();

    const context = await buildContext(
      session.user.id,
      { email: session.user.email, fullName: session.user.name },
      String(request.headers['x-device-id'] ?? 'web').slice(0, 64),
    );
    request.authContext = context;
    return context;
  });
});
