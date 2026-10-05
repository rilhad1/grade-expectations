import type { StudentDto } from '@ge/shared';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { todayKyiv } from '../../app/today';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { createStudent, updateStudent } from './api';

const g = uk.groups;

export function StudentDialog({
  groupId,
  student,
  onClose,
}: {
  groupId: string;
  student?: Pick<StudentDto, 'id' | 'lastName' | 'firstName' | 'middleName' | 'version'>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [lastName, setLastName] = useState(student?.lastName ?? '');
  const [firstName, setFirstName] = useState(student?.firstName ?? '');
  const [middleName, setMiddleName] = useState(student?.middleName ?? '');

  const save = useMutation({
    mutationFn: () => {
      const names = {
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
      };
      return student
        ? updateStudent(student.id, student.version, names)
        : createStudent({ ...names, groupId, fromDate: todayKyiv() });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{student ? uk.common.edit : g.addStudent}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label={g.lastName}
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
            }}
          />
          <TextField
            label={g.firstName}
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
            }}
          />
          <TextField
            label={g.middleName}
            value={middleName}
            onChange={(e) => {
              setMiddleName(e.target.value);
            }}
          />
        </Stack>
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={lastName.trim() === '' || firstName.trim() === '' || save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          {uk.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
