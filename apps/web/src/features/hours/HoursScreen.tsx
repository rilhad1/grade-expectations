import DownloadIcon from '@mui/icons-material/Download';
import {
  Alert,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { q } from '../../api/queries';
import { useCurrentSemester } from '../../app/SemesterSwitcher';
import { useMe } from '../../app/useMe';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { PageHeader } from '../../shared/ui/PageHeader';

import { hoursCsv, hoursRows, hoursTotals } from './model';

const t = uk.hours;

function download(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Вичитка годин: план, факт і прогноз за навантаженнями (деканат — усі, викладач — свої). */
export function HoursScreen() {
  const { semester } = useCurrentSemester();
  const { isModerator } = useMe();
  const loads = useQuery({ ...q.loads(semester?.id ?? ''), enabled: semester !== null });
  if (!semester) return <Alert severity="info">{uk.gradebook.noSemester}</Alert>;

  const rows = hoursRows(loads.data ?? []);
  const totals = hoursTotals(rows);
  const columns = [
    t.columns.teacher,
    t.columns.discipline,
    t.columns.group,
    t.columns.kind,
    t.columns.planned,
    t.columns.held,
    t.columns.forecast,
    t.columns.deficit,
    t.columns.extraPairs,
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <Button
            startIcon={<DownloadIcon />}
            disabled={rows.length === 0}
            onClick={() => {
              download(
                hoursCsv(rows, columns, (kind) => uk.loads.kinds[kind]),
                `vychytka-${semester.id}.csv`,
              );
            }}
          >
            {t.exportCsv}
          </Button>
        }
      />
      <ErrorAlert error={loads.error} />
      {loads.isSuccess && rows.length === 0 && <Alert severity="info">{t.empty}</Alert>}
      {rows.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t.title}>
            <TableHead>
              <TableRow>
                {columns.map((c, i) =>
                  i === 0 && !isModerator ? null : (
                    <TableCell key={c} align={i >= 4 ? 'right' : 'left'}>
                      {c}
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.loadId} hover>
                  {isModerator && <TableCell>{r.teacher}</TableCell>}
                  <TableCell>{r.discipline}</TableCell>
                  <TableCell>{r.group}</TableCell>
                  <TableCell>{uk.loads.kinds[r.kind]}</TableCell>
                  <TableCell align="right">{r.planned}</TableCell>
                  <TableCell align="right">{r.held}</TableCell>
                  <TableCell align="right">{r.forecast}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: r.deficit > 0 ? 'error.main' : undefined,
                      fontWeight: r.deficit > 0 ? 600 : undefined,
                    }}
                  >
                    {r.deficit}
                  </TableCell>
                  <TableCell align="right">{r.extraPairs}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={isModerator ? 4 : 3}>{t.total}</TableCell>
                <TableCell align="right">{totals.planned}</TableCell>
                <TableCell align="right">{totals.held}</TableCell>
                <TableCell align="right">{totals.forecast}</TableCell>
                <TableCell align="right">{totals.deficit}</TableCell>
                <TableCell align="right">{totals.extraPairs}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
