import type { Role } from '@ge/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RoleState {
  /** Обрана користувачем роль (перемикач у меню). Права на сервері від неї не залежать. */
  preferredRole: Role | null;
  setPreferredRole: (role: Role) => void;
  reset: () => void;
}

export const useRoleStore = create<RoleState>()(
  persist(
    (set) => ({
      preferredRole: null,
      setPreferredRole: (role) => {
        set({ preferredRole: role });
      },
      reset: () => {
        set({ preferredRole: null });
      },
    }),
    { name: 'ge-active-role' },
  ),
);

/** Активна роль: обрана, якщо вона все ще доступна користувачу, інакше перша з його ролей. */
export function resolveActiveRole(roles: readonly Role[], preferred: Role | null): Role | null {
  if (preferred !== null && roles.includes(preferred)) return preferred;
  return roles[0] ?? null;
}
