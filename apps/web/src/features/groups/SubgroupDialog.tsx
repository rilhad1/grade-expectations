import type { GroupDetailDto, SubgroupDto } from '@ge/shared';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { createSubgroup, updateSubgroup } from './api';

const g = uk.groups;

export function SubgroupDialog({
  group,
  subgroup,
  onClose,
}: {
  group: GroupDetailDto;
  subgroup?: SubgroupDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(subgroup?.name ?? '');
  const [members, setMembers] = useState(new Set(subgroup?.enrollmentIds ?? []));
  const active = group.enrollments.filter((e) => e.status === 'ACTIVE');

  const save = useMutation({
    mutationFn: () =>
      subgroup
        ? updateSubgroup(subgroup.id, subgroup.version, {
            name: name.trim(),
            enrollmentIds: [...members],
          })
        : createSubgroup(group.id, name.trim(), [...members]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{subgroup ? uk.common.edit : g.addSubgroup}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label={g.subgroupName}
          value={name}
          placeholder="1 підгрупа"
          onChange={(e) => {
            setName(e.target.value);
          }}
          sx={{ mt: 1, mb: 2 }}
        />
        <FormGroup aria-label={g.subgroupMembers}>
          {active.map((e) => (
            <FormControlLabel
              key={e.id}
              control={
                <Checkbox
                  checked={members.has(e.id)}
                  onChange={(ev) => {
                    const copy = new Set(members);
                    if (ev.target.checked) copy.add(e.id);
                    else copy.delete(e.id);
                    setMembers(copy);
                  }}
                />
              }
              label={`${e.student.lastName} ${e.student.firstName}`}
            />
          ))}
        </FormGroup>
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={name.trim() === '' || save.isPending}
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
