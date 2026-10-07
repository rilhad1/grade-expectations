import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { publish } from './api';

const d = uk.builder.publishDialog;

/** Публікація: спершу попередній перегляд («розклад отримають N викладачів, буде створено M занять»). */
export function PublishDialog({
  scheduleId,
  onClose,
}: {
  scheduleId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [published, setPublished] = useState(false);
  // Окремий ключ (не під ['schedule']), щоб інвалідація після публікації не перезапитувала перегляд:
  // версія вже незмінна, і API відповів би 409.
  const preview = useQuery({
    queryKey: ['publish-preview', scheduleId],
    queryFn: () => publish(scheduleId, true),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !published,
  });
  const run = useMutation({
    mutationFn: () => publish(scheduleId, false),
    onSuccess: async () => {
      setPublished(true);
      await queryClient.invalidateQueries({ queryKey: ['schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      await queryClient.invalidateQueries({ queryKey: ['loads'] });
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });
  const data = preview.data;
  const blocked = (data?.conflicts.length ?? 0) > 0;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{d.title}</DialogTitle>
      <DialogContent>
        {preview.isPending && <Typography>{uk.common.loading}</Typography>}
        <ErrorAlert error={preview.error ?? run.error} />
        {run.isSuccess && <Alert severity="success">{d.done}</Alert>}
        {data && !run.isSuccess && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                border: 1,
                borderColor: 'divider',
                borderRadius: '10px',
                mb: 2,
              }}
            >
              {[
                [d.receive, data.teachers, d.teachersUnit],
                [d.create, data.create, d.lessonsUnit],
                [d.cancel, data.cancel, d.lessonsUnit],
              ].map(([label, value, unit], i) => (
                <Box
                  key={String(label)}
                  sx={{ p: 1.75, borderLeft: i > 0 ? 1 : 0, borderColor: 'divider' }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'ge.text3' }}>
                    {label}
                  </Typography>
                  <Typography className="tnum" sx={{ fontSize: 24, fontWeight: 600 }}>
                    {value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {unit}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Stack spacing={1.25} sx={{ fontSize: 13, color: 'text.secondary' }}>
              <Box sx={{ display: 'flex', gap: 1.25, color: blocked ? 'error.main' : 'ge.ok' }}>
                <span aria-hidden>{blocked ? '✕' : '✓'}</span>
                <span>
                  {blocked ? `${d.blocked} (${String(data.conflicts.length)})` : d.noConflicts}
                </span>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.25, color: 'ge.ok' }}>
                <span aria-hidden>✓</span>
                <span>{d.protectedLessons}</span>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.25 }}>
                <span aria-hidden>ⓘ</span>
                <span>
                  {d.keep}: <b className="tnum">{data.keep}</b>
                </span>
              </Box>
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{run.isSuccess ? uk.common.done : uk.common.cancel}</Button>
        {!run.isSuccess && (
          <Button
            variant="contained"
            disabled={!data || blocked || run.isPending}
            onClick={() => {
              run.mutate();
            }}
          >
            {d.confirm}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
