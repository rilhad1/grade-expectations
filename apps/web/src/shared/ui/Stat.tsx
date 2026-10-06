import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';

/** Картка-показник: підпис, велике значення, пояснення. */
export function StatCard({
  label,
  value,
  suffix,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  tone?: 'default' | 'warn';
}) {
  const warn = tone === 'warn';
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        ...(warn && { bgcolor: 'ge.warnBg' }),
      }}
    >
      <Typography variant="caption" sx={{ color: warn ? 'ge.warn' : 'ge.text3', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        className="tnum"
        component="div"
        sx={{ fontSize: 26, lineHeight: 1.2, fontWeight: 600, color: warn ? 'ge.warn' : undefined }}
      >
        {value}
        {suffix !== undefined && (
          <Box
            component="small"
            sx={{ ml: 0.75, fontSize: 14, fontWeight: 500, color: 'ge.text3' }}
          >
            {suffix}
          </Box>
        )}
      </Typography>
    </Paper>
  );
}

/** Тонка смуга прогресу (вичитка годин, підтвердження атестації, час пари). */
export function ProgressBar({
  value,
  color,
  height = 6,
  label,
}: {
  /** Від 0 до 1. */
  value: number;
  color?: string;
  height?: number;
  label: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <LinearProgress
      variant="determinate"
      value={pct}
      aria-label={label}
      sx={{
        height,
        borderRadius: `${height / 2}px`,
        ...(color && { '& .MuiLinearProgress-bar': { backgroundColor: color } }),
      }}
    />
  );
}
