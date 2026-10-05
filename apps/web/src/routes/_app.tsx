import { Alert, CircularProgress } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { authClient } from '../api/authClient';
import { UnauthenticatedError, fetchMe } from '../api/me';
import { AppShell } from '../app/AppShell';
import { useRoleStore } from '../app/roleStore';
import { uk } from '../shared/i18n/uk';

/** Усі захищені сторінки живуть під цим layout: без сесії — перенаправлення на вхід. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data) throw redirect({ to: '/login' });
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resetRole = useRoleStore((s) => s.reset);
  const {
    data: me,
    error,
    isPending,
  } = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });

  const unauthenticated = error instanceof UnauthenticatedError;
  useEffect(() => {
    if (unauthenticated) void navigate({ to: '/login' });
  }, [unauthenticated, navigate]);

  if (isPending) return <CircularProgress sx={{ m: 4 }} aria-label={uk.common.loading} />;
  if (me === undefined) return <Alert severity="error">{uk.common.loadError}</Alert>;

  const logout = async () => {
    await authClient.signOut();
    queryClient.clear();
    resetRole();
    await navigate({ to: '/login' });
  };

  return (
    <AppShell me={me} onLogout={() => void logout()}>
      <Outlet />
    </AppShell>
  );
}
