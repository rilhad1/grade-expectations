import { Box, Paper, Stack, Typography } from '@mui/material';

import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { disciplineTone } from '../../shared/ui/discipline';

import { startDrag } from './ScheduleGrid';
import { loadCaption, type UnplacedLoad } from './model';

/** Ліва панель: навантаження, ще не розставлене в розклад. Картки перетягуються в сітку. */
export function UnplacedPanel({
  items,
  disabled,
  roomView,
}: {
  items: readonly UnplacedLoad[];
  disabled: boolean;
  roomView: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        width: { xs: '100%', lg: 280 },
        flexShrink: 0,
        maxHeight: { lg: 'calc(100vh - 220px)' },
        overflow: 'auto',
      }}
    >
      <Typography variant="subtitle1" component="h2" sx={{ mb: 0.5 }}>
        {uk.builder.unplaced}: {items.length}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
        {roomView ? uk.builder.unplacedRoomView : uk.builder.unplacedHint}
      </Typography>
      {!roomView && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {uk.builder.unplacedEmpty}
        </Typography>
      )}
      <Stack spacing={1}>
        {items.map(({ load, missingHours, pairsPerWeek }) => (
          <Box
            key={load.id}
            draggable={!disabled}
            data-testid={`load-${load.id}`}
            onDragStart={(e) => {
              startDrag(e, { kind: 'load', id: load.id });
            }}
            sx={{
              p: 1,
              borderRadius: '6px',
              border: 1,
              borderColor: disciplineTone(load.discipline.color).border,
              cursor: disabled ? 'default' : 'grab',
              bgcolor: disciplineTone(load.discipline.color).tint,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              <DisciplineDot color={load.discipline.color} size={8} />
              {loadCaption(load)} · {uk.loads.kindsShort[load.kind]}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              {load.teacher.fullName}
            </Typography>
            <Typography
              variant="caption"
              component="div"
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              ≈{pairsPerWeek} {uk.builder.perWeek} · {uk.builder.missing} {missingHours} год
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}
