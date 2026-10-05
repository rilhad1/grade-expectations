import { useQuery } from '@tanstack/react-query';

import { fetchMe } from '../api/me';

import { resolveActiveRole, useRoleStore } from './roleStore';

/** Поточний користувач (кеш TanStack Query) і активна роль із перемикача. */
export function useMe() {
  const query = useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const preferred = useRoleStore((s) => s.preferredRole);
  const roles = query.data?.roles ?? [];
  return {
    ...query,
    me: query.data,
    activeRole: resolveActiveRole(roles, preferred),
    isModerator: roles.includes('MODERATOR'),
  };
}
