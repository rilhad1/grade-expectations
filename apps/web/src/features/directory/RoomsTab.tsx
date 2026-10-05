import type { RoomDto } from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { q } from '../../api/queries';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { deleteRoom, saveRoom } from './api';

const r = uk.directory.rooms;

function RoomDialog({ room, onClose }: { room?: RoomDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(room?.name ?? '');
  const [capacity, setCapacity] = useState(room?.capacity?.toString() ?? '');
  const [kind, setKind] = useState(room?.kind ?? '');

  const save = useMutation({
    mutationFn: () =>
      saveRoom(room, {
        name: name.trim(),
        capacity: capacity === '' ? null : Number(capacity),
        kind: kind.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{room ? r.edit : r.add}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label={r.name}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <TextField
            label={r.capacity}
            type="number"
            value={capacity}
            onChange={(e) => {
              setCapacity(e.target.value);
            }}
          />
          <TextField
            label={r.kind}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
            }}
          />
        </Stack>
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={name.trim() === '' || save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          {uk.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function RoomsTab() {
  const queryClient = useQueryClient();
  const query = useQuery(q.rooms());
  const [dialog, setDialog] = useState<'add' | RoomDto | null>(null);
  const remove = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
  const rows = query.data ?? [];

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          onClick={() => {
            setDialog('add');
          }}
        >
          {r.add}
        </Button>
      </Box>
      <ErrorAlert error={remove.error ?? query.error} />
      {query.isSuccess && rows.length === 0 && <Alert severity="info">{r.empty}</Alert>}
      {rows.length > 0 && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{r.name}</TableCell>
                <TableCell align="right">{r.capacity}</TableCell>
                <TableCell>{r.kind}</TableCell>
                <TableCell align="right">{uk.common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.id} hover>
                  <TableCell>{x.name}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {x.capacity ?? uk.common.none}
                  </TableCell>
                  <TableCell>{x.kind ?? uk.common.none}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => {
                        setDialog(x);
                      }}
                    >
                      {uk.common.edit}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        if (window.confirm(r.deleteConfirm)) remove.mutate(x.id);
                      }}
                    >
                      {uk.common.delete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      {dialog !== null && (
        <RoomDialog
          key={dialog === 'add' ? 'add' : dialog.id}
          {...(dialog === 'add' ? {} : { room: dialog })}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </>
  );
}
