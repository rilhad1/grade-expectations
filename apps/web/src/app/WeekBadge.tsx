import { weekParity, type SemesterInput } from '@ge/domain';
import type { SemesterFullDto } from '@ge/shared';
import { Chip } from '@mui/material';

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

/** Бейдж «Верхній/Нижній тиждень» для сьогоднішньої дати (лише всередині семестру). */
export function WeekBadge({
  semester,
  today = todayKyiv(),
  onDark = true,
}: {
  semester: SemesterFullDto | null;
  today?: string;
  onDark?: boolean;
}) {
  if (!semester || today < semester.startDate || today > semester.endDate) return null;
  const parity = weekParity(today, toSemesterInput(semester));
  return (
    <Chip
      size="small"
      variant="outlined"
      label={parity === 'TOP' ? uk.header.topWeek : uk.header.bottomWeek}
      {...(onDark && { sx: { color: 'inherit', borderColor: 'currentColor' } })}
    />
  );
}
