import type { LoadDto, RoomDto, SlotDto } from '@ge/shared';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { deleteSlot, updateSlot } from './api';
import { loadCaption, type SlotParityValue } from './model';

const t = uk.builder.slot;

/** Редагування слота без перетягування: день, пара, періодичність, аудиторія (доступно з клавіатури). */
export function SlotDialog({
  slot,
  load,
  rooms,
  pairNumbers,
  readOnly,
  onClose,
  onChanged,
}: {
  slot: SlotDto;
  load: LoadDto | undefined;
  rooms: readonly RoomDto[];
  pairNumbers: readonly number[];
  readOnly: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [weekday, setWeekday] = useState(slot.weekday);
  const [pair, setPair] = useState(slot.pairNumber);
  const [parity, setParity] = useState<SlotParityValue>(slot.parity);
  const [roomId, setRoomId] = useState(slot.roomId ?? '');

  const done = async () => {
    await onChanged();
    await queryClient.invalidateQueries({ queryKey: ['schedule'] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      updateSlot(slot.id, slot.version, {
        weekday,
        pairNumber: pair,
        parity,
        roomId: roomId === '' ? null : roomId,
      }),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => deleteSlot(slot.id), onSuccess: done });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {load ? `${loadCaption(load)} · ${uk.loads.kindsShort[load.kind]}` : t.title}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={t.day}
              value={weekday}
              disabled={readOnly}
              onChange={(e) => {
                setWeekday(Number(e.target.value));
              }}
              sx={{ flex: 1 }}
            >
              {uk.weekday.map((name, i) => (
                <MenuItem key={name} value={i + 1}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t.pair}
              value={pair}
              disabled={readOnly}
              onChange={(e) => {
                setPair(Number(e.target.value));
              }}
              sx={{ flex: 1 }}
            >
              {pairNumbers.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            select
            label={t.parity}
            value={parity}
            disabled={readOnly}
            onChange={(e) => {
              setParity(e.target.value as SlotParityValue);
            }}
          >
            {(['EVERY', 'TOP', 'BOTTOM'] as const).map((p) => (
              <MenuItem key={p} value={p}>
                {uk.builder.parity[p]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t.room}
            value={roomId}
            disabled={readOnly}
            onChange={(e) => {
              setRoomId(e.target.value);
            }}
          >
            <MenuItem value="">{t.noRoom}</MenuItem>
            {rooms.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <ErrorAlert error={save.error ?? remove.error} />
      </DialogContent>
      <DialogActions>
        {!readOnly && (
          <Button
            color="error"
            onClick={() => {
              remove.mutate();
            }}
            sx={{ mr: 'auto' }}
          >
            {t.remove}
          </Button>
        )}
        <Button onClick={onClose}>{uk.common.close}</Button>
        {!readOnly && (
          <Button
            variant="contained"
            disabled={save.isPending}
            onClick={() => {
              save.mutate();
            }}
          >
            {uk.common.save}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
