import { uuidv7 } from '@ge/shared';
import type { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import type { Env } from './env.js';

/**
 * Better Auth: email + пароль і вхід через Google (лише для наявних користувачів).
 * Реєстрації немає: користувачів додає деканат (інвайти — етап 3).
 * TODO(OQ-10): обов'язкова 2FA — фаза 2.
 */
export function createAuth(prisma: PrismaClient, env: Env) {
  const google =
    env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            disableSignUp: true,
          },
        }
      : {};

  return betterAuth({
    appName: 'Grade Expectations',
    baseURL: env.WEB_ORIGIN,
    basePath: '/api/v1/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    user: { fields: { name: 'fullName' } },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
    socialProviders: google,
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    advanced: {
      database: { generateId: () => uuidv7() },
      useSecureCookies: env.NODE_ENV === 'production',
    },
    // Вбудований ліміт Better Auth для входу (3 спроби / 10 с з одного IP) вимкнено: за спільним NAT
    // коледжу він блокував би цілу аудиторію викладачів. Перебір пароля обмежує Fastify (IP + пошта).
    rateLimit: {
      enabled: env.NODE_ENV !== 'test',
      window: 60,
      max: 300,
      customRules: { '/sign-in/email': false, '/get-session': false, '/sign-out': false },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
