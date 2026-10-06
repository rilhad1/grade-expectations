import { weekParity, type SemesterInput } from '@ge/domain';
import type { SemesterFullDto } from '@ge/shared';
import { Box } from '@mui/material';

import { uk } from '../shared/i18n/uk';

import { todayKyiv } from './today';

/** Перетворює DTO семестру на вхід доменних функцій. */
export const toSemesterInput = (s: SemesterFullDto): SemesterInput => ({
  startDate: s.startDate,
  endDate: s.endDate,
  firstWeekParity: s.firstWeekParity,
  parityAfterBreak: s.parityAfterBreak,
  periods: s.periods.map((p) => ({ kind: p.kind, startDate: p.startDate, endDate: p.endDate })),
});

/** Дві смужки: заповнена верхня або нижня — який зараз тиждень. */
export function WeekGlyph({ parity }: { parity: 'TOP' | 'BOTTOM' }) {
  const bar = (filled: boolean) => (
    <Box
      component="i"
      sx={{
        display: 'block',
        height: 4,
        borderRadius: '1px',
        boxSizing: 'border-box',
        ...(filled
          ? { bgcolor: 'primary.main' }
          : { border: '1px solid', borderColor: 'primary.main' }),
      }}
    />
  );
  return (
    <Box
      component="span"
      aria-hidden
      sx={{ display: 'flex', flexDirection: 'column', gap: '2px', width: 12 }}
    >
      {bar(parity === 'TOP')}
      {bar(parity === 'BOTTOM')}
    </Box>
  );
}

/** Бейдж «Верхній/Нижній тиждень» для сьогоднішньої дати (лише всередині семестру). */
export function WeekBadge({
  semester,
  today = todayKyiv(),
  large = false,
}: {
  semester: SemesterFullDto | null;
  today?: string;
  large?: boolean;
}) {
  if (!semester || today < semester.startDate || today > semester.endDate) return null;
  const parity = weekParity(today, toSemesterInput(semester));
  return (
    <Box
      component="span"
      title={uk.header.weekHint}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        height: large ? 26 : 24,
        pl: 1,
        pr: 1.25,
        borderRadius: '13px',
        bgcolor: 'ge.accentSoft',
        border: '1px solid',
        borderColor: 'ge.accentLine',
        color: 'primary.main',
        fontSize: large ? 13 : 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <WeekGlyph parity={parity} />
      {parity === 'TOP' ? uk.header.topWeek : uk.header.bottomWeek}
    </Box>
  );
}
