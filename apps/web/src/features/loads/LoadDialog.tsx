import type { DisciplineDto, GroupDto, LoadDto, SemesterFullDto, UserDto } from '@ge/shared';
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { fetchGroup } from '../groups/api';

import { createLoad, updateLoad, type LoadFormValues } from './api';

const l = uk.loads;
const KINDS = ['LECTURE', 'PRACTICE', 'LAB', 'SEMINAR', 'CONTROL'] as const;

export function LoadDialog({
  semester,
  disciplines,
  groups,
  teachers,
  load,
  onClose,
}: {
  semester: SemesterFullDto;
  disciplines: readonly DisciplineDto[];
  groups: readonly GroupDto[];
  teachers: readonly UserDto[];
  load?: LoadDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [v, setV] = useState<LoadFormValues>({
    disciplineId: load?.discipline.id ?? disciplines[0]?.id ?? '',
    groupId: load?.group.id ?? groups[0]?.id ?? '',
    subgroupId: load?.subgroup?.id ?? null,
    teacherId: load?.teacher.id ?? teachers[0]?.id ?? '',
    kind: load?.kind ?? 'LECTURE',
    plannedHours: load?.plannedHours ?? 32,
    controlForm: load?.controlForm ?? 'EXAM',
  });
  const set = <K extends keyof LoadFormValues>(key: K, value: LoadFormValues[K]) => {
    setV({ ...v, [key]: value });
  };

  const group = useQuery({
    queryKey: ['group', v.groupId],
    queryFn: () => fetchGroup(v.groupId),
    enabled: v.groupId !== '' && !load,
  });

  const save = useMutation({
    mutationFn: () =>
      load
        ? updateLoad(load.id, load.version, {
            teacherId: v.teacherId,
            plannedHours: v.plannedHours,
            controlForm: v.controlForm,
          })
        : createLoad(semester.id, v),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['loads'] });
      onClose();
    },
  });

  const editing = load !== undefined;
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? l.edit : l.add}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label={l.discipline}
            value={v.disciplineId}
            disabled={editing}
            onChange={(e) => {
              set('disciplineId', e.target.value);
            }}
          >
            {disciplines.map((d) => (
              <MenuItem key={d.id} value={d.id}>
                {d.title}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={l.group}
              value={v.groupId}
              disabled={editing}
              onChange={(e) => {
                setV({ ...v, groupId: e.target.value, subgroupId: null });
              }}
              sx={{ flex: 1 }}
            >
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>
                  {g.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={l.subgroup}
              value={v.subgroupId ?? ''}
              disabled={editing}
              onChange={(e) => {
                set('subgroupId', e.target.value === '' ? null : e.target.value);
              }}
              sx={{ flex: 1 }}
            >
              <MenuItem value="">{l.wholeGroup}</MenuItem>
              {(group.data?.subgroups ?? []).map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
              {editing && load.subgroup && (
                <MenuItem value={load.subgroup.id}>{load.subgroup.name}</MenuItem>
              )}
            </TextField>
          </Stack>
          <TextField
            select
            label={l.teacher}
            value={v.teacherId}
            onChange={(e) => {
              set('teacherId', e.target.value);
            }}
          >
            {teachers.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.fullName}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label={l.kind}
              value={v.kind}
              disabled={editing}
              onChange={(e) => {
                set('kind', KINDS.find((k) => k === e.target.value) ?? 'LECTURE');
              }}
              sx={{ flex: 1 }}
            >
              {KINDS.map((k) => (
                <MenuItem key={k} value={k}>
                  {l.kinds[k]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={l.plannedHours}
              type="number"
              value={v.plannedHours}
              onChange={(e) => {
                set('plannedHours', Number(e.target.value));
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              select
              label={l.controlForm}
              value={v.controlForm}
              onChange={(e) => {
                set('controlForm', e.target.value === 'CREDIT' ? 'CREDIT' : 'EXAM');
              }}
              sx={{ flex: 1 }}
            >
              <MenuItem value="EXAM">{l.controlForms.EXAM}</MenuItem>
              <MenuItem value="CREDIT">{l.controlForms.CREDIT}</MenuItem>
            </TextField>
          </Stack>
        </Stack>
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={
            save.isPending ||
            v.disciplineId === '' ||
            v.groupId === '' ||
            v.teacherId === '' ||
            v.plannedHours <= 0
          }
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
