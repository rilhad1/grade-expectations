import type { GradeEntry, LessonDetailDto, RosterEntry } from '@ge/shared';
import { Box, ButtonBase, Menu, MenuItem, Typography } from '@mui/material';
import { useRef, useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { GradeChip } from '../../shared/ui/GradeChip';
import { StatusChip } from '../../shared/ui/StatusChip';

import { gradeLabel, toggleAbsent } from './model';

type Status = RosterEntry['attendance'];
const STATUSES: Status[] = ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'];
const LONG_PRESS_MS = 450;

const rowBg: Record<Status, string> = {
  PRESENT: 'background.paper',
  ABSENT: 'ge.att.absent.row',
  EXCUSED: 'ge.att.excused.row',
  LATE: 'background.paper',
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
  const fullName = `${entry.lastName} ${entry.firstName}`;
  const away = entry.attendance === 'ABSENT' || entry.attendance === 'EXCUSED';

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
        pl: 1,
        pr: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: rowBg[entry.attendance],
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
          minWidth: 0,
          justifyContent: 'flex-start',
          textAlign: 'left',
          minHeight: 60,
          borderRadius: '6px',
          px: 0.5,
          gap: 1,
        }}
      >
        <Typography
          className="tnum"
          sx={{ width: 22, textAlign: 'right', fontSize: 13, color: 'ge.text3', flexShrink: 0 }}
        >
          {index}
        </Typography>
        <Typography
          noWrap
          sx={{
            flexGrow: 1,
            minWidth: 0,
            fontSize: 16,
            color: away ? 'text.secondary' : 'text.primary',
          }}
        >
          {fullName}
        </Typography>
        <StatusChip status={entry.attendance} />
      </ButtonBase>

      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
        {entry.grades.map((g) => (
          <ButtonBase
            key={g.id}
            onClick={() => {
              onEditGrade(g);
            }}
            aria-label={`${uk.lesson.gradeKinds[g.kind]} ${gradeLabel(scale, g.value)}`}
            sx={{ borderRadius: '6px', minWidth: 30 }}
          >
            <GradeChip value={g.value} scale={scale} />
          </ButtonBase>
        ))}
        <ButtonBase
          aria-label={uk.lesson.addGradeFor(fullName)}
          onClick={onAddGrade}
          sx={{
            height: 44,
            px: 1.25,
            border: 1,
            borderColor: 'ge.line2',
            borderRadius: '6px',
            bgcolor: 'background.paper',
            color: 'primary.main',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {uk.lesson.addGrade}
        </ButtonBase>
      </Box>

      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
        slotProps={{ paper: { sx: { width: 260 } } }}
      >
        {STATUSES.map((s) => (
          <MenuItem
            key={s}
            selected={s === entry.attendance}
            onClick={() => {
              onAttendance(s);
              setAnchor(null);
            }}
            sx={{ minHeight: 48, gap: 1.5 }}
          >
            <StatusChip status={s} present />
            {uk.lesson.attendance[s]}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
