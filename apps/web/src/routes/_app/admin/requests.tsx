import {
  rescheduleRequestDtoSchema,
  type FreeSlotDto,
  type RescheduleRequestDto,
} from '@ge/shared';
import { Alert, Box, Button, ButtonBase, Chip, Paper, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { getAll } from '../../../api/http';
import { q } from '../../../api/queries';
import { todayKyiv } from '../../../app/today';
import { approveRequest, fetchFreeSlots, rejectRequest } from '../../../features/requests/api';
import { formatWeekdayDate } from '../../../shared/format';
import { uk } from '../../../shared/i18n/uk';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { SegmentedControl } from '../../../shared/ui/SegmentedControl';

export const Route = createFileRoute('/_app/admin/requests')({ component: RequestsPage });

const r = uk.requests;
const KYIV = 'Europe/Kyiv';

/** «сьогодні, 9:12» або «пт, 2 жовт.» за київським часом. */
function submittedAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('sv-SE', { timeZone: KYIV });
  if (day === todayKyiv()) {
    const time = date.toLocaleTimeString('uk-UA', {
      timeZone: KYIV,
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${r.today}, ${time}`;
  }
  return formatWeekdayDate(day);
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="caption"
    sx={{ color: 'ge.text3', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
  >
    {children}
  </Typography>
);

/** Один рядок списку: хто, коли, що переносити й на коли. */
function RequestRow({
  request,
  selected,
  onSelect,
}: {
  request: RescheduleRequestDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ButtonBase
      onClick={onSelect}
      aria-current={selected}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 0.5,
        width: '100%',
        px: 2,
        py: 1.5,
        textAlign: 'left',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: selected ? 'ge.accentSoft' : undefined,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
        <b>{request.requestedBy.fullName}</b>
        <Typography variant="caption" color="text.secondary" className="tnum" noWrap>
          {submittedAt(request.createdAt)}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
        <DisciplineDot color={request.lesson.discipline.color} size={8} gap={0.75} />
        {request.lesson.discipline.shortTitle} · {request.lesson.group.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" className="tnum">
        {formatWeekdayDate(request.lesson.date)}, {request.lesson.pairNumber} {r.pair} →{' '}
        {formatWeekdayDate(request.proposedDate)}, {request.proposedPair} {r.pair}
      </Typography>
      {request.status !== 'PENDING' && (
        <Chip
          size="small"
          label={r.statuses[request.status]}
          color={request.status === 'APPROVED' ? 'success' : 'default'}
          variant="outlined"
          sx={{ alignSelf: 'flex-start' }}
        />
      )}
    </ButtonBase>
  );
}

function SlotBox({
  label,
  highlighted,
  date,
  pair,
  time,
  room,
}: {
  label: string;
  highlighted?: boolean;
  date: string;
  pair: number;
  time: string;
  room?: string | undefined;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: highlighted ? 'ge.accentLine' : 'divider',
        bgcolor: highlighted ? 'ge.accentSoft' : undefined,
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: highlighted ? 'primary.main' : 'ge.text3',
        }}
      >
        {label}
      </Typography>
      <b className="tnum">{formatWeekdayDate(date)}</b>
      <Typography variant="body2" color="text.secondary" className="tnum">
        {pair} {r.pair}
        {time ? ` · ${time}` : ''}
      </Typography>
      {room && (
        <Typography variant="body2" color="text.secondary">
          {r.room} {room}
        </Typography>
      )}
    </Box>
  );
}

function RequestDetail({
  request,
  chosen,
  onClearChosen,
}: {
  request: RescheduleRequestDto;
  chosen: FreeSlotDto | null;
  onClearChosen: () => void;
}) {
  const queryClient = useQueryClient();
  const rooms = useQuery(q.rooms());
  const bells = useQuery(q.bells());
  const pending = request.status === 'PENDING';
  const [comment, setComment] = useState('');
  const roomName = (id: string | null) => rooms.data?.find((x) => x.id === id)?.name;
  const time = (pair: number) => {
    const b = bells.data?.find((x) => x.pairNumber === pair);
    return b ? `${b.startsAt}–${b.endsAt}` : '';
  };

  const approve = useMutation({
    mutationFn: () =>
      approveRequest(request.id, {
        comment: comment.trim() || null,
        ...(chosen && {
          date: chosen.date,
          pairNumber: chosen.pairNumber,
          roomId:
            request.proposedRoomId && chosen.freeRoomIds.includes(request.proposedRoomId)
              ? request.proposedRoomId
              : (chosen.freeRoomIds[0] ?? null),
        }),
      }),
    onSuccess: async () => {
      onClearChosen();
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
      await queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });
  const reject = useMutation({
    mutationFn: () => rejectRequest(request.id, comment.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  const target = chosen
    ? { date: chosen.date, pair: chosen.pairNumber }
    : { date: request.proposedDate, pair: request.proposedPair };

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label={r.detail}
      sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.25 }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Chip
          size="small"
          label={pending ? r.statusNew : r.statuses[request.status]}
          color={pending ? 'primary' : request.status === 'APPROVED' ? 'success' : 'default'}
          variant={pending ? 'filled' : 'outlined'}
          sx={{ alignSelf: 'flex-start' }}
        />
        <Typography variant="h6" component="h2" sx={{ fontSize: 18, lineHeight: '24px' }}>
          {r.moveTitle(request.lesson.discipline.title, request.lesson.group.name)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {request.requestedBy.fullName} · {r.submitted(submittedAt(request.createdAt))}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 24px minmax(0,1fr)',
          gap: 1,
          alignItems: 'stretch',
        }}
      >
        <SlotBox
          label={r.now}
          date={request.lesson.date}
          pair={request.lesson.pairNumber}
          time={time(request.lesson.pairNumber)}
        />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'ge.text3',
          }}
        >
          →
        </Box>
        <SlotBox
          label={r.desired}
          highlighted
          date={request.proposedDate}
          pair={request.proposedPair}
          time={time(request.proposedPair)}
          room={roomName(request.proposedRoomId)}
        />
      </Box>

      <Box>
        <Label>{r.reason}</Label>
        <Typography sx={{ mt: 0.5, lineHeight: '21px' }}>{request.reason}</Typography>
      </Box>

      {request.resolvedBy && (
        <Typography variant="body2">
          <strong>{r.resolver}:</strong> {request.resolvedBy.fullName}
          {request.resolverComment ? ` — ${request.resolverComment}` : ''}
        </Typography>
      )}

      {pending && (
        <>
          <TextField
            multiline
            minRows={3}
            label={r.commentFor}
            placeholder={r.commentHint}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <ErrorAlert error={approve.error ?? reject.error} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              disabled={approve.isPending}
              sx={{ flex: 1 }}
              onClick={() => {
                approve.mutate();
              }}
            >
              {r.approveAt(`${formatWeekdayDate(target.date)}, ${String(target.pair)} ${r.pair}`)}
            </Button>
            <Button
              color="error"
              variant="outlined"
              disabled={comment.trim() === '' || reject.isPending}
              title={comment.trim() === '' ? r.rejectNeedsComment : undefined}
              onClick={() => {
                reject.mutate();
              }}
            >
              {r.reject}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}

/** Вільні слоти для вибраного запиту: клік вибирає слот, «Погодити» переносить саме туди. */
function FreeSlots({
  request,
  chosen,
  onChoose,
}: {
  request: RescheduleRequestDto;
  chosen: FreeSlotDto | null;
  onChoose: (slot: FreeSlotDto | null) => void;
}) {
  const rooms = useQuery(q.rooms());
  const bells = useQuery(q.bells());
  const slots = useQuery({
    queryKey: ['requests', request.id, 'free-slots'],
    queryFn: () => fetchFreeSlots(request.id),
  });
  const roomName = (id: string) => rooms.data?.find((x) => x.id === id)?.name;
  const time = (pair: number) => {
    const b = bells.data?.find((x) => x.pairNumber === pair);
    return b ? `${b.startsAt}–${b.endsAt}` : '';
  };
  return (
    <Paper
      variant="outlined"
      component="aside"
      aria-labelledby="free-slots"
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        maxHeight: 'calc(100vh - 200px)',
        overflowY: 'auto',
      }}
    >
      <Typography id="free-slots" variant="subtitle1" component="h3" sx={{ fontWeight: 600 }}>
        {r.freeSlots}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {r.freeSlotsHint}
      </Typography>
      {slots.data?.length === 0 && <Alert severity="info">{r.noFreeSlots}</Alert>}
      {(slots.data ?? []).map((slot) => {
        const isChosen = chosen?.date === slot.date && chosen.pairNumber === slot.pairNumber;
        const isDesired =
          slot.date === request.proposedDate && slot.pairNumber === request.proposedPair;
        return (
          <ButtonBase
            key={`${slot.date}-${slot.pairNumber}`}
            aria-pressed={isChosen}
            onClick={() => {
              onChoose(isChosen ? null : slot);
            }}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 0.5,
              p: 1.5,
              textAlign: 'left',
              border: isChosen ? '1px solid' : '1px solid',
              borderColor: isChosen ? 'primary.main' : 'ge.line2',
              boxShadow: isChosen ? '0 0 0 1px var(--mui-palette-primary-main)' : 'none',
              borderRadius: '8px',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <b className="tnum">
                {formatWeekdayDate(slot.date)} · {slot.pairNumber} {r.pair}
              </b>
              {isDesired && <Chip size="small" label={r.desiredTag} color="primary" />}
            </Box>
            <Typography variant="body2" color="text.secondary" className="tnum">
              {time(slot.pairNumber)}
              {slot.freeRoomIds.length > 0
                ? ` · ${r.room} ${slot.freeRoomIds.slice(0, 3).map(roomName).join(', ')}`
                : ` · ${r.anyRoom}`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'ge.ok', display: 'flex', gap: 1.5 }}>
              <span>✓ {r.checks.group}</span>
              <span>✓ {r.checks.teacher}</span>
              <span>✓ {r.checks.room}</span>
            </Typography>
          </ButtonBase>
        );
      })}
    </Paper>
  );
}

/** Підпис чипа з лічильником («Нові 5»). */
function Counted({ text, n, bold = false }: { text: string; n: number; bold?: boolean }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', gap: 0.75, alignItems: 'baseline' }}>
      {text}
      <Box component="span" className="tnum" sx={{ fontWeight: bold ? 700 : 400 }}>
        {n}
      </Box>
    </Box>
  );
}

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

function RequestsPage() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<FreeSlotDto | null>(null);
  const list = useQuery({
    queryKey: ['requests', 'list'],
    queryFn: () => getAll('/reschedule-requests', rescheduleRequestDtoSchema),
  });
  const all = list.data ?? [];
  const count = (s: Exclude<Filter, 'ALL'>) => all.filter((x) => x.status === s).length;
  const items = filter === 'ALL' ? all : all.filter((x) => x.status === filter);
  const selected = items.find((x) => x.id === selectedId) ?? null;
  return (
    <>
      <PageHeader
        title={r.title}
        actions={
          <SegmentedControl
            ariaLabel={r.status}
            value={filter}
            onChange={(next) => {
              setFilter(next);
              setSelectedId(null);
              setChosen(null);
            }}
            options={[
              {
                value: 'PENDING' as const,
                label: <Counted text={r.newOnes} n={count('PENDING')} bold />,
              },
              {
                value: 'APPROVED' as const,
                label: <Counted text={r.approvedOnes} n={count('APPROVED')} />,
              },
              {
                value: 'REJECTED' as const,
                label: <Counted text={r.rejectedOnes} n={count('REJECTED')} />,
              },
              { value: 'ALL' as const, label: r.all },
            ]}
          />
        }
      />
      <ErrorAlert error={list.error} />
      {list.isSuccess && items.length === 0 && <Alert severity="info">{r.empty}</Alert>}
      {items.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: '360px minmax(0,1fr)',
            },
            // Три колонки (список, запит, вільні слоти) вміщаються з ~1360 px
            '@media (min-width: 1360px)': { gridTemplateColumns: '360px minmax(0,1fr) 320px' },
            gap: 2,
            alignItems: 'start',
          }}
        >
          <Paper
            variant="outlined"
            component="section"
            aria-label={r.listLabel}
            sx={{ overflow: 'hidden' }}
          >
            {items.map((x) => (
              <RequestRow
                key={x.id}
                request={x}
                selected={x.id === selectedId}
                onSelect={() => {
                  setSelectedId(x.id);
                  setChosen(null);
                }}
              />
            ))}
          </Paper>
          {selected ? (
            <>
              <RequestDetail
                key={selected.id}
                request={selected}
                chosen={chosen}
                onClearChosen={() => {
                  setChosen(null);
                }}
              />
              {selected.status === 'PENDING' && (
                <FreeSlots
                  key={`s-${selected.id}`}
                  request={selected}
                  chosen={chosen}
                  onChoose={setChosen}
                />
              )}
            </>
          ) : (
            <Alert severity="info">{r.selectRequest}</Alert>
          )}
        </Box>
      )}
    </>
  );
}
