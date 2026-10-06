import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { authClient } from '../api/authClient';
import { fetchPublicConfig } from '../api/me';
import { LoginForm } from '../features/auth/LoginForm';
import { uk } from '../shared/i18n/uk';

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
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '480px minmax(0, 1fr)', lg: '560px minmax(0, 1fr)' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', md: 'flex' },
          position: 'relative',
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 7,
          bgcolor: '#1F3A5F',
          color: '#FFFFFF',
        }}
      >
        {/* Лінійки зошита й поле — як у паперовому журналі */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(180deg, transparent 0 39px, rgba(255,255,255,.07) 39px 40px)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 104,
            width: '1px',
            bgcolor: 'rgba(214,120,110,.45)',
          }}
        />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            aria-hidden
            sx={{
              width: 36,
              height: 36,
              borderRadius: '6px',
              bgcolor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '4px',
              px: '9px',
              '& i': { display: 'block', height: 2, borderRadius: '1px', bgcolor: '#1F3A5F' },
            }}
          >
            <i />
            <i style={{ width: '70%' }} />
            <i style={{ width: '45%' }} />
          </Box>
          <Typography sx={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {uk.app.name}
          </Typography>
        </Box>
        <Box sx={{ position: 'relative', pl: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography
            component="p"
            sx={{ fontSize: 36, lineHeight: '44px', fontWeight: 600, letterSpacing: '-0.02em' }}
          >
            {uk.login.tagline}
          </Typography>
          <Typography sx={{ fontSize: 17, lineHeight: '26px', color: '#C9D5E4' }}>
            {uk.login.taglineText}
          </Typography>
        </Box>
        <Box />
      </Box>
      <Box sx={{ display: 'grid', placeItems: 'center', p: 2 }}>
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <LoginForm
            googleEnabled={config?.googleEnabled ?? false}
            onSignedIn={() => void navigate({ to: '/' })}
          />
        </Box>
      </Box>
    </Box>
  );
}
