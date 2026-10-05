import type { MeResponse } from '@ge/shared';
import { AppBar, Box, Container, Toolbar, Typography } from '@mui/material';
import type { ReactNode } from 'react';

import { uk } from '../shared/i18n/uk';

import { UserMenu } from './UserMenu';

export function AppShell({
  me,
  onLogout,
  children,
}: {
  me: MeResponse;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {uk.app.name}
          </Typography>
          <UserMenu me={me} onLogout={onLogout} />
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {children}
      </Container>
    </Box>
  );
}
