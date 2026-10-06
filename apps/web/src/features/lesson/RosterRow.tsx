import type { GradeEntry, LessonDetailDto, RosterEntry } from '@ge/shared';
import { Box, ButtonBase, Chip, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { useRef, useState } from 'react';

import { uk } from '../../shared/i18n/uk';

import { gradeLabel, gradeTone, toggleAbsent } from './model';

type Status = RosterEntry['attendance'];
const STATUSES: Status[] = ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'];
const LONG_PRESS_MS = 450;

const statusStyle: Record<Status, { bg: string; fg: string }> = {
  PRESENT: { bg: 'transparent', fg: 'text.primary' },
  ABSENT: { bg: '#f3d9d6', fg: '#8c2f27' },
  EXCUSED: { bg: '#f6e7c8', fg: '#7a5200' },
  LATE: { bg: '#d8e5f5', fg: '#1d4e89' },
};

/**
 * Рядок студента: тап — «н» і назад, утримання — меню відміток (нп, з),
 * кнопка «+ оцінка» відкриває шторку. Статус завжди з літерою, не лише кольором.
 */
export function RosterRow({
  index,
  entry,
  scale,
  onAttendance,
  onAddGrade,
  onEditGrade,
}: {
  index: number;
  entry: RosterEntry;
  scale: LessonDetailDto['scale'];
  onAttendance: (status: Status) => void;
  onAddGrade: () => void;
  onEditGrade: (grade: GradeEntry) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const style = statusStyle[entry.attendance];
  const fullName = `${entry.lastName} ${entry.firstName}`;

  const start = (target: HTMLElement) => {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      setAnchor(target);
    }, LONG_PRESS_MS);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 60,
        px: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: style.bg,
      }}
    >
      <ButtonBase
        data-testid={`row-${entry.enrollmentId}`}
        aria-label={`${fullName}. ${uk.lesson.attendance[entry.attendance]}`}
        onPointerDown={(e) => {
          start(e.currentTarget);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => {
          e.preventDefault();
          setAnchor(e.currentTarget);
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onAttendance(toggleAbsent(entry.attendance));
        }}
        onKeyDown={(e) => {
          if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))
            setAnchor(e.currentTarget);
        }}
        sx={{
          flexGrow: 1,
          justifyContent: 'flex-start',
          textAlign: 'left',
          minHeight: 56,
          borderRadius: '6px',
          px: 1,
          gap: 1.5,
        }}
      >
        <Typography sx={{ width: 24, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {index}
        </Typography>
        <Typography sx={{ flexGrow: 1, fontSize: 17, color: style.fg }}>{fullName}</Typography>
        {entry.attendance !== 'PRESENT' && (
          <Chip
            size="small"
            label={uk.lesson.attendanceShort[entry.attendance]}
            sx={{
              fontWeight: 700,
              bgcolor: 'transparent',
              color: style.fg,
              border: 1,
              borderColor: style.fg,
            }}
          />
        )}
      </ButtonBase>

      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {entry.grades.map((g) => {
          const tone = gradeTone(scale, g.value);
          return (
            <Chip
              key={g.id}
              clickable
              label={gradeLabel(scale, g.value)}
              onClick={() => {
                onEditGrade(g);
              }}
              aria-label={`${uk.lesson.gradeKinds[g.kind]} ${gradeLabel(scale, g.value)}`}
              sx={{
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 600,
                minWidth: 40,
                bgcolor: tone === 'low' ? '#f3d9d6' : tone === 'high' ? '#d9ecd9' : undefined,
              }}
            />
          );
        })}
        <IconButton
          aria-label={uk.lesson.addGradeFor(fullName)}
          onClick={onAddGrade}
          sx={{
            width: 48,
            height: 48,
            fontSize: 14,
            fontWeight: 700,
            border: 1,
            borderColor: 'divider',
            borderRadius: '8px',
          }}
        >
          +
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
      >
        {STATUSES.map((s) => (
          <MenuItem
            key={s}
            selected={s === entry.attendance}
            onClick={() => {
              onAttendance(s);
              setAnchor(null);
            }}
            sx={{ minHeight: 48 }}
          >
            {uk.lesson.attendance[s]}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
