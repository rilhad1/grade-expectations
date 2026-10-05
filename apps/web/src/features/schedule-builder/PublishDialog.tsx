import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
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
            <List dense>
              <ListItem>
                <ListItemText primary={`${d.teachers}: ${data.teachers}`} />
              </ListItem>
              <ListItem>
                <ListItemText primary={`${d.create}: ${data.create}`} />
              </ListItem>
              <ListItem>
                <ListItemText primary={`${d.cancel}: ${data.cancel}`} />
              </ListItem>
              <ListItem>
                <ListItemText primary={`${d.keep}: ${data.keep}`} />
              </ListItem>
            </List>
            {blocked && (
              <Alert severity="error">
                {d.blocked} ({data.conflicts.length})
              </Alert>
            )}
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
