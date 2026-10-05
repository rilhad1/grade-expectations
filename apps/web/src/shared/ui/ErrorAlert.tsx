import { Alert } from '@mui/material';

import { errorMessage } from '../../api/http';
import { uk } from '../i18n/uk';

/** Помилка запиту українською: код домену → текст з uk.errors. */
export function ErrorAlert({ error }: { error: unknown }) {
  if (error === null || error === undefined) return null;
  return (
    <Alert severity="error" sx={{ my: 1 }}>
      {errorMessage(error, uk.errors)}
    </Alert>
  );
}
