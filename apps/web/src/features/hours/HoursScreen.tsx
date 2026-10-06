import DownloadIcon from '@mui/icons-material/Download';
import {
  Alert,
  Box,
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
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { PageHeader } from '../../shared/ui/PageHeader';
import { ProgressBar, StatCard } from '../../shared/ui/Stat';

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
  const worst = [...rows].sort((a, b) => b.deficit - a.deficit)[0];
  const colorOf = new Map((loads.data ?? []).map((l) => [l.id, l.discipline.color]));

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
      {loads.isSuccess && rows.length === 0 && <EmptyState title={t.empty} />}
      {rows.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
            },
            gap: 1.5,
            mb: 2,
          }}
        >
          <StatCard label={t.stats.planned} value={totals.planned} suffix={uk.today.hoursUnit} />
          <StatCard
            label={t.stats.held}
            value={totals.held}
            suffix={`${uk.today.hoursUnit} · ${String(totals.planned === 0 ? 0 : Math.round((totals.held / totals.planned) * 100))}%`}
          />
          <StatCard label={t.stats.forecast} value={totals.forecast} suffix={uk.today.hoursUnit} />
          <StatCard
            label={t.stats.deficit}
            value={totals.deficit > 0 ? `−${String(totals.deficit)}` : '0'}
            suffix={
              totals.deficit > 0 && worst
                ? `${uk.today.hoursUnit} · ${worst.discipline}`
                : uk.today.hoursUnit
            }
            tone={totals.deficit > 0 ? 'warn' : 'default'}
          />
        </Box>
      )}
      {rows.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t.title}>
            <TableHead>
              <TableRow>
                {[...columns, t.columns.progress].map((c, i) =>
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
                  <TableCell sx={{ width: 120 }}>
                    <ProgressBar
                      value={r.planned === 0 ? 0 : r.held / r.planned}
                      color={colorOf.get(r.loadId)}
                      label={`${r.discipline} · ${r.group}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={isModerator ? 4 : 3} sx={{ fontWeight: 600 }}>
                  {t.total}
                </TableCell>
                <TableCell align="right">{totals.planned}</TableCell>
                <TableCell align="right">{totals.held}</TableCell>
                <TableCell align="right">{totals.forecast}</TableCell>
                <TableCell align="right">{totals.deficit}</TableCell>
                <TableCell align="right">{totals.extraPairs}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
