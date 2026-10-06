import type { DocumentDto } from '@ge/shared';
import DownloadIcon from '@mui/icons-material/Download';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';

import { documentFileUrl } from '../../api/attestations';
import { uk } from '../../shared/i18n/uk';

/** Стан фонової генерації: прогрес, посилання на файл або помилка. */
export function DocumentJobStatus({ document }: { document: DocumentDto | undefined }) {
  if (!document) return null;
  if (document.status === 'PENDING')
    return (
      <Stack direction="row" spacing={1} alignItems="center" role="status">
        <CircularProgress size={18} />
        <Typography variant="body2">{uk.documents.preparing}</Typography>
      </Stack>
    );
  if (document.status === 'FAILED')
    return (
      <Alert severity="error">
        {uk.documents.failed}
        {document.error ? `: ${document.error}` : ''}
      </Alert>
    );
  return (
    <Button
      variant="outlined"
      startIcon={<DownloadIcon />}
      href={documentFileUrl(document.id)}
      download={document.fileName ?? true}
    >
      {uk.documents.download}
      {document.fileName ? ` (${document.fileName})` : ''}
    </Button>
  );
}
