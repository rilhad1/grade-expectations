import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Alert,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  fetchCalendar,
  fetchDocuments,
  rotateCalendar,
  documentFileUrl,
} from '../../api/attestations';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { PageHeader } from '../../shared/ui/PageHeader';
import { DocumentJobStatus } from '../documents/DocumentJobStatus';
import { useDocumentJob } from '../documents/useDocumentJob';

const t = uk.profile;

/** Підписка на розклад у календарі (ICS) і експорт усіх даних викладача. */
export function ProfileScreen() {
  const queryClient = useQueryClient();
  const feed = useQuery({ queryKey: ['calendar-feed'], queryFn: fetchCalendar });
  const rotate = useMutation({
    mutationFn: rotateCalendar,
    onSuccess: (data) => {
      queryClient.setQueryData(['calendar-feed'], data);
    },
  });
  const documents = useQuery({ queryKey: ['documents'], queryFn: fetchDocuments });
  const exportJob = useDocumentJob();
  const [copied, setCopied] = useState(false);

  const url = feed.data ? `${window.location.origin}${feed.data.path}` : '';

  return (
    <>
      <PageHeader title={t.title} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Paper
          variant="outlined"
          component="section"
          aria-label={t.calendarTitle}
          sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Typography variant="h6" component="h2" gutterBottom>
            {t.calendarTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t.calendarHint}
          </Typography>
          <ErrorAlert error={feed.error ?? rotate.error} />
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              value={url}
              slotProps={{ htmlInput: { readOnly: true, 'aria-label': t.calendarLink } }}
            />
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              disabled={url === ''}
              onClick={() => {
                void navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                });
              }}
            >
              {copied ? t.copied : t.copy}
            </Button>
          </Stack>
          <Button
            color="error"
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-start' }}
            disabled={rotate.isPending}
            onClick={() => {
              if (window.confirm(t.rotateConfirm)) {
                setCopied(false);
                rotate.mutate();
              }
            }}
          >
            {t.rotate}
          </Button>
          <Box
            component="ol"
            sx={{
              m: 0,
              pl: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              fontSize: 13,
              color: 'text.secondary',
            }}
          >
            {t.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </Box>
        </Paper>

        <Paper
          variant="outlined"
          component="section"
          aria-label={t.exportTitle}
          sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Typography variant="h6" component="h2" gutterBottom>
            {t.exportTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t.exportHint}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              disabled={exportJob.busy}
              onClick={() => {
                exportJob.start({ kind: 'DATA_EXPORT' });
              }}
            >
              {t.exportStart}
            </Button>
            <DocumentJobStatus document={exportJob.document} />
          </Stack>
          <ErrorAlert error={exportJob.error} />

          {(documents.data?.items.length ?? 0) > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 3 }}>
                {t.recent}
              </Typography>
              <List dense>
                {documents.data?.items
                  .filter((d) => d.status === 'READY')
                  .map((d) => (
                    <ListItem key={d.id} disableGutters>
                      <ListItemText
                        primary={
                          <a href={documentFileUrl(d.id)} download={d.fileName ?? true}>
                            {d.fileName ?? d.id}
                          </a>
                        }
                        secondary={new Date(d.createdAt).toLocaleString('uk-UA')}
                      />
                    </ListItem>
                  ))}
              </List>
            </>
          )}
          {documents.isSuccess && documents.data.items.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t.noDocuments}
            </Alert>
          )}
        </Paper>
      </Box>
    </>
  );
}
