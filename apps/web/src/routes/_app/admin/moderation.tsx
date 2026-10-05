import { Alert, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';

import { uk } from '../../../shared/i18n/uk';

export const Route = createFileRoute('/_app/admin/moderation')({ component: ModerationPage });

function ModerationPage() {
  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        {uk.moderation.title}
      </Typography>
      <Alert severity="info">
        <strong>{uk.moderation.empty}.</strong> {uk.moderation.hint}
      </Alert>
    </>
  );
}
