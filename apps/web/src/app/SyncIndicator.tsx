import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { useState } from 'react';

import { runSync } from '../offline/sync';
import { dismissNotices, useSyncStore } from '../offline/syncStore';
import { uk } from '../shared/i18n/uk';

const t = uk.sync;

/** Стан синхронізації в шапці: «Офлайн · 14 змін на пристрої», «Синхронізація…», застереження. */
export function SyncIndicator() {
  const { online, syncing, pending, problem, notices } = useSyncStore();
  const [open, setOpen] = useState(false);

  const label = !online
    ? t.offline(pending)
    : problem === 'auth'
      ? t.authProblem
      : problem === 'server'
        ? t.serverProblem
        : syncing || pending > 0
          ? t.syncing(pending)
          : null;
  if (label === null && notices.length === 0) return null;

  const warn = !online || problem !== null;
  return (
    <>
      <Stack direction="row" spacing={1}>
        {label !== null && (
          <Chip
            size="small"
            role="status"
            icon={!online ? <CloudOffIcon /> : syncing ? <SyncIcon /> : <CloudDoneIcon />}
            label={label}
            color={warn ? 'warning' : 'default'}
            onClick={() => {
              if (online) void runSync();
            }}
            sx={{
              color: warn ? undefined : 'inherit',
              bgcolor: warn ? undefined : 'rgba(255,255,255,.16)',
            }}
          />
        )}
        {notices.length > 0 && (
          <Chip
            size="small"
            color="error"
            label={t.notices(notices.length)}
            onClick={() => {
              setOpen(true);
            }}
          />
        )}
      </Stack>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t.noticesTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {notices.map((n) => (
              <Alert key={n.id} severity={n.kind === 'rejected' ? 'error' : 'warning'}>
                {n.message}
              </Alert>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              void dismissNotices();
              setOpen(false);
            }}
          >
            {t.dismiss}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
