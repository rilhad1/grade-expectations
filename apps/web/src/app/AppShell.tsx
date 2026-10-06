import type { MeResponse } from '@ge/shared';
import { pageOf, rescheduleRequestDtoSchema } from '@ge/shared';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { get } from '../api/http';

import { AppSidebar } from './AppSidebar';
import { ArchivePill, AppTopbar } from './AppTopbar';
import { MobileNav } from './MobileNav';
import { useCurrentSemester } from './SemesterSwitcher';
import { SyncIndicator } from './SyncIndicator';
import { SyncToasts } from './SyncToasts';
import { WeekBadge } from './WeekBadge';
import { navFor } from './nav';
import { resolveActiveRole, useRoleStore } from './roleStore';

function usePendingRequests(enabled: boolean): number {
  const { data } = useQuery({
    queryKey: ['requests', 'pending-count'],
    queryFn: () =>
      get('/reschedule-requests?status=PENDING&limit=200', pageOf(rescheduleRequestDtoSchema)),
    enabled,
    refetchInterval: 60_000,
  });
  return data?.items.length ?? 0;
}

/**
 * Оболонка: на десктопі — бічна панель + шапка, на телефоні — тонка смуга стану зверху й нижня
 * панель (на «На парі» вони ховаються, там власна шапка й закріплена нижня панель дій).
 */
export function AppShell({
  me,
  onLogout,
  children,
}: {
  me: MeResponse;
  onLogout: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const preferred = useRoleStore((s) => s.preferredRole);
  const role = resolveActiveRole(me.roles, preferred);
  const items = navFor(role);
  const requestsCount = usePendingRequests(role === 'MODERATOR');
  const { semester } = useCurrentSemester();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (desktop) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
        <SyncToasts />
        <AppSidebar
          me={me}
          items={items}
          path={path}
          requestsCount={requestsCount}
          onLogout={onLogout}
        />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <AppTopbar />
          <Box component="main" sx={{ flex: 1, minWidth: 0, p: { md: 3, lg: '28px 32px' } }}>
            {children}
          </Box>
        </Box>
      </Box>
    );
  }

  const bare = path.startsWith('/lessons/');
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <SyncToasts />
      {!bare && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            px: 2,
            py: 1.25,
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {semester?.status === 'CLOSED' ? (
            <ArchivePill />
          ) : (
            <WeekBadge semester={semester} large />
          )}
          <SyncIndicator />
        </Box>
      )}
      <Box component="main" sx={{ p: 2, pb: bare ? 2 : 14 }}>
        {children}
      </Box>
      {!bare && <MobileNav path={path} />}
    </Box>
  );
}
