import type { AcademicYearDto, SemesterFullDto } from '@ge/shared';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import {
  SemesterForm,
  emptySemesterValues,
  valuesFromSemester,
  type SemesterFormValues,
} from './SemesterForm';
import { createSemesterFromForm, updateSemesterFromForm } from './api';

/** Створення або редагування семестру (разом із періодами). */
export function SemesterDialog({
  open,
  onClose,
  years,
  semester,
}: {
  open: boolean;
  onClose: () => void;
  years: readonly AcademicYearDto[];
  semester?: SemesterFullDto;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<SemesterFormValues>(() =>
    semester ? valuesFromSemester(semester) : emptySemesterValues(years),
  );

  const save = useMutation({
    mutationFn: () =>
      semester ? updateSemesterFromForm(semester, values) : createSemesterFromForm(values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['semesters'] }),
        queryClient.invalidateQueries({ queryKey: ['years'] }),
      ]);
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {semester ? uk.semesters.editSemester : uk.semesters.createSemester}
      </DialogTitle>
      <DialogContent>
        <SemesterForm
          values={values}
          onChange={setValues}
          years={years}
          editing={semester !== undefined}
        />
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          {save.isPending ? uk.common.saving : uk.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
