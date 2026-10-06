import type { LoadDto } from '@ge/shared';
import ExpandMore from '@mui/icons-material/ExpandMore';
import { Box, MenuItem, Select, Stack, Typography } from '@mui/material';

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
}: {
  loads: readonly LoadDto[];
  currentId: string;
  onPick: (loadId: string) => void;
  period?: React.ReactNode;
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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <DisciplineDot color={current?.discipline.color ?? '#5D6B78'} size={8} gap={1} />
              {current?.discipline.title}
            </Box>
          )}
          sx={{ minWidth: 200, height: 36, fontWeight: 500 }}
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

        {nav.variants.length > 1 && (
          <SegmentedControl
            ariaLabel={uk.gradebook.kind}
            value={currentId}
            onChange={onPick}
            options={nav.variants.map((v) => ({
              value: v.id,
              label: `${uk.loads.kindsShort[v.kind]}${v.subgroupName ? ` · ${v.subgroupName}` : ''}`,
            }))}
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
