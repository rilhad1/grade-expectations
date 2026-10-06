import {
  Alert,
  Box,
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

type Kind = 'ok' | 'syncing' | 'offline' | 'error';

const hhmm = (iso: string | null): string | null =>
  iso === null
    ? null
    : new Intl.DateTimeFormat('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Kyiv',
      }).format(new Date(iso));

const STYLE: Record<Kind, { color: string; bg: string; dot: string }> = {
  ok: { color: 'text.secondary', bg: 'transparent', dot: 'ge.ok' },
  syncing: { color: 'primary.main', bg: 'ge.accentSoft', dot: 'primary.main' },
  offline: { color: 'ge.warn', bg: 'ge.warnBg', dot: 'ge.warnDot' },
  error: { color: 'ge.errFg', bg: 'ge.errBg', dot: 'ge.err' },
};

/** Стан синхронізації в шапці: синхронізовано, синхронізація, офлайн, помилка + сповіщення. */
export function SyncIndicator() {
  const { online, syncing, pending, problem, notices, lastSyncAt } = useSyncStore();
  const [open, setOpen] = useState(false);

  const kind: Kind = !online
    ? 'offline'
    : problem !== null
      ? 'error'
      : syncing || pending > 0
        ? 'syncing'
        : 'ok';
  const label = {
    ok: t.synced(hhmm(lastSyncAt)),
    syncing: t.syncing(pending),
    offline: t.offline(pending),
    error: problem === 'auth' ? t.authProblem : problem === 'server' ? t.serverProblem : t.error,
  }[kind];
  const s = STYLE[kind];

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          role="status"
          className="tnum"
          onClick={
            online && kind !== 'ok'
              ? () => {
                  void runSync();
                }
              : undefined
          }
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            height: 28,
            px: 1.25,
            borderRadius: '14px',
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            color: s.color,
            bgcolor: s.bg,
            cursor: online && kind !== 'ok' ? 'pointer' : 'default',
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: s.dot,
              ...(kind === 'syncing' && {
                boxShadow:
                  '0 0 0 3px color-mix(in srgb, var(--mui-palette-primary-main) 18%, transparent)',
              }),
            }}
          />
          <span>{label}</span>
        </Box>
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
