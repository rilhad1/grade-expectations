import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Box, InputAdornment, ListSubheader, MenuItem, Select } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useEffect } from 'react';

import { q } from '../api/queries';
import { uk } from '../shared/i18n/uk';

import { semesterLabel } from './semesterLabel';
import { pickSemester, useSemesterStore } from './semesterStore';

/** Поточний семестр із шапки: збережений → активний → найновіший. */
export function useCurrentSemester() {
  const semesters = useQuery(q.semesters());
  const years = useQuery(q.years());
  const storedId = useSemesterStore((s) => s.semesterId);
  const semester = pickSemester(semesters.data ?? [], storedId);
  return {
    semester,
    semesters: semesters.data ?? [],
    years: years.data ?? [],
    isPending: semesters.isPending,
  };
}

/** Перемикач семестру: групи за навчальним роком, архівні семестри з замком. */
export function SemesterSwitcher({ fullWidth = false }: { fullWidth?: boolean }) {
  const { semester, semesters, years } = useCurrentSemester();
  const setSemesterId = useSemesterStore((s) => s.setSemesterId);

  // Якщо збережений семестр зник, оновлюємо вибір на фактичний
  useEffect(() => {
    if (semester) setSemesterId(semester.id);
  }, [semester, setSemesterId]);

  if (!semester) return null;

  const groups = [...new Set(semesters.map((s) => s.academicYearId))].map((yearId) => ({
    yearId,
    title: years.find((y) => y.id === yearId)?.title ?? '',
    items: semesters.filter((s) => s.academicYearId === yearId),
  }));

  return (
    <Select
      size="small"
      fullWidth={fullWidth}
      value={semester.id}
      onChange={(e) => {
        setSemesterId(e.target.value);
      }}
      inputProps={{ 'aria-label': uk.header.semester, className: 'tnum' }}
      startAdornment={
        <InputAdornment position="start" sx={{ color: 'ge.text3', mr: 1 }}>
          <CalendarMonthOutlined fontSize="small" />
        </InputAdornment>
      }
      renderValue={() => semesterLabel(semester, years)}
      MenuProps={{ slotProps: { paper: { sx: { minWidth: 280 } } } }}
      sx={{
        minWidth: 220,
        height: { xs: 44, md: 36 },
        fontWeight: 500,
        '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
      }}
    >
      {groups.map((g) => (
        <Fragment key={g.yearId}>
          <ListSubheader
            sx={{
              lineHeight: '32px',
              fontSize: 12,
              fontWeight: 600,
              color: 'ge.text3',
              bgcolor: 'background.paper',
            }}
          >
            {g.title}
          </ListSubheader>
          {g.items.map((s) => (
            <MenuItem key={s.id} value={s.id} sx={{ justifyContent: 'space-between', gap: 2 }}>
              <span className="tnum">
                {s.number === 1 ? 'I' : 'II'} {uk.semesterWord}
              </span>
              <Box
                component="span"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  fontSize: 12,
                  color: 'ge.text3',
                }}
              >
                {s.status === 'CLOSED' && <LockOutlined sx={{ fontSize: 12 }} />}
                {s.status === 'CLOSED'
                  ? uk.header.archived
                  : s.status === 'ACTIVE'
                    ? uk.header.current
                    : uk.semesterStatus[s.status]}
              </Box>
            </MenuItem>
          ))}
        </Fragment>
      ))}
    </Select>
  );
}
