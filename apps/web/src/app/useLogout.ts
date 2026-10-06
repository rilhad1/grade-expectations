import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { authClient } from '../api/authClient';
import { prepareLogout } from '../offline/sync';
import { uk } from '../shared/i18n/uk';

import { useRoleStore } from './roleStore';

/** Вихід з акаунта: спершу відправляємо накопичені зміни, незбережені не губимо мовчки. */
export function useLogout(): () => void {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resetRole = useRoleStore((s) => s.reset);
  return () => {
    void (async () => {
      const allowed = await prepareLogout((count) => window.confirm(uk.sync.logoutConfirm(count)));
      if (!allowed) return;
      await authClient.signOut();
      queryClient.clear();
      resetRole();
      await navigate({ to: '/login' });
    })();
  };
}
