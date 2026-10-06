import { Box, Paper, Skeleton } from '@mui/material';

/** Скелетон картки (заголовок, рядки, кнопка). */
export function CardSkeleton({ label }: { label: string }) {
  return (
    <Paper
      variant="outlined"
      aria-busy="true"
      aria-label={label}
      sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.75 }}
    >
      <Box sx={{ display: 'flex', gap: 1.25 }}>
        <Skeleton variant="rounded" width={64} height={22} sx={{ borderRadius: '11px' }} />
        <Skeleton variant="rounded" width={96} height={22} />
      </Box>
      <Skeleton variant="rounded" width="60%" height={28} />
      <Skeleton variant="rounded" width="45%" height={16} />
      <Skeleton variant="rounded" width="100%" height={40} />
      <Skeleton variant="rounded" width={220} height={48} />
    </Paper>
  );
}

/** Скелетон списку рядків з колом і двома смугами. */
export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <Paper variant="outlined" aria-busy="true" aria-label={label} sx={{ px: 2, py: 1 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            height: 48,
            borderBottom: i === rows - 1 ? 0 : '1px solid',
            borderColor: 'divider',
          }}
        >
          <Skeleton variant="circular" width={28} height={28} />
          <Skeleton variant="rounded" width={70} height={14} />
          <Skeleton
            variant="rounded"
            height={14}
            sx={{ flex: 1, maxWidth: `${70 + (i % 3) * 10}%` }}
          />
        </Box>
      ))}
    </Paper>
  );
}

/** Скелетон таблиці: шапка й рядки. */
export function TableSkeleton({
  rows = 6,
  cols = 5,
  label,
}: {
  rows?: number;
  cols?: number;
  label: string;
}) {
  return (
    <Paper variant="outlined" aria-busy="true" aria-label={label} sx={{ overflow: 'hidden' }}>
      {Array.from({ length: rows + 1 }, (_, r) => (
        <Box
          key={r}
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${String(cols)}, minmax(0, 1fr))`,
            gap: 2,
            px: 2,
            height: r === 0 ? 40 : 44,
            alignItems: 'center',
            bgcolor: r === 0 ? 'ge.surface2' : undefined,
            borderBottom: r === rows ? 0 : '1px solid',
            borderColor: 'divider',
          }}
        >
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} variant="rounded" height={14} />
          ))}
        </Box>
      ))}
    </Paper>
  );
}
