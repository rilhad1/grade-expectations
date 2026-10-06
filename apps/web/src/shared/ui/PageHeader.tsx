import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** Заголовок сторінки: назва 24/32 (мобільний 26/32), підпис, дії справа. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 2, flexWrap: 'wrap' }}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="h5" component="h1" sx={{ fontSize: { xs: 26, md: 24 } }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography className="tnum" color="text.secondary" sx={{ mt: '2px' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions}
    </Box>
  );
}
