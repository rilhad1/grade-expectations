import type { LessonKind, LoadDto } from '@ge/shared';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { Box, FormControlLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material';

import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';

import { loadNav } from './loadNav';

const KEYS: [string, string][] = [
  ['← → ↑ ↓', uk.gradebook.keys.move],
  ['1–12', uk.gradebook.keys.grade],
  ['Н', uk.gradebook.keys.absent],
  ['Enter', uk.gradebook.keys.sheet],
  ['Delete', uk.gradebook.keys.clear],
];

/** Вибір журналу (дисципліна, група, вид заняття) і довідка з клавіатури. */
export function GradebookToolbar({
  loads,
  currentId,
  onPick,
  period,
  kinds,
  kindFilter,
  onKindFilter,
  hasFuture = false,
  showFuture = false,
  onShowFuture,
}: {
  loads: readonly LoadDto[];
  currentId: string;
  onPick: (loadId: string) => void;
  period?: React.ReactNode;
  /** Види занять, що є в журналі, — для фільтра (одного виду фільтр не потрібен). */
  kinds: readonly LessonKind[];
  kindFilter: 'ALL' | LessonKind;
  onKindFilter: (kind: 'ALL' | LessonKind) => void;
  /** Є заняття після сьогодні: показуємо перемикач «Майбутні». */
  hasFuture?: boolean;
  showFuture?: boolean;
  onShowFuture?: (show: boolean) => void;
}) {
  const nav = loadNav(loads, currentId);
  if (!nav) return <Box sx={{ mb: 2 }}>{period}</Box>;
  const current = loads.find((l) => l.id === currentId);

  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Select
          size="small"
          value={current?.discipline.id ?? ''}
          onChange={(e) => {
            const id = nav.forDiscipline(e.target.value);
            if (id) onPick(id);
          }}
          inputProps={{ 'aria-label': uk.gradebook.discipline }}
          IconComponent={ExpandMore}
          renderValue={() => (
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <DisciplineDot color={current?.discipline.color ?? '#5D6B78'} size={8} gap={1} />
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {current?.discipline.title}
              </Box>
            </Box>
          )}
          sx={{ minWidth: 200, maxWidth: '100%', height: 36, fontWeight: 500 }}
        >
          {nav.disciplines.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              <DisciplineDot color={d.color} size={8} gap={1} />
              {d.title}
            </MenuItem>
          ))}
        </Select>

        {nav.groups.length > 1 && (
          <SegmentedControl
            ariaLabel={uk.gradebook.group}
            value={current?.group.id ?? ''}
            onChange={(id) => {
              const target = nav.forGroup(id);
              if (target) onPick(target);
            }}
            options={nav.groups.map((g) => ({ value: g.id, label: g.name }))}
          />
        )}

        {nav.subgroups.length > 1 && (
          <SegmentedControl
            ariaLabel={uk.gradebook.subgroup}
            value={current?.subgroup?.id ?? ''}
            onChange={(id) => {
              const target = nav.forSubgroup(id === '' ? null : id);
              if (target) onPick(target);
            }}
            options={nav.subgroups.map((sg) => ({
              value: sg.id ?? '',
              label: sg.name ?? uk.gradebook.wholeGroup,
            }))}
          />
        )}

        {kinds.length > 1 && (
          <SegmentedControl
            ariaLabel={uk.gradebook.kind}
            value={kindFilter}
            onChange={onKindFilter}
            options={[
              { value: 'ALL' as const, label: uk.gradebook.kindFilter.ALL },
              ...kinds.map((k) => ({ value: k, label: uk.gradebook.kindFilter[k] })),
            ]}
          />
        )}

        {hasFuture && onShowFuture && (
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Switch
                size="small"
                checked={showFuture}
                onChange={(e) => {
                  onShowFuture(e.target.checked);
                }}
              />
            }
            label={uk.gradebook.showFuture}
          />
        )}

        {period}
        <Box sx={{ flex: 1 }} />
        <Typography
          variant="caption"
          color="ge.text3"
          sx={{ display: { xs: 'none', lg: 'block' } }}
        >
          {uk.gradebook.legend}
        </Typography>
      </Stack>
      <Stack
        direction="row"
        spacing={2}
        flexWrap="wrap"
        useFlexGap
        sx={{ display: { xs: 'none', md: 'flex' }, fontSize: 12, color: 'ge.text3' }}
      >
        {KEYS.map(([key, label]) => (
          <span key={key}>
            <Box component="b" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {key}
            </Box>{' '}
            {label}
          </span>
        ))}
        <span>{uk.gradebook.keys.card}</span>
      </Stack>
    </Stack>
  );
}
