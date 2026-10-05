import type { ScheduleDto, SlotDto } from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { toSemesterInput } from '../../../app/WeekBadge';
import { ConflictsPanel } from '../../../features/schedule-builder/ConflictsPanel';
import { PublishDialog } from '../../../features/schedule-builder/PublishDialog';
import { ScheduleGrid, type DragPayload } from '../../../features/schedule-builder/ScheduleGrid';
import { SlotDialog } from '../../../features/schedule-builder/SlotDialog';
import { UnplacedPanel } from '../../../features/schedule-builder/UnplacedPanel';
import {
  createDraft,
  createSlot,
  discardDraft,
  fetchConflicts,
  fetchSchedule,
  fetchSchedules,
  updateSlot,
} from '../../../features/schedule-builder/api';
import {
  loadsForView,
  slotsForView,
  unplacedLoads,
  weeksBetween,
  type BuilderView,
  type SlotParityValue,
} from '../../../features/schedule-builder/model';
import { formatShortDate } from '../../../shared/format';
import { uk } from '../../../shared/i18n/uk';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';

export const Route = createFileRoute('/_app/admin/schedule-builder')({ component: BuilderPage });

const b = uk.builder;
const EMPTY: never[] = [];

function BuilderPage() {
  const queryClient = useQueryClient();
  const { semester } = useCurrentSemester();
  const semesterId = semester?.id ?? '';
  const enabled = semester !== null;

  const loadsQ = useQuery({ ...q.loads(semesterId), enabled });
  const roomsQ = useQuery(q.rooms());
  const bellsQ = useQuery(q.bells());
  const groupsQ = useQuery({ ...q.groups(semester?.academicYearId), enabled });
  const schedulesQ = useQuery({
    queryKey: ['schedules', semesterId],
    queryFn: () => fetchSchedules(semesterId),
    enabled,
  });

  const schedules = schedulesQ.data ?? EMPTY;
  const draft: ScheduleDto | undefined = schedules.find((s) => s.status === 'DRAFT');
  const published = [...schedules]
    .filter((s) => s.status === 'PUBLISHED')
    .sort((a, c) => c.revision - a.revision)[0];
  const current = draft ?? published;
  const editable = draft !== undefined && semester?.status !== 'CLOSED';

  const scheduleQ = useQuery({
    queryKey: ['schedule', current?.id],
    queryFn: () => fetchSchedule(current?.id ?? ''),
    enabled: current !== undefined,
  });
  const conflictsQ = useQuery({
    queryKey: ['schedule', draft?.id, 'conflicts'],
    queryFn: () => fetchConflicts(draft?.id ?? ''),
    enabled: draft !== undefined,
  });

  const [view, setView] = useState<BuilderView>('group');
  const [picked, setPicked] = useState<Record<BuilderView, string>>({
    group: '',
    teacher: '',
    room: '',
  });
  const [selectedSlot, setSelectedSlot] = useState<SlotDto | null>(null);
  const [publishing, setPublishing] = useState(false);

  const loads = loadsQ.data ?? EMPTY;
  const rooms = roomsQ.data ?? EMPTY;
  const bells = bellsQ.data ?? EMPTY;
  const slots = scheduleQ.data?.slots ?? EMPTY;
  const conflicts = conflictsQ.data ?? EMPTY;

  const options = useMemo(() => {
    const teachers = [
      ...new Map(loads.map((l) => [l.teacher.id, l.teacher.fullName])).entries(),
    ].map(([id, name]) => ({ id, name }));
    return {
      group: (groupsQ.data ?? EMPTY).map((g) => ({ id: g.id, name: g.name })),
      teacher: teachers,
      room: rooms.map((r) => ({ id: r.id, name: r.name })),
    };
  }, [loads, groupsQ.data, rooms]);
  const currentId = options[view].some((o) => o.id === picked[view])
    ? picked[view]
    : (options[view][0]?.id ?? '');

  const loadsById = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const roomsById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const visibleSlots = useMemo(
    () => slotsForView(view, currentId, slots, loadsById),
    [view, currentId, slots, loadsById],
  );
  const conflictSlotIds = useMemo(() => new Set(conflicts.flatMap((c) => c.slotIds)), [conflicts]);
  const unplaced = useMemo(
    () =>
      semester
        ? unplacedLoads(
            loadsForView(view, currentId, loads),
            slots,
            toSemesterInput(semester),
            weeksBetween(semester.startDate, semester.endDate),
          )
        : [],
    [semester, view, currentId, loads, slots],
  );

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['schedule'] });
    await queryClient.invalidateQueries({ queryKey: ['schedules'] });
  };
  const create = useMutation({ mutationFn: () => createDraft(semesterId), onSuccess: refresh });
  const discard = useMutation({
    mutationFn: () => discardDraft(draft?.id ?? ''),
    onSuccess: refresh,
  });
  const drop = useMutation({
    mutationFn: async ({
      payload,
      weekday,
      pairNumber,
      parity,
    }: {
      payload: DragPayload;
      weekday: number;
      pairNumber: number;
      parity: SlotParityValue;
    }) => {
      if (payload.kind === 'load') {
        if (!draft) return;
        await createSlot(draft.id, {
          loadId: payload.id,
          weekday,
          pairNumber,
          parity,
          ...(view === 'room' && { roomId: currentId }),
        });
      } else {
        const slot = slots.find((s) => s.id === payload.id);
        if (slot) await updateSlot(slot.id, slot.version, { weekday, pairNumber, parity });
      }
    },
    onSuccess: refresh,
  });

  if (!semester) return <Alert severity="info">{b.noSemester}</Alert>;

  const status = draft ? (
    <Chip
      color={draft.changedFromPublished ? 'warning' : 'default'}
      label={draft.changedFromPublished ? b.statusDirty : b.statusDraft}
    />
  ) : published ? (
    <Chip
      color="success"
      variant="outlined"
      label={`${b.statusPublished} ${published.publishedAt ? formatShortDate(published.publishedAt.slice(0, 10)) : ''}`}
    />
  ) : null;

  return (
    <>
      <PageHeader
        title={b.title}
        actions={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {current && (
              <Chip size="small" variant="outlined" label={`${b.revision} ${current.revision}`} />
            )}
            {status}
            {editable ? (
              <>
                <Button
                  color="warning"
                  onClick={() => {
                    if (window.confirm(b.discardConfirm)) discard.mutate();
                  }}
                >
                  {b.discardDraft}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    setPublishing(true);
                  }}
                >
                  {b.publish}
                </Button>
              </>
            ) : (
              semester.status !== 'CLOSED' && (
                <Button
                  variant="contained"
                  disabled={create.isPending || !schedulesQ.isSuccess}
                  onClick={() => {
                    create.mutate();
                  }}
                >
                  {b.createDraft}
                </Button>
              )
            )}
          </Stack>
        }
      />

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v: BuilderView | null) => {
            if (v) setView(v);
          }}
          aria-label={b.view}
        >
          {(['group', 'teacher', 'room'] as const).map((v) => (
            <ToggleButton key={v} value={v}>
              {b.views[v]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          select
          size="small"
          label={b.pick[view]}
          value={currentId}
          onChange={(e) => {
            setPicked({ ...picked, [view]: e.target.value });
          }}
          sx={{ minWidth: 220 }}
        >
          {options[view].map((o) => (
            <MenuItem key={o.id} value={o.id}>
              {o.name}
            </MenuItem>
          ))}
        </TextField>
        {editable && (
          <Box component="span" sx={{ color: 'text.secondary', fontSize: 13 }}>
            {b.saved}
          </Box>
        )}
      </Stack>

      <ErrorAlert error={create.error ?? discard.error ?? drop.error ?? scheduleQ.error} />
      {schedulesQ.isSuccess && !current && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {b.noSchedule}
        </Alert>
      )}
      {current && !editable && semester.status !== 'CLOSED' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {b.readOnlyPublished}
        </Alert>
      )}

      {current && (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
          {editable && (
            <UnplacedPanel items={unplaced} disabled={!editable} roomView={view === 'room'} />
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
            <ScheduleGrid
              bells={bells}
              slots={visibleSlots}
              loadsById={loadsById}
              roomsById={roomsById}
              conflictSlotIds={conflictSlotIds}
              readOnly={!editable}
              onDrop={(payload, weekday, pairNumber, parity) => {
                drop.mutate({ payload, weekday, pairNumber, parity });
              }}
              onSelectSlot={setSelectedSlot}
            />
          </Box>
          {editable && <ConflictsPanel conflicts={conflicts} />}
        </Stack>
      )}

      {selectedSlot && (
        <SlotDialog
          key={selectedSlot.id}
          slot={selectedSlot}
          load={loadsById.get(selectedSlot.loadId)}
          rooms={rooms}
          pairNumbers={bells.map((x) => x.pairNumber)}
          readOnly={!editable}
          onClose={() => {
            setSelectedSlot(null);
          }}
          onChanged={refresh}
        />
      )}
      {publishing && draft && (
        <PublishDialog
          scheduleId={draft.id}
          onClose={() => {
            setPublishing(false);
          }}
        />
      )}
    </>
  );
}
