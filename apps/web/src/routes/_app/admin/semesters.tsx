import type { SemesterFullDto } from '@ge/shared';
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { q } from '../../../api/queries';
import { semesterLabel } from '../../../app/semesterLabel';
import { NewSemesterWizard } from '../../../features/semesters/NewSemesterWizard';
import { SemesterDialog } from '../../../features/semesters/SemesterDialog';
import { activateSemester, closeSemester } from '../../../features/semesters/api';
import { formatDate } from '../../../shared/format';
import { uk } from '../../../shared/i18n/uk';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';

export const Route = createFileRoute('/_app/admin/semesters')({ component: SemestersPage });

const statusColor = { DRAFT: 'default', ACTIVE: 'success', CLOSED: 'default' } as const;

function SemestersPage() {
  const queryClient = useQueryClient();
  const semesters = useQuery(q.semesters());
  const years = useQuery(q.years());
  const [editing, setEditing] = useState<SemesterFullDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [wizard, setWizard] = useState(false);

  const change = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'close' }) =>
      action === 'activate' ? activateSemester(id) : closeSemester(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['semesters'] }),
  });

  const list = semesters.data ?? [];
  const yearList = years.data ?? [];

  return (
    <>
      <PageHeader
        title={uk.semesters.title}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => {
                setCreating(true);
              }}
            >
              {uk.semesters.createSemester}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setWizard(true);
              }}
            >
              {uk.semesters.newSemester}
            </Button>
          </Stack>
        }
      />
      <ErrorAlert error={change.error ?? semesters.error} />
      {semesters.isSuccess && list.length === 0 && (
        <Alert severity="info">{uk.semesters.empty}</Alert>
      )}

      {list.length > 0 && (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{uk.nav.semesters}</TableCell>
                <TableCell>{uk.semesters.dates}</TableCell>
                <TableCell>{uk.semesters.status}</TableCell>
                <TableCell align="right">{uk.semesters.periods}</TableCell>
                <TableCell align="right">{uk.common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{semesterLabel(s, yearList)}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatDate(s.startDate)} — {formatDate(s.endDate)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={statusColor[s.status]}
                      variant={s.status === 'ACTIVE' ? 'filled' : 'outlined'}
                      label={uk.semesterStatus[s.status]}
                    />
                  </TableCell>
                  <TableCell align="right">{s.periods.length}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      {s.status !== 'CLOSED' && (
                        <Button
                          size="small"
                          onClick={() => {
                            setEditing(s);
                          }}
                        >
                          {uk.common.edit}
                        </Button>
                      )}
                      {s.status === 'DRAFT' && (
                        <Button
                          size="small"
                          onClick={() => {
                            change.mutate({ id: s.id, action: 'activate' });
                          }}
                        >
                          {uk.semesters.activate}
                        </Button>
                      )}
                      {s.status === 'ACTIVE' && (
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => {
                            if (window.confirm(uk.semesters.closeConfirm))
                              change.mutate({ id: s.id, action: 'close' });
                          }}
                        >
                          {uk.semesters.close}
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {creating && (
        <SemesterDialog
          open
          onClose={() => {
            setCreating(false);
          }}
          years={yearList}
        />
      )}
      {editing && (
        <SemesterDialog
          key={editing.id}
          open
          onClose={() => {
            setEditing(null);
          }}
          years={yearList}
          semester={editing}
        />
      )}
      {wizard && (
        <NewSemesterWizard
          open
          onClose={() => {
            setWizard(false);
          }}
          years={yearList}
          semesters={list}
        />
      )}
    </>
  );
}
