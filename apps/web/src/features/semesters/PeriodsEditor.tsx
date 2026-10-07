import { PeriodKind, type PeriodInput } from '@ge/shared';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { Button, IconButton, MenuItem, Stack, TextField } from '@mui/material';

import { uk } from '../../shared/i18n/uk';

/** Редактор періодів семестру: канікули, свята, атестації, сесія. */
export function PeriodsEditor({
  value,
  onChange,
}: {
  value: PeriodInput[];
  onChange: (periods: PeriodInput[]) => void;
}) {
  const update = (index: number, patch: Partial<PeriodInput>) => {
    onChange(value.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  return (
    <Stack spacing={1.5}>
      {value.map((period, index) => (
        <Stack
          key={index}
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
        >
          <TextField
            select
            size="small"
            label={uk.semesters.periodKind}
            value={period.kind}
            onChange={(e) => {
              update(index, { kind: e.target.value as PeriodInput['kind'] });
            }}
            sx={{ minWidth: 240 }}
          >
            {PeriodKind.values.map((kind) => (
              <MenuItem key={kind} value={kind}>
                {uk.semesters.periodKinds[kind]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={uk.semesters.periodCourse}
            value={period.course === null ? '' : String(period.course)}
            onChange={(e) => {
              update(index, { course: e.target.value === '' ? null : Number(e.target.value) });
            }}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="">{uk.semesters.allCourses}</MenuItem>
            {[1, 2, 3, 4].map((c) => (
              <MenuItem key={c} value={String(c)}>
                {uk.semesters.courseN(c)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            label={uk.semesters.startDate}
            value={period.startDate}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(e) => {
              update(index, { startDate: e.target.value });
            }}
          />
          <TextField
            size="small"
            type="date"
            label={uk.semesters.endDate}
            value={period.endDate}
            slotProps={{ inputLabel: { shrink: true } }}
            onChange={(e) => {
              update(index, { endDate: e.target.value });
            }}
          />
          <IconButton
            aria-label={uk.common.delete}
            onClick={() => {
              onChange(value.filter((_, i) => i !== index));
            }}
          >
            <DeleteIcon />
          </IconButton>
        </Stack>
      ))}
      <div>
        <Button
          size="small"
          onClick={() => {
            onChange([
              ...value,
              { kind: 'HOLIDAY', startDate: '', endDate: '', title: null, course: null },
            ]);
          }}
        >
          {uk.semesters.addPeriod}
        </Button>
      </div>
    </Stack>
  );
}
