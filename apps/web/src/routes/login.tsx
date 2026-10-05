import { Box, Paper } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { authClient } from '../api/authClient';
import { fetchPublicConfig } from '../api/me';
import { LoginForm } from '../features/auth/LoginForm';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (data) throw redirect({ to: '/' });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { data: config } = useQuery({ queryKey: ['public-config'], queryFn: fetchPublicConfig });

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <LoginForm
          googleEnabled={config?.googleEnabled ?? false}
          onSignedIn={() => void navigate({ to: '/' })}
        />
      </Paper>
    </Box>
  );
}
