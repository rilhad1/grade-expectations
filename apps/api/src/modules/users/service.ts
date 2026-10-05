import { randomBytes } from 'node:crypto';

import { uuidv7, type CreateUserInput, type Role, type UserDto } from '@ge/shared';
import { hashPassword } from 'better-auth/crypto';

import { notFound, unprocessable } from '../../errors.js';
import { newId, pageArgs, toPage } from '../../lib/db.js';
import type { AuthContext } from '../../plugins/session.js';

// Без неоднозначних символів (0/O, 1/l/I): пароль диктують по телефону
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export async function listUsers(ctx: AuthContext, cursor: string | undefined, limit: number) {
  const rows = await ctx.db.membership.findMany({
    where: { deletedAt: null },
    include: { user: true },
    ...pageArgs(cursor, limit),
  });
  const page = toPage(rows, limit);
  const items: UserDto[] = page.items.map((m) => ({
    id: m.userId,
    email: m.user.email,
    fullName: m.user.fullName,
    roles: m.roles,
  }));
  // Курсор — id членства (сортування за ним), а не користувача
  return { items, nextCursor: page.nextCursor };
}

/**
 * Створює користувача коледжу з тимчасовим паролем (інвайти поштою — згодом).
 * Пароль повертається один раз.
 */
export async function createUser(ctx: AuthContext, input: CreateUserInput) {
  const userId = newId(input.id);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await ctx.db.$transaction(async (tx) => {
    await tx.user.create({
      data: { id: userId, email: input.email, fullName: input.fullName, emailVerified: true },
    });
    await tx.account.create({
      data: {
        id: uuidv7(),
        userId,
        accountId: userId,
        providerId: 'credential',
        password: passwordHash,
      },
    });
    await tx.membership.create({
      data: { id: uuidv7(), userId, organizationId: ctx.organization.id, roles: input.roles },
    });
  });
  return {
    id: userId,
    email: input.email,
    fullName: input.fullName,
    roles: input.roles,
    temporaryPassword,
  };
}

export async function updateUserRoles(
  ctx: AuthContext,
  userId: string,
  roles: Role[],
): Promise<UserDto> {
  if (userId === ctx.user.id && !roles.includes('MODERATOR')) {
    throw unprocessable('CANNOT_REMOVE_OWN_MODERATOR', 'Не можна забрати у себе роль модератора');
  }
  const { count } = await ctx.db.membership.updateMany({
    where: { userId, deletedAt: null },
    data: { roles, version: { increment: 1 } },
  });
  if (count === 0) throw notFound('Користувача не знайдено');
  const m = await ctx.db.membership.findFirst({
    where: { userId, deletedAt: null },
    include: { user: true },
  });
  if (!m) throw notFound('Користувача не знайдено');
  return { id: m.userId, email: m.user.email, fullName: m.user.fullName, roles: m.roles };
}
