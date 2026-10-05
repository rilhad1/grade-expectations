import type { AcademicYearDto, CohortDto } from '@ge/shared';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { createCohort, createGroup } from './api';

const g = uk.groups;

export function GroupDialog({
  year,
  cohorts,
  onClose,
}: {
  year: AcademicYearDto;
  cohorts: readonly CohortDto[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [cohortId, setCohortId] = useState(cohorts.at(-1)?.id ?? 'new');
  const [specialty, setSpecialty] = useState('');
  const [entryYear, setEntryYear] = useState(String(new Date().getFullYear()));
  const [name, setName] = useState('');
  const [course, setCourse] = useState('1');

  const save = useMutation({
    mutationFn: async () => {
      const id =
        cohortId === 'new'
          ? (await createCohort(specialty.trim(), Number(entryYear))).id
          : cohortId;
      return createGroup({
        cohortId: id,
        academicYearId: year.id,
        name: name.trim(),
        course: Number(course),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
        queryClient.invalidateQueries({ queryKey: ['cohorts'] }),
      ]);
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {g.addGroup} · {year.title}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label={g.cohort}
            value={cohortId}
            onChange={(e) => {
              setCohortId(e.target.value);
            }}
          >
            {cohorts.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.specialty}, {c.entryYear}
              </MenuItem>
            ))}
            <MenuItem value="new">{g.newCohort}</MenuItem>
          </TextField>
          {cohortId === 'new' && (
            <Stack direction="row" spacing={2}>
              <TextField
                label={g.specialty}
                value={specialty}
                onChange={(e) => {
                  setSpecialty(e.target.value);
                }}
                sx={{ flexGrow: 1 }}
              />
              <TextField
                label={g.entryYear}
                value={entryYear}
                onChange={(e) => {
                  setEntryYear(e.target.value);
                }}
                sx={{ width: 140 }}
              />
            </Stack>
          )}
          <Stack direction="row" spacing={2}>
            <TextField
              label={g.groupName}
              value={name}
              placeholder="ПДт-11"
              onChange={(e) => {
                setName(e.target.value);
              }}
              sx={{ flexGrow: 1 }}
            />
            <TextField
              label={g.course}
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
              }}
              sx={{ width: 100 }}
            />
          </Stack>
        </Stack>
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={
            name.trim() === '' || (cohortId === 'new' && specialty.trim() === '') || save.isPending
          }
          onClick={() => {
            save.mutate();
          }}
        >
          {uk.common.create}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
