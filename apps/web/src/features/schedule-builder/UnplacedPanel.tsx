import SearchIcon from '@mui/icons-material/Search';
import { Box, Chip, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

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
  const [text, setText] = useState('');
  const [kind, setKind] = useState<UnplacedLoad['load']['kind'] | null>(null);
  const kinds = [...new Set(items.map((i) => i.load.kind))];
  const needle = text.trim().toLowerCase();
  const shown = items.filter(
    ({ load }) =>
      (kind === null || load.kind === kind) &&
      (needle === '' ||
        `${loadCaption(load)} ${load.teacher.fullName}`.toLowerCase().includes(needle)),
  );
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby="loads-panel"
      sx={{
        p: 1.5,
        width: '100%',
        maxHeight: { lg: 'calc(100vh - 220px)' },
        overflow: 'auto',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography id="loads-panel" variant="subtitle1" component="h2">
          {uk.builder.loadsPanel}
        </Typography>
        <Chip
          size="small"
          color={items.length > 0 ? 'warning' : 'default'}
          label={`${uk.builder.unplaced}: ${String(items.length)}`}
        />
      </Box>
      <TextField
        size="small"
        fullWidth
        placeholder={uk.builder.filterLoads}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
        }}
        slotProps={{
          htmlInput: { 'aria-label': uk.builder.filterLoads },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1 }}
      />
      {kinds.length > 1 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <Chip
            size="small"
            label={uk.gradebook.kindFilter.ALL}
            color={kind === null ? 'primary' : 'default'}
            onClick={() => {
              setKind(null);
            }}
          />
          {kinds.map((k) => (
            <Chip
              key={k}
              size="small"
              label={uk.loads.kindsShort[k]}
              color={kind === k ? 'primary' : 'default'}
              onClick={() => {
                setKind(kind === k ? null : k);
              }}
            />
          ))}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
        {roomView ? uk.builder.unplacedRoomView : uk.builder.unplacedHint}
      </Typography>
      {!roomView && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {uk.builder.unplacedEmpty}
        </Typography>
      )}
      <Stack spacing={1}>
        {shown.map(({ load, missingHours, pairsPerWeek }) => (
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
