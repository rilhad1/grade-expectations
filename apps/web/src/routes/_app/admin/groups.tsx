import {
  Alert,
  Button,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { q } from '../../../api/queries';
import { useCurrentSemester } from '../../../app/SemesterSwitcher';
import { GroupDetail } from '../../../features/groups/GroupDetail';
import { GroupDialog } from '../../../features/groups/GroupDialog';
import { uk } from '../../../shared/i18n/uk';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { PageHeader } from '../../../shared/ui/PageHeader';

export const Route = createFileRoute('/_app/admin/groups')({ component: GroupsPage });

function GroupsPage() {
  const { semester } = useCurrentSemester();
  const years = useQuery(q.years());
  const cohorts = useQuery(q.cohorts());
  const [pickedYear, setPickedYear] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const yearList = years.data ?? [];
  // Рік за замовчуванням — рік обраного в шапці семестру
  const year =
    yearList.find((y) => y.id === (pickedYear ?? semester?.academicYearId)) ?? yearList.at(-1);
  const groups = useQuery({ ...q.groups(year?.id), enabled: year !== undefined });
  const list = groups.data ?? [];

  return (
    <>
      <PageHeader
        title={uk.groups.title}
        actions={
          <Stack direction="row" spacing={1}>
            <TextField
              select
              size="small"
              label={uk.groups.year}
              value={year?.id ?? ''}
              onChange={(e) => {
                setPickedYear(e.target.value);
                setSelected(null);
              }}
              sx={{ minWidth: 160 }}
            >
              {yearList.map((y) => (
                <MenuItem key={y.id} value={y.id}>
                  {y.title}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={!year}
              onClick={() => {
                setAdding(true);
              }}
            >
              {uk.groups.addGroup}
            </Button>
          </Stack>
        }
      />
      <ErrorAlert error={groups.error ?? years.error} />
      {year && groups.isSuccess && list.length === 0 && (
        <Alert severity="info">{uk.groups.empty}</Alert>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        {list.length > 0 && (
          <Paper variant="outlined" sx={{ width: { xs: '100%', lg: 340 }, flexShrink: 0 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{uk.groups.groupName}</TableCell>
                  <TableCell align="right">{uk.groups.course}</TableCell>
                  <TableCell align="right">{uk.groups.studentsCount}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((g) => (
                  <TableRow
                    key={g.id}
                    hover
                    selected={g.id === selected}
                    onClick={() => {
                      setSelected(g.id);
                    }}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{g.name}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {g.course}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {g.studentCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
        <div style={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
          {selected ? (
            <GroupDetail key={selected} groupId={selected} />
          ) : (
            list.length > 0 && <Alert severity="info">{uk.groups.selectGroup}</Alert>
          )}
        </div>
      </Stack>

      {adding && year && (
        <GroupDialog
          year={year}
          cohorts={cohorts.data ?? []}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </>
  );
}
