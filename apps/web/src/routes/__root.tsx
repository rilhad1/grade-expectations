import { Container } from '@mui/material';
import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Outlet />
    </Container>
  ),
});
