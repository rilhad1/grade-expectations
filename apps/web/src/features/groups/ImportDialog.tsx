import type { ImportStudentsResult } from '@ge/shared';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { todayKyiv } from '../../app/today';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { importStudents } from './api';

const g = uk.groups;

/** Імпорт списку студентів: вставка тексту → попередній перегляд з помилками → запис. */
export function ImportDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [fromDate, setFromDate] = useState(todayKyiv());
  const [preview, setPreview] = useState<ImportStudentsResult | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => importStudents({ groupId, fromDate, text, dryRun }),
    onSuccess: async (result) => {
      setPreview(result);
      if (!result.dryRun) {
        await queryClient.invalidateQueries({ queryKey: ['groups'] });
        await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
        await queryClient.invalidateQueries({ queryKey: ['students'] });
      }
    },
  });

  const fresh = preview?.rows.filter((r) => !r.duplicate).length ?? 0;
  const committed = preview !== null && !preview.dryRun;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{g.import}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {g.importHint}
        </Typography>
        <Stack spacing={2}>
          <TextField
            multiline
            minRows={6}
            maxRows={14}
            placeholder={g.importPlaceholder}
            value={text}
            disabled={committed}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
            }}
            slotProps={{ htmlInput: { 'aria-label': g.import } }}
          />
          <TextField
            type="date"
            size="small"
            label={g.importDate}
            value={fromDate}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(e) => {
              setFromDate(e.target.value);
            }}
            sx={{ maxWidth: 220 }}
          />
        </Stack>

        <ErrorAlert error={run.error} />

        {preview && preview.errors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {g.importErrors}:{' '}
            {preview.errors.map((e) => `${g.importLine} ${e.line}: «${e.text}»`).join('; ')}
          </Alert>
        )}
        {preview && preview.rows.length === 0 && preview.errors.length === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {g.importNoRows}
          </Alert>
        )}
        {committed && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {g.importResult}: {preview.created}
          </Alert>
        )}

        {preview && preview.rows.length > 0 && !committed && (
          <Table size="small" sx={{ mt: 2 }}>
            <TableHead>
              <TableRow>
                <TableCell>№</TableCell>
                <TableCell>{g.lastName}</TableCell>
                <TableCell>{g.firstName}</TableCell>
                <TableCell>{g.middleName}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {preview.rows.map((r, i) => (
                <TableRow key={i} sx={r.duplicate ? { opacity: 0.55 } : undefined}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.lastName}</TableCell>
                  <TableCell>{r.firstName}</TableCell>
                  <TableCell>{r.middleName ?? uk.common.none}</TableCell>
                  <TableCell>
                    {r.duplicate && <Chip size="small" label={g.importDuplicate} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{committed ? uk.common.done : uk.common.cancel}</Button>
        {!committed && (
          <>
            <Button
              disabled={text.trim() === '' || run.isPending}
              onClick={() => {
                run.mutate(true);
              }}
            >
              {g.importCheck}
            </Button>
            <Button
              variant="contained"
              disabled={!preview || preview.errors.length > 0 || fresh === 0 || run.isPending}
              onClick={() => {
                run.mutate(false);
              }}
            >
              {g.importRun} {fresh > 0 ? `(${fresh})` : ''}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
