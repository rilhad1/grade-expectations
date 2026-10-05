import type { ConflictDto } from '@ge/shared';
import { Alert, Chip, Paper, Stack, Typography } from '@mui/material';

import { uk } from '../../shared/i18n/uk';

export function ConflictsPanel({ conflicts }: { conflicts: readonly ConflictDto[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, width: '100%' }}>
      <Typography variant="subtitle1" component="h2" sx={{ mb: 1 }}>
        {uk.builder.conflicts} ({conflicts.length})
      </Typography>
      {conflicts.length === 0 && (
        <Alert severity="success" icon={false}>
          {uk.builder.noConflicts}
        </Alert>
      )}
      <Stack spacing={1}>
        {conflicts.map((c, i) => (
          <Alert key={i} severity="error" icon={false} sx={{ py: 0.5 }}>
            <Chip
              size="small"
              color="error"
              variant="outlined"
              label={uk.builder.conflictTypes[c.type]}
              sx={{ mb: 0.5 }}
            />
            <Typography variant="body2">{c.message}</Typography>
          </Alert>
        ))}
      </Stack>
    </Paper>
  );
}
