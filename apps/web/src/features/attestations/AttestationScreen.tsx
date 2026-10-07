import type { AttestationKind, AttestationStudent, LoadAttestationsDto } from '@ge/shared';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Button,
  Checkbox,
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
import { formatShortDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { ControlFormBadge } from '../../shared/ui/Badges';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { ListSkeleton, TableSkeleton } from '../../shared/ui/Skeletons';
import { ProgressBar } from '../../shared/ui/Stat';
import { LinkBase } from '../../shared/ui/links';
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
  rulesSummary,
} from './model';

const t = uk.attestations;

export function AttestationScreen({ loadId }: { loadId: string }) {
  const modules = useQuery({
    queryKey: ['attestations', loadId],
    queryFn: () => fetchLoadAttestations(loadId),
  });
  const [picked, setPicked] = useState<AttestationKind | null>(null);
  if (modules.isPending) return <ListSkeleton rows={3} label={uk.common.loading} />;
  if (!modules.data) return <ErrorAlert error={modules.error} />;

  const { load, modules: list } = modules.data;
  const kind = picked ?? list[0]?.kind ?? 'INTERIM';
  return (
    <>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 2 }}
      >
        <Typography variant="h5" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
          <DisciplineDot color={load.discipline.color} size={12} gap={1.25} />
          {t.title}: {load.discipline.shortTitle} · {load.group.name}
          {load.subgroup ? ` · ${load.subgroup.name}` : ''} · {uk.loads.kindsShort[load.kind]}
        </Typography>
        <ControlFormBadge form={load.controlForm} />
      </Stack>
      <Tabs
        value={kind}
        onChange={(_, value: AttestationKind) => {
          setPicked(value);
        }}
        variant="scrollable"
        allowScrollButtonsMobile
        aria-label={t.modulesLabel}
        sx={{ mb: 2 }}
      >
        {list.map((m) => (
          <Tab
            key={m.kind}
            value={m.kind}
            label={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 1 }}>
                {t.modules[m.kind]}
                <Box
                  component="small"
                  className="tnum"
                  sx={{ fontSize: 12, color: 'ge.text3', fontWeight: 500 }}
                >
                  {m.kind === 'AVERAGE'
                    ? t.wholeSemester
                    : `${formatShortDate(m.dateFrom)} – ${formatShortDate(m.dateTo)}`}
                  {m.course > 0 && ` · ${uk.semesters.courseN(m.course)}`}
                </Box>
              </Box>
            }
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
  const [comments, setComments] = useState<Record<string, string>>({});
  const statement = useDocumentJob();

  const save = useMutation({
    mutationFn: (results: ResultInput[]) => saveResults(loadId, kind, results),
    onSuccess: async (data, results) => {
      queryClient.setQueryData(['attestation-sheet', loadId, kind], data);
      const saved = new Set(results.map((r) => r.enrollmentId));
      const without = (current: Record<string, string>) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => !saved.has(id)));
      setDrafts(without);
      setComments(without);
      await queryClient.invalidateQueries({ queryKey: ['attestations', loadId] });
    },
  });

  if (sheet.isPending) return <TableSkeleton rows={8} cols={6} label={uk.common.loading} />;
  if (!sheet.data) return <ErrorAlert error={sheet.error} />;

  const data = sheet.data;
  const { students } = data;
  const done = confirmedCount(students);
  const allConfirmed = done === students.length && students.length > 0;
  const naCount = students.filter((s) => s.proposal.isNa).length;

  const draftOf = (s: AttestationStudent) => drafts[s.enrollmentId];
  const commentOf = (s: AttestationStudent) => comments[s.enrollmentId] ?? s.result?.comment ?? '';
  const requestStatement = (format: 'DOCX' | 'PDF') => {
    statement.start({ kind: 'STATEMENT', format, loadId, attestationKind: kind });
  };

  return (
    <Box sx={{ pb: 12 }}>
      <Paper
        variant="outlined"
        sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}
      >
        <InfoOutlined sx={{ fontSize: 20, color: 'primary.main', mt: '1px' }} />
        <Typography color="text.secondary" sx={{ flex: 1, lineHeight: '21px' }}>
          <Box component="b" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {t.howProposal}
          </Box>{' '}
          {t.range} {formatShortDate(data.range.from)} – {formatShortDate(data.range.to)}.{' '}
          {rulesSummary(modules.load.gradingRules)}
        </Typography>
        <LinkBase
          to="/my-disciplines/$loadId"
          params={{ loadId }}
          sx={{ fontSize: 13, color: 'primary.main', fontWeight: 500, whiteSpace: 'nowrap' }}
        >
          {t.rulesLink}
        </LinkBase>
      </Paper>

      <ErrorAlert error={save.error} />
      {students.length === 0 && <EmptyState title={uk.gradebook.emptyStudents} />}

      {students.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={t.title}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 40 }}>№</TableCell>
                <TableCell>{t.student}</TableCell>
                <TableCell align="right" sx={{ width: 96 }}>
                  {t.average}
                </TableCell>
                <TableCell align="right" sx={{ width: 104 }}>
                  {t.absences}
                </TableCell>
                <TableCell sx={{ width: 150 }}>{t.proposal}</TableCell>
                <TableCell sx={{ width: 120 }}>{t.grade}</TableCell>
                <TableCell>{t.comment}</TableCell>
                <TableCell align="center" sx={{ width: 104 }}>
                  {t.checked}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((s, i) => {
                const state = rowState(s, draftOf(s));
                const value = fieldValue(s, draftOf(s));
                const error = fieldError(data.load.scale, value);
                const confirmed = state === 'confirmed';
                return (
                  <TableRow
                    key={s.enrollmentId}
                    hover
                    sx={s.proposal.isNa ? { bgcolor: 'ge.warnBg' } : undefined}
                  >
                    <TableCell className="tnum" sx={{ color: 'ge.text3', fontSize: 12 }}>
                      {i + 1}
                    </TableCell>
                    <TableCell>
                      {s.lastName} {s.firstName}
                    </TableCell>
                    <TableCell align="right" className="tnum">
                      {s.average === null ? uk.common.none : s.average.toFixed(1).replace('.', ',')}
                    </TableCell>
                    <TableCell
                      align="right"
                      className="tnum"
                      sx={
                        s.absencePercent > 30 ? { color: 'ge.errFg', fontWeight: 600 } : undefined
                      }
                    >
                      {Math.round(s.absencePercent)}%
                    </TableCell>
                    <TableCell>
                      <Tooltip title={s.proposal.explanation}>
                        <Box
                          component="span"
                          className="tnum"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.75,
                            fontWeight: 600,
                            color: s.proposal.isNa ? 'ge.warn' : 'text.primary',
                          }}
                        >
                          {s.proposal.text}
                          <InfoOutlined sx={{ fontSize: 14, color: 'ge.text3' }} />
                        </Box>
                      </Tooltip>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {s.proposal.explanation}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={value}
                        disabled={confirmed}
                        error={error !== null}
                        helperText={error ?? undefined}
                        onChange={(e) => {
                          setDrafts((current) => ({
                            ...current,
                            [s.enrollmentId]: e.target.value,
                          }));
                        }}
                        slotProps={{
                          htmlInput: {
                            'aria-label': `${t.grade}: ${s.lastName}`,
                            className: 'tnum',
                            style: { textAlign: 'center', fontWeight: 600, width: 56 },
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={t.addComment}
                        value={commentOf(s)}
                        disabled={confirmed}
                        onChange={(e) => {
                          setComments((current) => ({
                            ...current,
                            [s.enrollmentId]: e.target.value,
                          }));
                        }}
                        slotProps={{ htmlInput: { 'aria-label': `${t.comment}: ${s.lastName}` } }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={confirmed}
                        disabled={save.isPending || (!confirmed && error !== null)}
                        slotProps={{ input: { 'aria-label': `${t.checked}: ${s.lastName}` } }}
                        onChange={() => {
                          save.mutate([
                            confirmed
                              ? reopenInput(s)
                              : confirmInput(s, draftOf(s), comments[s.enrollmentId]),
                          ]);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          mt: 2,
          mx: { xs: -2, md: -3, lg: -4 },
          px: { xs: 2, md: 3, lg: 4 },
          py: 1.5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'ge.line2',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ width: 280, maxWidth: '100%' }}>
          <Typography className="tnum" sx={{ fontWeight: 600, mb: 0.5 }}>
            {t.confirmed}: {done} {uk.loads.hoursOf} {students.length}
          </Typography>
          <ProgressBar
            value={students.length === 0 ? 0 : done / students.length}
            label={`${t.confirmed}: ${String(done)}`}
          />
        </Box>
        {naCount > 0 && (
          <Typography variant="body2" color="text.secondary">
            {t.naCount(naCount)}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          disabled={save.isPending || done === students.length}
          onClick={() => {
            save.mutate(acceptAllInputs(students, drafts, comments));
          }}
        >
          {t.acceptAll}
        </Button>
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
            variant="contained"
            disabled={!allConfirmed || statement.busy}
            onClick={() => {
              requestStatement('PDF');
            }}
          >
            {t.statementPdf}
          </Button>
        )}
        {!allConfirmed && (
          <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
            {t.needAll}
          </Typography>
        )}
        <DocumentJobStatus document={statement.document} />
        <ErrorAlert error={statement.error} />
      </Box>
    </Box>
  );
}
