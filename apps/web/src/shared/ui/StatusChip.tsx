import type { AttendanceStatus } from '@ge/shared';
import { Box } from '@mui/material';

import { uk } from '../i18n/uk';

type Size = 'sm' | 'md';

const KEY = { ABSENT: 'absent', EXCUSED: 'excused', LATE: 'late', PRESENT: 'present' } as const;

/** Чип статусу відвідуваності: завжди з літерою («н», «нп», «з»), колір лише підсилює. */
export function StatusChip({
  status,
  size = 'md',
  present = false,
}: {
  status: AttendanceStatus;
  size?: Size;
  /** Показувати «✓» для присутнього (за замовчуванням присутній нічого не показує). */
  present?: boolean;
}) {
  if (status === 'PRESENT' && !present) return null;
  const k = KEY[status];
  const label = status === 'PRESENT' ? '✓' : uk.lesson.attendanceShort[status];
  return (
    <Box
      component="span"
      title={uk.lesson.attendance[status]}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size === 'md' ? 28 : 24,
        height: size === 'md' ? 24 : 20,
        px: size === 'md' ? 0.75 : 0.5,
        borderRadius: '4px',
        fontSize: size === 'md' ? 13 : 12,
        fontWeight: 700,
        flexShrink: 0,
        bgcolor: `ge.att.${k}.bg`,
        color: `ge.att.${k}.fg`,
      }}
    >
      {label}
    </Box>
  );
}
