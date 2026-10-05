import type { MeResponse } from '@ge/shared';
import { pageOf, rescheduleRequestDtoSchema } from '@ge/shared';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Badge,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouterState } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';

import { get } from '../api/http';
import { uk } from '../shared/i18n/uk';

import { SemesterSwitcher, useCurrentSemester } from './SemesterSwitcher';
import { UserMenu } from './UserMenu';
import { WeekBadge } from './WeekBadge';
import { navFor } from './nav';
import { resolveActiveRole, useRoleStore } from './roleStore';

const DRAWER_WIDTH = 248;

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
  const [open, setOpen] = useState(false);
  const preferred = useRoleStore((s) => s.preferredRole);
  const role = resolveActiveRole(me.roles, preferred);
  const items = navFor(role);
  const pending = usePendingRequests(role === 'MODERATOR');
  const { semester } = useCurrentSemester();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const nav = (
    <List component="nav" aria-label={uk.nav.menu} sx={{ pt: 1 }}>
      {items.map((item) => (
        <ListItemButton
          key={item.to}
          component={Link}
          to={item.to}
          selected={item.to === '/' ? path === '/' : path.startsWith(item.to)}
          onClick={() => {
            setOpen(false);
          }}
        >
          <ListItemText primary={item.label} />
          {item.badge === 'requests' && pending > 0 && (
            <Badge color="error" badgeContent={pending} sx={{ mr: 1 }} />
          )}
        </ListItemButton>
      ))}
    </List>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      <AppBar
        position="fixed"
        color="primary"
        elevation={0}
        sx={{ zIndex: theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {!desktop && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label={uk.nav.menu}
              onClick={() => {
                setOpen(true);
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, whiteSpace: 'nowrap' }}>
            {uk.app.name}
          </Typography>
          <WeekBadge semester={semester} />
          <SemesterSwitcher />
          <UserMenu me={me} onLogout={onLogout} />
        </Toolbar>
      </AppBar>

      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => {
          setOpen(false);
        }}
        sx={{
          width: desktop ? DRAWER_WIDTH : 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        {nav}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
