import type { BellDto, LoadDto, RoomDto, SlotDto } from '@ge/shared';
import { Box, ButtonBase, Typography } from '@mui/material';
import { useState, type DragEvent } from 'react';

import { uk } from '../../shared/i18n/uk';
import { disciplineTone } from '../../shared/ui/discipline';

import { loadCaption, slotsInCell, type SlotParityValue } from './model';

const DRAG_TYPE = 'application/x-ge-drag';
export type DragPayload = { kind: 'load' | 'slot'; id: string };

const encode = (payload: DragPayload) => JSON.stringify(payload);
export function decodeDrag(event: DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    const parsed = JSON.parse(raw) as Partial<DragPayload>;
    return (parsed.kind === 'load' || parsed.kind === 'slot') && typeof parsed.id === 'string'
      ? { kind: parsed.kind, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

/** Початок перетягування: використовується і картками навантаження, і слотами. */
export function startDrag(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(DRAG_TYPE, encode(payload));
  event.dataTransfer.effectAllowed = 'move';
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

interface Props {
  bells: readonly BellDto[];
  slots: readonly SlotDto[];
  loadsById: ReadonlyMap<string, LoadDto>;
  roomsById: ReadonlyMap<string, RoomDto>;
  conflictSlotIds: ReadonlySet<string>;
  readOnly: boolean;
  onDrop: (
    payload: DragPayload,
    weekday: number,
    pairNumber: number,
    parity: SlotParityValue,
  ) => void;
  onSelectSlot: (slot: SlotDto) => void;
}

function SlotCard({
  slot,
  load,
  room,
  conflict,
  readOnly,
  onSelect,
}: {
  slot: SlotDto;
  load: LoadDto | undefined;
  room: RoomDto | undefined;
  conflict: boolean;
  readOnly: boolean;
  onSelect: () => void;
}) {
  const tone = disciplineTone(load?.discipline.color ?? '#5D6B78');
  return (
    <ButtonBase
      draggable={!readOnly}
      onDragStart={(e) => {
        startDrag(e, { kind: 'slot', id: slot.id });
      }}
      onClick={onSelect}
      aria-label={`${load ? loadCaption(load) : ''} ${load ? uk.loads.kindsShort[load.kind] : ''}`.trim()}
      data-testid={`slot-${slot.id}`}
      data-conflict={conflict ? 'true' : undefined}
      sx={{
        display: 'block',
        textAlign: 'left',
        width: '100%',
        px: 0.75,
        py: 0.5,
        borderRadius: '6px',
        border: conflict ? '2px solid' : '1px solid',
        borderColor: conflict ? 'ge.err' : tone.border,
        bgcolor: tone.tint,
        boxShadow: conflict
          ? '0 0 0 3px color-mix(in srgb, var(--mui-palette-ge-err) 14%, transparent)'
          : 'none',
        fontSize: 12,
        lineHeight: 1.25,
        cursor: readOnly ? 'pointer' : 'grab',
      }}
    >
      <Typography component="span" sx={{ display: 'block', fontSize: 12, fontWeight: 600 }}>
        {load?.discipline.shortTitle} · {load ? uk.loads.kindsShort[load.kind] : ''}
      </Typography>
      <Typography component="span" sx={{ display: 'block', fontSize: 11 }}>
        {load?.group.name}
        {load?.subgroup ? ` · ${load.subgroup.name}` : ''}
      </Typography>
      <Typography component="span" color="text.secondary" sx={{ display: 'block', fontSize: 11 }}>
        {load?.teacher.fullName}
        {room ? ` · ${room.name}` : ''}
      </Typography>
    </ButtonBase>
  );
}

function Zone({
  label,
  ariaLabel,
  testId,
  onDropped,
  readOnly,
  children,
  strip = false,
}: {
  label: string;
  ariaLabel: string;
  testId: string;
  onDropped: (e: DragEvent) => void;
  readOnly: boolean;
  children?: React.ReactNode;
  strip?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <Box
      data-testid={testId}
      role="group"
      aria-label={ariaLabel}
      onDragOver={(e) => {
        if (!readOnly) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!readOnly) onDropped(e);
      }}
      sx={{
        position: 'relative',
        flex: strip ? '0 0 auto' : 1,
        minHeight: strip ? 18 : 40,
        p: 0.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        bgcolor: over ? 'action.hover' : 'transparent',
        outline: over ? '2px dashed' : 'none',
        outlineColor: 'primary.main',
        outlineOffset: -2,
      }}
    >
      <Typography
        component="span"
        sx={{
          position: 'absolute',
          right: 4,
          top: 1,
          fontSize: 9,
          color: 'text.disabled',
          pointerEvents: 'none',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

/** Сітка «день × пара»: кожна клітинка поділена на «щотижня», верхній і нижній тиждень. */
export function ScheduleGrid({
  bells,
  slots,
  loadsById,
  roomsById,
  conflictSlotIds,
  readOnly,
  onDrop,
  onSelectSlot,
}: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '84px repeat(6, minmax(140px, 1fr))',
        border: 1,
        borderColor: 'divider',
        borderRadius: '10px',
        overflow: 'auto',
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 1 }} />
      {WEEKDAYS.map((day) => (
        <Box
          key={day}
          sx={{
            borderBottom: 1,
            borderLeft: 1,
            borderColor: 'divider',
            p: 1,
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {uk.weekday[day - 1]}
        </Box>
      ))}

      {bells.map((bell) => (
        <Box key={bell.pairNumber} sx={{ display: 'contents' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 1, fontSize: 12 }}>
            <strong>{bell.pairNumber}</strong>
            <Typography
              component="div"
              variant="caption"
              color="text.secondary"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {bell.startsAt}–{bell.endsAt}
            </Typography>
          </Box>
          {WEEKDAYS.map((day) => {
            const cell = slotsInCell(slots, day, bell.pairNumber);
            const render = (parity: SlotParityValue) =>
              cell
                .filter((s) => s.parity === parity)
                .map((s) => (
                  <SlotCard
                    key={s.id}
                    slot={s}
                    load={loadsById.get(s.loadId)}
                    room={s.roomId ? roomsById.get(s.roomId) : undefined}
                    conflict={conflictSlotIds.has(s.id)}
                    readOnly={readOnly}
                    onSelect={() => {
                      onSelectSlot(s);
                    }}
                  />
                ));
            const drop = (parity: SlotParityValue) => (e: DragEvent) => {
              const payload = decodeDrag(e);
              if (payload) onDrop(payload, day, bell.pairNumber, parity);
            };
            const name = `${uk.weekday[day - 1]}, ${bell.pairNumber} ${uk.builder.pairLabel}`;
            return (
              <Box
                key={day}
                sx={{
                  borderBottom: 1,
                  borderLeft: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 112,
                }}
              >
                <Zone
                  strip
                  label={uk.builder.every}
                  ariaLabel={`${name}, ${uk.builder.every}`}
                  testId={`zone-${day}-${bell.pairNumber}-EVERY`}
                  readOnly={readOnly}
                  onDropped={drop('EVERY')}
                >
                  {render('EVERY')}
                </Zone>
                <Zone
                  label={uk.builder.topShort}
                  ariaLabel={`${name}, ${uk.builder.parity.TOP}`}
                  testId={`zone-${day}-${bell.pairNumber}-TOP`}
                  readOnly={readOnly}
                  onDropped={drop('TOP')}
                >
                  {render('TOP')}
                </Zone>
                <Zone
                  label={uk.builder.bottomShort}
                  ariaLabel={`${name}, ${uk.builder.parity.BOTTOM}`}
                  testId={`zone-${day}-${bell.pairNumber}-BOTTOM`}
                  readOnly={readOnly}
                  onDropped={drop('BOTTOM')}
                >
                  {render('BOTTOM')}
                </Zone>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
