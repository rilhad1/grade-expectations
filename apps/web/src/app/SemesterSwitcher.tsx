import { MenuItem, Select } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

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

/** У шапці (на темному тлі) або в шторці навігації (на світлому). */
export function SemesterSwitcher({ onDark = true }: { onDark?: boolean }) {
  const { semester, semesters, years } = useCurrentSemester();
  const setSemesterId = useSemesterStore((s) => s.setSemesterId);

  // Якщо збережений семестр зник, оновлюємо вибір на фактичний
  useEffect(() => {
    if (semester) setSemesterId(semester.id);
  }, [semester, setSemesterId]);

  if (!semester) return null;
  return (
    <Select
      size="small"
      value={semester.id}
      onChange={(e) => {
        setSemesterId(e.target.value);
      }}
      inputProps={{ 'aria-label': uk.header.semester }}
      sx={
        onDark
          ? {
              color: 'inherit',
              minWidth: 200,
              '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,.4)' },
              '.MuiSvgIcon-root': { color: 'inherit' },
            }
          : { minWidth: 200 }
      }
    >
      {semesters.map((s) => (
        <MenuItem key={s.id} value={s.id}>
          {semesterLabel(s, years)}
        </MenuItem>
      ))}
    </Select>
  );
}
