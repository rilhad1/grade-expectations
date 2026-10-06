import type { AttestationKind, AttestationStudent, LoadAttestationsDto } from '@ge/shared';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  fetchLoadAttestations,
  fetchSheet,
  saveResults,
  type ResultInput,
} from '../../api/attestations';
import { useMe } from '../../app/useMe';
import { formatDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { DocumentJobStatus } from '../documents/DocumentJobStatus';
import { useDocumentJob } from '../documents/useDocumentJob';

import {
  acceptAllInputs,
  confirmInput,
  confirmedCount,
  fieldError,
  fieldValue,
  reopenInput,
  rowState,
} from './model';

const t = uk.attestations;

export function AttestationScreen({ loadId }: { loadId: string }) {
  const modules = useQuery({
    queryKey: ['attestations', loadId],
    queryFn: () => fetchLoadAttestations(loadId),
  });
  const [picked, setPicked] = useState<AttestationKind | null>(null);
  if (modules.isPending) return <CircularProgress sx={{ m: 4 }} aria-label={uk.common.loading} />;
  if (!modules.data) return <ErrorAlert error={modules.error} />;

  const { load, modules: list } = modules.data;
  const kind = picked ?? list[0]?.kind ?? 'INTERIM';
  return (
    <>
      <Typography variant="h5" component="h1" sx={{ mb: 1 }}>
        <DisciplineDot color={load.discipline.color} size={12} />
        {t.title}: {load.discipline.shortTitle} · {load.group.name}
        {load.subgroup ? ` · ${load.subgroup.name}` : ''} · {uk.loads.kindsShort[load.kind]}
      </Typography>
      <Tabs
        value={kind}
        onChange={(_, value: AttestationKind) => {
          setPicked(value);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2 }}
      >
        {list.map((m) => (
          <Tab
            key={m.kind}
            value={m.kind}
            label={`${t.modules[m.kind]} · ${String(m.confirmed)}/${String(m.total)}`}
          />
        ))}
      </Tabs>
      <ModuleSheet key={kind} loadId={loadId} kind={kind} modules={modules.data} />
    </>
  );
}

function ModuleSheet({
  loadId,
  kind,
  modules,
}: {
  loadId: string;
  kind: AttestationKind;
  modules: LoadAttestationsDto;
}) {
  const queryClient = useQueryClient();
  const me = useMe();
  const sheet = useQuery({
    queryKey: ['attestation-sheet', loadId, kind],
    queryFn: () => fetchSheet(loadId, kind),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const statement = useDocumentJob();

  const save = useMutation({
    mutationFn: (results: ResultInput[]) => saveResults(loadId, kind, results),
    onSuccess: async (data, results) => {
      queryClient.setQueryData(['attestation-sheet', loadId, kind], data);
      setDrafts((current) => {
        const saved = new Set(results.map((r) => r.enrollmentId));
        return Object.fromEntries(Object.entries(current).filter(([id]) => !saved.has(id)));
      });
      await queryClient.invalidateQueries({ queryKey: ['attestations', loadId] });
    },
  });

  if (sheet.isPending) return <CircularProgress sx={{ m: 4 }} aria-label={uk.common.loading} />;
  if (!sheet.data) return <ErrorAlert error={sheet.error} />;

  const data = sheet.data;
  const { students } = data;
  const done = confirmedCount(students);
  const allConfirmed = done === students.length && students.length > 0;
  const period = modules.modules.find((m) => m.kind === kind);

  const draftOf = (s: AttestationStudent) => drafts[s.enrollmentId];
  const requestStatement = (format: 'DOCX' | 'PDF') => {
    statement.start({ kind: 'STATEMENT', format, loadId, attestationKind: kind });
  };

  return (
    <>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        flexWrap="wrap"
        sx={{ mb: 1 }}
        useFlexGap
      >
        <Box sx={{ minWidth: 220, flexGrow: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t.range}: {formatDate(data.range.from)} — {formatDate(data.range.to)}
            {period
              ? ` · ${t.periodHint} ${formatDate(period.dateFrom)} — ${formatDate(period.dateTo)}`
              : ''}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {t.confirmed}: {done} {uk.loads.hoursOf} {students.length}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={students.length === 0 ? 0 : (done / students.length) * 100}
            aria-label={`${t.confirmed}: ${String(done)}`}
          />
        </Box>
        <Button
          variant="contained"
          disabled={save.isPending || done === students.length}
          onClick={() => {
            save.mutate(acceptAllInputs(students, drafts));
          }}
        >
          {t.acceptAll}
        </Button>
      </Stack>

      <ErrorAlert error={save.error} />
      {students.length === 0 && <Alert severity="info">{uk.gradebook.emptyStudents}</Alert>}

      {students.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t.title}>
            <TableHead>
              <TableRow>
                <TableCell>{t.student}</TableCell>
                <TableCell>{t.proposal}</TableCell>
                <TableCell sx={{ width: 140 }}>{t.grade}</TableCell>
                <TableCell align="right" sx={{ width: 180 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s) => {
                const state = rowState(s, draftOf(s));
                const value = fieldValue(s, draftOf(s));
                const error = fieldError(data.load.scale, value);
                return (
                  <TableRow key={s.enrollmentId} hover>
                    <TableCell>
                      {s.lastName} {s.firstName}
                      {s.average !== null && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {uk.gradebook.average} {s.average.toFixed(1).replace('.', ',')} ·{' '}
                          {uk.gradebook.absences} {Math.round(s.absencePercent)}%
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={s.proposal.explanation}>
                        <Chip
                          size="small"
                          label={s.proposal.text}
                          color={s.proposal.isNa ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </Tooltip>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {s.proposal.explanation}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={value}
                        disabled={state === 'confirmed'}
                        error={error !== null}
                        helperText={error ?? undefined}
                        onChange={(e) => {
                          setDrafts((current) => ({
                            ...current,
                            [s.enrollmentId]: e.target.value,
                          }));
                        }}
                        slotProps={{ htmlInput: { 'aria-label': `${t.grade}: ${s.lastName}` } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {state === 'confirmed' ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          <CheckCircleIcon
                            color="success"
                            fontSize="small"
                            aria-label={t.states.confirmed}
                          />
                          <Button
                            size="small"
                            disabled={save.isPending}
                            onClick={() => {
                              save.mutate([reopenInput(s)]);
                            }}
                          >
                            {t.change}
                          </Button>
                        </Stack>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={save.isPending || error !== null}
                          onClick={() => {
                            save.mutate([confirmInput(s, draftOf(s))]);
                          }}
                        >
                          {t.confirm}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        sx={{ mt: 2 }}
        useFlexGap
      >
        <Button
          variant="outlined"
          disabled={!allConfirmed || statement.busy}
          onClick={() => {
            requestStatement('DOCX');
          }}
        >
          {t.statementDocx}
        </Button>
        {me.data?.features.pdf && (
          <Button
            variant="outlined"
            disabled={!allConfirmed || statement.busy}
            onClick={() => {
              requestStatement('PDF');
            }}
          >
            {t.statementPdf}
          </Button>
        )}
        {!allConfirmed && (
          <Typography variant="body2" color="text.secondary">
            {t.needAll}
          </Typography>
        )}
        <DocumentJobStatus document={statement.document} />
      </Stack>
      <ErrorAlert error={statement.error} />
    </>
  );
}
