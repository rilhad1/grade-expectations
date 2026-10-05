import {
  rescheduleRequestDtoSchema,
  type FreeSlotDto,
  type RescheduleRequestDto,
} from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { getAll } from '../../../api/http';
import { q } from '../../../api/queries';
import { approveRequest, fetchFreeSlots, rejectRequest } from '../../../features/requests/api';
import { formatDate, formatWeekdayDate } from '../../../shared/format';
import { uk } from '../../../shared/i18n/uk';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';

export const Route = createFileRoute('/_app/admin/requests')({ component: RequestsPage });

const r = uk.requests;
const statusColor = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'default' } as const;

function RejectDialog({
  request,
  onClose,
}: {
  request: RescheduleRequestDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const reject = useMutation({
    mutationFn: () => rejectRequest(request.id, comment.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      onClose();
    },
  });
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{r.rejectTitle}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          label={r.rejectComment}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
          }}
          sx={{ mt: 1 }}
        />
        <ErrorAlert error={reject.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          color="error"
          variant="contained"
          disabled={comment.trim() === '' || reject.isPending}
          onClick={() => {
            reject.mutate();
          }}
        >
          {r.reject}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RequestDetail({ request }: { request: RescheduleRequestDto }) {
  const queryClient = useQueryClient();
  const rooms = useQuery(q.rooms());
  const bells = useQuery(q.bells());
  const pending = request.status === 'PENDING';
  const slots = useQuery({
    queryKey: ['requests', request.id, 'free-slots'],
    queryFn: () => fetchFreeSlots(request.id),
    enabled: pending,
  });
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');
  const roomName = (id: string | null) => rooms.data?.find((x) => x.id === id)?.name;
  const time = (pair: number) => {
    const b = bells.data?.find((x) => x.pairNumber === pair);
    return b ? `${b.startsAt}–${b.endsAt}` : '';
  };

  const approve = useMutation({
    mutationFn: (slot?: FreeSlotDto) =>
      approveRequest(request.id, {
        comment: comment.trim() || null,
        ...(slot && {
          date: slot.date,
          pairNumber: slot.pairNumber,
          roomId:
            request.proposedRoomId && slot.freeRoomIds.includes(request.proposedRoomId)
              ? request.proposedRoomId
              : (slot.freeRoomIds[0] ?? null),
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          <DisciplineDot color={request.lesson.discipline.color} />
          {request.lesson.discipline.shortTitle} · {request.lesson.group.name}
        </Typography>
        <Chip
          size="small"
          color={statusColor[request.status]}
          variant={request.status === 'PENDING' ? 'filled' : 'outlined'}
          label={r.statuses[request.status]}
        />
      </Stack>
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography>
          <strong>{r.requestedBy}:</strong> {request.requestedBy.fullName}
        </Typography>
        <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
          <strong>{r.lesson}:</strong> {formatWeekdayDate(request.lesson.date)},{' '}
          {request.lesson.pairNumber} {r.pair} {time(request.lesson.pairNumber)}
        </Typography>
        <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>
          <strong>{r.wish}:</strong> {formatWeekdayDate(request.proposedDate)},{' '}
          {request.proposedPair} {r.pair} {time(request.proposedPair)}
          {request.proposedRoomId ? `, ${r.room} ${roomName(request.proposedRoomId) ?? ''}` : ''}
        </Typography>
        <Typography>
          <strong>{r.reason}:</strong> {request.reason}
        </Typography>
        {request.resolvedBy && (
          <Typography>
            <strong>{r.resolver}:</strong> {request.resolvedBy.fullName}
            {request.resolverComment ? ` — ${request.resolverComment}` : ''}
          </Typography>
        )}
      </Stack>

      {pending && (
        <>
          <TextField
            fullWidth
            size="small"
            label={r.comment}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
            }}
            sx={{ mb: 2 }}
          />
          <ErrorAlert error={approve.error} />
          <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
            <Button
              variant="contained"
              disabled={approve.isPending}
              onClick={() => {
                approve.mutate(undefined);
              }}
            >
              {r.approve}
            </Button>
            <Button
              color="error"
              onClick={() => {
                setRejecting(true);
              }}
            >
              {r.reject}
            </Button>
          </Stack>

          <Typography variant="subtitle1" component="h3">
            {r.freeSlots}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {r.freeSlotsHint}
          </Typography>
          {slots.data?.length === 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              {r.noFreeSlots}
            </Alert>
          )}
          <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
            {(slots.data ?? []).map((slot) => (
              <ListItemButton
                key={`${slot.date}-${slot.pairNumber}`}
                disabled={approve.isPending}
                onClick={() => {
                  approve.mutate(slot);
                }}
              >
                <ListItemText
                  primary={`${formatWeekdayDate(slot.date)} · ${slot.pairNumber} ${r.pair} ${time(slot.pairNumber)}`}
                  secondary={
                    slot.freeRoomIds.length > 0
                      ? slot.freeRoomIds.slice(0, 4).map(roomName).join(', ')
                      : r.anyRoom
                  }
                  slotProps={{ primary: { sx: { fontVariantNumeric: 'tabular-nums' } } }}
                />
                <Typography variant="caption" color="primary">
                  {r.approveHere}
                </Typography>
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      {rejecting && (
        <RejectDialog
          request={request}
          onClose={() => {
            setRejecting(false);
          }}
        />
      )}
    </Paper>
  );
}

function RequestsPage() {
  const [status, setStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['requests', 'list', status],
    queryFn: () =>
      getAll('/reschedule-requests', rescheduleRequestDtoSchema, {
        status: status === 'ALL' ? undefined : status,
      }),
  });
  const items = list.data ?? [];
  const selected = items.find((x) => x.id === selectedId);

  return (
    <>
      <PageHeader
        title={r.title}
        actions={
          <TextField
            select
            size="small"
            label={r.status}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setSelectedId(null);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="ALL">{r.all}</MenuItem>
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <MenuItem key={s} value={s}>
                {r.statuses[s]}
              </MenuItem>
            ))}
          </TextField>
        }
      />
      <ErrorAlert error={list.error} />
      {list.isSuccess && items.length === 0 && <Alert severity="info">{r.empty}</Alert>}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        {items.length > 0 && (
          <Paper variant="outlined" sx={{ width: { xs: '100%', lg: 380 }, flexShrink: 0 }}>
            <List disablePadding>
              {items.map((x) => (
                <ListItemButton
                  key={x.id}
                  selected={x.id === selectedId}
                  onClick={() => {
                    setSelectedId(x.id);
                  }}
                >
                  <ListItemText
                    primary={
                      <>
                        <DisciplineDot color={x.lesson.discipline.color} />
                        {x.lesson.discipline.shortTitle} · {x.lesson.group.name}
                      </>
                    }
                    secondary={`${x.requestedBy.fullName} · ${formatDate(x.lesson.date)} → ${formatDate(x.proposedDate)}`}
                  />
                  <Chip
                    size="small"
                    color={statusColor[x.status]}
                    variant="outlined"
                    label={r.statuses[x.status]}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
        <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
          {selected ? (
            <RequestDetail key={selected.id} request={selected} />
          ) : (
            items.length > 0 && <Alert severity="info">{r.selectRequest}</Alert>
          )}
        </Box>
      </Stack>
    </>
  );
}
