import type { GradeEntry, LessonDetailDto, RosterEntry } from '@ge/shared';
import AddIcon from '@mui/icons-material/Add';
import { Box, ButtonBase, Menu, MenuItem, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { GradeChip } from '../../shared/ui/GradeChip';
import { StatusChip } from '../../shared/ui/StatusChip';

import { gradeLabel, isValidGrade } from './model';

type Status = RosterEntry['attendance'];
const STATUSES: Status[] = ['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'];

const rowBg: Record<Status, string> = {
  PRESENT: 'background.paper',
  ABSENT: 'ge.att.absent.row',
  EXCUSED: 'ge.att.excused.row',
  LATE: 'background.paper',
};

/**
 * Рядок студента (макет C): прізвище, явний перемикач «Був | н», оцінки чіпами й поле швидкої оцінки.
 * Тап по прізвищу відкриває меню всіх відміток (нп, з); «+» відкриває шторку з типом оцінки.
 * Статус завжди з літерою, не лише кольором.
 */
export function RosterRow({
  index,
  entry,
  scale,
  onAttendance,
  onAddGrade,
  onQuickGrade,
  onEditGrade,
}: {
  index: number;
  entry: RosterEntry;
  scale: LessonDetailDto['scale'];
  onAttendance: (status: Status) => void;
  onAddGrade: () => void;
  /** Оцінка, вписана у поле рядка (тип — за видом заняття). */
  onQuickGrade: (value: number) => void;
  onEditGrade: (grade: GradeEntry) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [text, setText] = useState('');
  const fullName = `${entry.lastName} ${entry.firstName}`;
  const away = entry.attendance === 'ABSENT' || entry.attendance === 'EXCUSED';
  const absent = entry.attendance === 'ABSENT';
  const present = entry.attendance === 'PRESENT';
  const typed = text.trim() === '' ? null : Number(text);
  const invalid = typed !== null && !isValidGrade(scale, typed);
  // Для «зараховано / не зараховано» вводити нічого: оцінка ставиться шторкою
  const quickField = scale !== 'PASS_FAIL';

  const commit = () => {
    if (typed === null || invalid) return;
    onQuickGrade(typed);
    setText('');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 1,
        rowGap: 0,
        py: 0.5,
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
        aria-haspopup="menu"
        onClick={(e) => {
          setAnchor(e.currentTarget);
        }}
        sx={{
          flex: { xs: '1 1 100%', sm: '1 1 0' },
          minWidth: 0,
          justifyContent: 'flex-start',
          textAlign: 'left',
          minHeight: 36,
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
            fontSize: 17,
            color: away ? 'text.secondary' : 'text.primary',
          }}
        >
          {fullName}
        </Typography>
        {!present && !absent && <StatusChip status={entry.attendance} />}
      </ButtonBase>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          pl: { xs: 3.5, sm: 0 },
          width: { xs: '100%', sm: 'auto' },
        }}
      >
        <Box
          role="radiogroup"
          aria-label={uk.lesson.attendanceToggleFor(fullName)}
          sx={{
            display: 'inline-flex',
            border: 1,
            borderColor: 'ge.line2',
            borderRadius: '8px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <ButtonBase
            role="radio"
            aria-checked={present}
            data-testid={`present-${entry.enrollmentId}`}
            onClick={() => {
              onAttendance('PRESENT');
            }}
            sx={{
              minWidth: 56,
              height: 40,
              px: 1.5,
              fontSize: 15,
              fontWeight: present ? 600 : 500,
              bgcolor: present ? 'ge.accentSoft' : 'background.paper',
              color: present ? 'primary.main' : 'text.secondary',
            }}
          >
            {uk.lesson.wasPresent}
          </ButtonBase>
          <ButtonBase
            role="radio"
            aria-checked={absent}
            data-testid={`absent-${entry.enrollmentId}`}
            onClick={() => {
              onAttendance('ABSENT');
            }}
            sx={{
              minWidth: 56,
              height: 40,
              px: 1.5,
              fontSize: 15,
              fontWeight: absent ? 700 : 500,
              borderLeft: 1,
              borderColor: 'ge.line2',
              bgcolor: absent ? 'ge.errBg' : 'background.paper',
              color: absent ? 'ge.errFg' : 'text.secondary',
            }}
          >
            {uk.lesson.attendanceShort.ABSENT}
          </ButtonBase>
        </Box>

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
        </Box>

        {quickField && (
          <TextField
            value={text}
            error={invalid}
            onChange={(e) => {
              setText(e.target.value.replace(/\D/g, '').slice(0, 3));
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            placeholder={uk.lesson.gradeInputPlaceholder}
            hiddenLabel
            size="small"
            slotProps={{
              htmlInput: {
                inputMode: 'numeric',
                enterKeyHint: 'done',
                'aria-label': uk.lesson.gradeInputFor(fullName),
                className: 'tnum',
                style: { textAlign: 'center', fontSize: 17, fontWeight: 600 },
              },
            }}
            sx={{ width: 76, '& .MuiInputBase-root': { height: 40 } }}
          />
        )}
        <ButtonBase
          aria-label={uk.lesson.addGradeFor(fullName)}
          onClick={onAddGrade}
          sx={{
            height: 40,
            minWidth: 40,
            px: scale === 'PASS_FAIL' ? 1.25 : 0,
            border: 1,
            borderColor: 'ge.line2',
            borderRadius: '8px',
            bgcolor: 'background.paper',
            color: 'primary.main',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {scale === 'PASS_FAIL' ? uk.lesson.addGrade : <AddIcon fontSize="small" />}
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
