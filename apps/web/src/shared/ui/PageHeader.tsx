import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
      <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
        {title}
      </Typography>
      {actions}
    </Box>
  );
}
