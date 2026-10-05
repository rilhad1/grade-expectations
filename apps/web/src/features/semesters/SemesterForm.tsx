import type { AcademicYearDto, PeriodInput, SemesterFullDto } from '@ge/shared';
import { MenuItem, Stack, TextField } from '@mui/material';

import { uk } from '../../shared/i18n/uk';

import { PeriodsEditor } from './PeriodsEditor';

export interface SemesterFormValues {
  /** id існуючого року або 'new' */
  yearId: string;
  newYearTitle: string;
  newYearStart: string;
  newYearEnd: string;
  number: 1 | 2;
  startDate: string;
  endDate: string;
  firstWeekParity: 'TOP' | 'BOTTOM';
  parityAfterBreak: 'CONTINUE' | 'RESTART';
  periods: PeriodInput[];
}

export const emptySemesterValues = (years: readonly AcademicYearDto[]): SemesterFormValues => ({
  yearId: years.at(-1)?.id ?? 'new',
  newYearTitle: '',
  newYearStart: '',
  newYearEnd: '',
  number: 1,
  startDate: '',
  endDate: '',
  firstWeekParity: 'TOP',
  parityAfterBreak: 'CONTINUE',
  periods: [],
});

export const valuesFromSemester = (s: SemesterFullDto): SemesterFormValues => ({
  yearId: s.academicYearId,
  newYearTitle: '',
  newYearStart: '',
  newYearEnd: '',
  number: s.number === 2 ? 2 : 1,
  startDate: s.startDate,
  endDate: s.endDate,
  firstWeekParity: s.firstWeekParity,
  parityAfterBreak: s.parityAfterBreak,
  periods: s.periods.map((p) => ({
    kind: p.kind,
    startDate: p.startDate,
    endDate: p.endDate,
    title: p.title,
  })),
});

/** «2026/2027» за роком початку. */
export const suggestYearTitle = (startDate: string): string => {
  const year = Number(startDate.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? `${year}/${year + 1}` : '';
};

const dateField = { inputLabel: { shrink: true } } as const;

export function SemesterForm({
  values,
  onChange,
  years,
  editing = false,
}: {
  values: SemesterFormValues;
  onChange: (values: SemesterFormValues) => void;
  years: readonly AcademicYearDto[];
  /** При редагуванні рік і номер семестру не змінюються. */
  editing?: boolean;
}) {
  const set = <K extends keyof SemesterFormValues>(key: K, value: SemesterFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };
  const creatingYear = values.yearId === 'new';

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      {!editing && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            select
            label={uk.semesters.year}
            value={values.yearId}
            onChange={(e) => {
              set('yearId', e.target.value);
            }}
            sx={{ minWidth: 220 }}
          >
            {years.map((y) => (
              <MenuItem key={y.id} value={y.id}>
                {y.title}
              </MenuItem>
            ))}
            <MenuItem value="new">{uk.semesters.newYear}</MenuItem>
          </TextField>
          <TextField
            select
            label={uk.semesters.number}
            value={values.number}
            onChange={(e) => {
              set('number', Number(e.target.value) === 2 ? 2 : 1);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value={1}>I</MenuItem>
            <MenuItem value={2}>II</MenuItem>
          </TextField>
        </Stack>
      )}

      {creatingYear && !editing && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label={uk.semesters.yearTitle}
            value={values.newYearTitle}
            placeholder={suggestYearTitle(values.startDate)}
            onChange={(e) => {
              set('newYearTitle', e.target.value);
            }}
          />
          <TextField
            type="date"
            label={`${uk.semesters.year}: ${uk.semesters.startDate.toLowerCase()}`}
            value={values.newYearStart}
            slotProps={dateField}
            onChange={(e) => {
              set('newYearStart', e.target.value);
            }}
          />
          <TextField
            type="date"
            label={`${uk.semesters.year}: ${uk.semesters.endDate.toLowerCase()}`}
            value={values.newYearEnd}
            slotProps={dateField}
            onChange={(e) => {
              set('newYearEnd', e.target.value);
            }}
          />
        </Stack>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          type="date"
          label={uk.semesters.startDate}
          value={values.startDate}
          slotProps={dateField}
          onChange={(e) => {
            set('startDate', e.target.value);
          }}
        />
        <TextField
          type="date"
          label={uk.semesters.endDate}
          value={values.endDate}
          slotProps={dateField}
          onChange={(e) => {
            set('endDate', e.target.value);
          }}
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          select
          label={uk.semesters.firstWeek}
          value={values.firstWeekParity}
          onChange={(e) => {
            set('firstWeekParity', e.target.value === 'BOTTOM' ? 'BOTTOM' : 'TOP');
          }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="TOP">{uk.semesters.top}</MenuItem>
          <MenuItem value="BOTTOM">{uk.semesters.bottom}</MenuItem>
        </TextField>
        <TextField
          select
          label={uk.semesters.parityAfterBreak}
          value={values.parityAfterBreak}
          onChange={(e) => {
            set('parityAfterBreak', e.target.value === 'RESTART' ? 'RESTART' : 'CONTINUE');
          }}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="CONTINUE">{uk.semesters.continue}</MenuItem>
          <MenuItem value="RESTART">{uk.semesters.restart}</MenuItem>
        </TextField>
      </Stack>

      <PeriodsEditor
        value={values.periods}
        onChange={(periods) => {
          set('periods', periods);
        }}
      />
    </Stack>
  );
}
