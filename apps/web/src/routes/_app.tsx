import { Alert, CircularProgress } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { authClient } from '../api/authClient';
import { UnauthenticatedError, fetchMe } from '../api/me';
import { AppShell } from '../app/AppShell';
import { useLogout } from '../app/useLogout';
import { getMeta } from '../offline/db';
import { bindUser, setOnSynced, startSync } from '../offline/sync';
import { uk } from '../shared/i18n/uk';

/** Усі захищені сторінки живуть під цим layout: без сесії — перенаправлення на вхід. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { data, error } = await authClient.getSession();
    if (data) return;
    // Без зв'язку сесію не перевірити: пускаємо, якщо на пристрої є профіль останнього входу
    const offline = !navigator.onLine || error === null || !error.status || error.status >= 502;
    if (offline && (await getMeta('cache:me')) !== undefined) return;
    throw redirect({ to: '/login' });
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const {
    data: me,
    error,
    isPending,
  } = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });

  const userId = me?.user.id;
  useEffect(() => {
    if (userId === undefined) return;
    setOnSynced(() => {
      void queryClient.invalidateQueries({ queryKey: ['lesson'] });
      void queryClient.invalidateQueries({ queryKey: ['today'] });
    });
    let stop: (() => void) | undefined;
    let cancelled = false;
    void bindUser(userId).then(() => {
      if (!cancelled) stop = startSync();
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId, queryClient]);

  const unauthenticated = error instanceof UnauthenticatedError;
  useEffect(() => {
    if (unauthenticated) void navigate({ to: '/login' });
  }, [unauthenticated, navigate]);

  if (isPending) return <CircularProgress sx={{ m: 4 }} aria-label={uk.common.loading} />;
  if (me === undefined) return <Alert severity="error">{uk.common.loadError}</Alert>;

  return (
    <AppShell me={me} onLogout={logout}>
      <Outlet />
    </AppShell>
  );
}
