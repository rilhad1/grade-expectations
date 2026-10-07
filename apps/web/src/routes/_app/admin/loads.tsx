import type { LoadDto } from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { LoadDialog } from '../../../features/loads/LoadDialog';
import { deleteLoad, leaveLoadStream, mergeLoadsStream } from '../../../features/loads/api';
import { uk } from '../../../shared/i18n/uk';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';

export const Route = createFileRoute('/_app/admin/loads')({ component: LoadsPage });

const l = uk.loads;

function HoursCell({ load }: { load: LoadDto }) {
  const { planned, held, forecast, deficit } = load.hours;
  return (
    <Box sx={{ minWidth: 160 }}>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {held} {l.hoursOf} {planned} год
        {deficit > 0 && (
          <Typography component="span" variant="caption" color="warning.main">
            {' '}
            · {l.deficit} {deficit}
          </Typography>
        )}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, (held / planned) * 100)}
        color={forecast < planned ? 'warning' : 'primary'}
        sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
      />
    </Box>
  );
}

function LoadsPage() {
  const queryClient = useQueryClient();
  const { semester } = useCurrentSemester();
  const loads = useQuery({ ...q.loads(semester?.id ?? ''), enabled: semester !== null });
  const disciplines = useQuery(q.disciplines());
  const groups = useQuery({ ...q.groups(semester?.academicYearId), enabled: semester !== null });
  const users = useQuery(q.users());
  const [group, setGroup] = useState('');
  const [teacher, setTeacher] = useState('');
  const [dialog, setDialog] = useState<'add' | LoadDto | null>(null);
  // Вибір лекцій для об'єднання в потік
  const [picked, setPicked] = useState<string[]>([]);

  const remove = useMutation({
    mutationFn: deleteLoad,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loads'] }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['loads'] });
  const merge = useMutation({
    mutationFn: () => mergeLoadsStream(picked),
    onSuccess: async () => {
      setPicked([]);
      await refresh();
    },
  });
  const leave = useMutation({ mutationFn: leaveLoadStream, onSuccess: refresh });

  if (!semester) return <Alert severity="info">{l.noSemester}</Alert>;
  const teachers = (users.data ?? []).filter((u) => u.roles.includes('TEACHER'));
  const rows = (loads.data ?? []).filter(
    (x) => (group === '' || x.group.id === group) && (teacher === '' || x.teacher.id === teacher),
  );
  const readOnly = semester.status === 'CLOSED';

  return (
    <>
      <PageHeader
        title={l.title}
        actions={
          <Button
            variant="contained"
            disabled={readOnly}
            onClick={() => {
              setDialog('add');
            }}
          >
            {l.add}
          </Button>
        }
      />
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value);
          }}
          sx={{ minWidth: 180 }}
          slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': l.group } }}
        >
          <MenuItem value="">{l.filterGroup}</MenuItem>
          {(groups.data ?? []).map((g) => (
            <MenuItem key={g.id} value={g.id}>
              {g.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={teacher}
          onChange={(e) => {
            setTeacher(e.target.value);
          }}
          sx={{ minWidth: 220 }}
          slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': l.teacher } }}
        >
          <MenuItem value="">{l.filterTeacher}</MenuItem>
          {teachers.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.fullName}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <ErrorAlert error={remove.error ?? merge.error ?? leave.error ?? loads.error} />
      {picked.length > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button
              size="small"
              disabled={picked.length < 2 || merge.isPending}
              onClick={() => {
                merge.mutate();
              }}
            >
              {l.mergeStream}
            </Button>
          }
        >
          {l.mergeHint(picked.length)}
        </Alert>
      )}
      {loads.isSuccess && rows.length === 0 && <Alert severity="info">{l.empty}</Alert>}

      {rows.length > 0 && (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>{l.discipline}</TableCell>
                <TableCell>{l.group}</TableCell>
                <TableCell>{l.kind}</TableCell>
                <TableCell>{l.teacher}</TableCell>
                <TableCell>{l.controlForm}</TableCell>
                <TableCell>{l.hours}</TableCell>
                <TableCell align="right">{uk.common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.id} hover>
                  <TableCell padding="checkbox">
                    {x.kind === 'LECTURE' && !x.subgroup && (
                      <Checkbox
                        size="small"
                        disabled={readOnly}
                        checked={picked.includes(x.id)}
                        slotProps={{ input: { 'aria-label': l.pickForStream(x.group.name) } }}
                        onChange={(e) => {
                          setPicked(
                            e.target.checked
                              ? [...picked, x.id]
                              : picked.filter((id) => id !== x.id),
                          );
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <DisciplineDot color={x.discipline.color} />
                    {x.discipline.shortTitle}
                  </TableCell>
                  <TableCell>
                    {x.group.name}
                    {x.subgroup ? ` · ${x.subgroup.name}` : ''}
                  </TableCell>
                  <TableCell>
                    {l.kindsShort[x.kind]}
                    {x.streamId && (
                      <Chip
                        size="small"
                        label={l.stream}
                        title={l.leaveStream}
                        onDelete={
                          readOnly
                            ? undefined
                            : () => {
                                leave.mutate(x.id);
                              }
                        }
                        sx={{ ml: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{x.teacher.fullName}</TableCell>
                  <TableCell>{l.controlForms[x.controlForm]}</TableCell>
                  <TableCell>
                    <HoursCell load={x} />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      disabled={readOnly}
                      onClick={() => {
                        setDialog(x);
                      }}
                    >
                      {uk.common.edit}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      disabled={readOnly}
                      onClick={() => {
                        if (window.confirm(l.deleteConfirm)) remove.mutate(x.id);
                      }}
                    >
                      {uk.common.delete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {dialog !== null && (
        <LoadDialog
          key={dialog === 'add' ? 'add' : dialog.id}
          semester={semester}
          disciplines={disciplines.data ?? []}
          groups={groups.data ?? []}
          teachers={teachers}
          {...(dialog === 'add' ? {} : { load: dialog })}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </>
  );
}
