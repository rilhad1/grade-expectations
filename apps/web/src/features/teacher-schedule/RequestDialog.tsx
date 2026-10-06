import type { LessonItemDto } from '@ge/shared';
import { rescheduleRequestDtoSchema } from '@ge/shared';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { post } from '../../api/http';
import { q } from '../../api/queries';
import { todayKyiv } from '../../app/today';
import { formatWeekdayDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

const t = uk.teacherSchedule;

/** Запит викладача на перенесення пари; погоджує деканат. */
export function RequestDialog({ lesson, onClose }: { lesson: LessonItemDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const bells = useQuery(q.bells());
  const rooms = useQuery(q.rooms());
  const [date, setDate] = useState(lesson.date);
  const [pair, setPair] = useState(lesson.pairNumber);
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');

  const send = useMutation({
    mutationFn: () =>
      post(
        '/reschedule-requests',
        {
          lessonId: lesson.id,
          proposedDate: date,
          proposedPair: pair,
          proposedRoomId: roomId || null,
          reason: reason.trim(),
        },
        rescheduleRequestDtoSchema,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reschedule-requests'] }),
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t.requestTitle}</DialogTitle>
      <DialogContent>
        <p style={{ marginTop: 0 }}>
          {lesson.discipline.shortTitle} · {lesson.group.name} · {formatWeekdayDate(lesson.date)},{' '}
          {lesson.pairNumber} {uk.today.pair}
        </p>
        {send.isSuccess ? (
          <Alert severity="success">{t.sent}</Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              type="date"
              label={t.desiredDate}
              value={date}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: todayKyiv() } }}
              onChange={(e) => {
                setDate(e.target.value);
              }}
            />
            <TextField
              select
              label={t.desiredPair}
              value={pair}
              onChange={(e) => {
                setPair(Number(e.target.value));
              }}
            >
              {(bells.data ?? []).map((b) => (
                <MenuItem key={b.pairNumber} value={b.pairNumber}>
                  {b.pairNumber} · {b.startsAt}–{b.endsAt}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t.desiredRoom}
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
              }}
            >
              <MenuItem value="">{t.anyRoom}</MenuItem>
              {(rooms.data ?? []).map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              multiline
              minRows={2}
              label={t.reason}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
              }}
            />
            <ErrorAlert error={send.error} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{send.isSuccess ? uk.common.done : uk.common.cancel}</Button>
        {!send.isSuccess && (
          <Button
            variant="contained"
            disabled={reason.trim().length < 3 || send.isPending}
            onClick={() => {
              send.mutate();
            }}
          >
            {t.send}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
