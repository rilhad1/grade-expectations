import type { GroupDetailDto, SubgroupDto } from '@ge/shared';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { ImportDialog } from './ImportDialog';
import { StudentDialog } from './StudentDialog';
import { SubgroupDialog } from './SubgroupDialog';
import { deleteSubgroup, fetchGroup, updateEnrollmentStatus } from './api';

const g = uk.groups;
const STATUSES = ['ACTIVE', 'ACADEMIC_LEAVE', 'EXPELLED', 'TRANSFERRED'] as const;

/** Склад групи: студенти, статуси, імпорт і підгрупи. */
export function GroupDetail({ groupId }: { groupId: string }) {
  const queryClient = useQueryClient();
  const group = useQuery({ queryKey: ['group', groupId], queryFn: () => fetchGroup(groupId) });
  const [dialog, setDialog] = useState<'student' | 'import' | 'subgroup' | null>(null);
  const [editStudent, setEditStudent] = useState<
    GroupDetailDto['enrollments'][number]['student'] | null
  >(null);
  const [editSubgroup, setEditSubgroup] = useState<SubgroupDto | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    await queryClient.invalidateQueries({ queryKey: ['groups'] });
  };
  const status = useMutation({
    mutationFn: ({
      id,
      version,
      value,
    }: {
      id: string;
      version: number;
      value: (typeof STATUSES)[number];
    }) => updateEnrollmentStatus(id, version, value),
    onSuccess: refresh,
  });
  const removeSubgroup = useMutation({ mutationFn: deleteSubgroup, onSuccess: refresh });

  if (group.isPending) return <Typography>{uk.common.loading}</Typography>;
  if (!group.data) return <ErrorAlert error={group.error} />;
  const data = group.data;
  const nameOf = (enrollmentId: string) => {
    const e = data.enrollments.find((x) => x.id === enrollmentId);
    return e ? `${e.student.lastName} ${e.student.firstName[0] ?? ''}.` : '';
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          {data.name} · {g.studentsCount.toLowerCase()}: {data.studentCount}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setDialog('import');
          }}
        >
          {g.import}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            setDialog('student');
          }}
        >
          {g.addStudent}
        </Button>
      </Stack>

      <ErrorAlert error={status.error ?? removeSubgroup.error} />
      {data.enrollments.length === 0 ? (
        <Alert severity="info">{g.noStudents}</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={48}>№</TableCell>
              <TableCell>{g.students}</TableCell>
              <TableCell>{g.status}</TableCell>
              <TableCell align="right">{uk.common.actions}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.enrollments.map((e, i) => (
              <TableRow key={e.id} hover sx={e.status === 'ACTIVE' ? undefined : { opacity: 0.6 }}>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</TableCell>
                <TableCell>
                  {e.student.lastName} {e.student.firstName} {e.student.middleName ?? ''}
                </TableCell>
                <TableCell>
                  <Select
                    size="small"
                    variant="standard"
                    value={e.status}
                    inputProps={{ 'aria-label': g.changeStatus }}
                    onChange={(ev) => {
                      const value = STATUSES.find((s) => s === ev.target.value);
                      if (value) status.mutate({ id: e.id, version: e.version, value });
                    }}
                  >
                    {STATUSES.map((s) => (
                      <MenuItem key={s} value={s}>
                        {g.enrollmentStatus[s]}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => {
                      setEditStudent(e.student);
                    }}
                  >
                    {uk.common.edit}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" component="h3" sx={{ flexGrow: 1 }}>
            {g.subgroups}
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setDialog('subgroup');
            }}
          >
            {g.addSubgroup}
          </Button>
        </Stack>
        {data.subgroups.length === 0 && (
          <Typography color="text.secondary" variant="body2">
            {g.noSubgroups}
          </Typography>
        )}
        {data.subgroups.map((s) => (
          <Stack
            key={s.id}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1, flexWrap: 'wrap' }}
          >
            <Chip
              label={`${s.name} · ${s.enrollmentIds.length}`}
              onClick={() => {
                setEditSubgroup(s);
              }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              {s.enrollmentIds.slice(0, 6).map(nameOf).join(', ')}
              {s.enrollmentIds.length > 6 ? '…' : ''}
            </Typography>
            <IconButton
              size="small"
              aria-label={uk.common.delete}
              onClick={() => {
                if (window.confirm(g.deleteSubgroupConfirm)) removeSubgroup.mutate(s.id);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Box>

      {dialog === 'import' && (
        <ImportDialog
          groupId={groupId}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {dialog === 'student' && (
        <StudentDialog
          groupId={groupId}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {editStudent && (
        <StudentDialog
          groupId={groupId}
          student={editStudent}
          onClose={() => {
            setEditStudent(null);
          }}
        />
      )}
      {dialog === 'subgroup' && (
        <SubgroupDialog
          group={data}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
      {editSubgroup && (
        <SubgroupDialog
          group={data}
          subgroup={editSubgroup}
          onClose={() => {
            setEditSubgroup(null);
          }}
        />
      )}
    </Paper>
  );
}
