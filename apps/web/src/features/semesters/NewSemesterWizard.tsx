import { promoteGroupName } from '@ge/domain';
import type {
  AcademicYearDto,
  CloneSemesterResult,
  GroupDto,
  PromoteGroupsResult,
  SemesterFullDto,
} from '@ge/shared';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  MenuItem,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { q } from '../../api/queries';
import { semesterLabel } from '../../app/semesterLabel';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { SemesterForm, emptySemesterValues, type SemesterFormValues } from './SemesterForm';
import { cloneSemester, createSemesterFromForm, promoteGroups } from './api';

const w = uk.semesters.wizard;

/** Крок 2: переведення груп з попереднього навчального року. */
function GroupsStep({
  semester,
  years,
  onResult,
  result,
}: {
  semester: SemesterFullDto;
  years: readonly AcademicYearDto[];
  onResult: (r: PromoteGroupsResult) => void;
  result: PromoteGroupsResult | null;
}) {
  const queryClient = useQueryClient();
  const candidates = years.filter((y) => y.id !== semester.academicYearId);
  const [sourceYearId, setSourceYearId] = useState(candidates.at(-1)?.id ?? '');
  const groups = useQuery({ ...q.groups(sourceYearId), enabled: sourceYearId !== '' });
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const items: GroupDto[] = groups.data ?? [];
  // За замовчуванням вибрано всі групи, у назві яких можна підняти курс
  const chosen =
    selected ?? new Set(items.filter((g) => promoteGroupName(g.name) !== null).map((g) => g.id));

  const promote = useMutation({
    mutationFn: () => promoteGroups(semester.academicYearId, [...chosen]),
    onSuccess: async (r) => {
      onResult(r);
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  if (candidates.length === 0) return <Alert severity="info">{w.sameYear}</Alert>;

  return (
    <>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {w.stepGroupsHint}
      </Typography>
      <TextField
        select
        size="small"
        label={w.sourceYear}
        value={sourceYearId}
        onChange={(e) => {
          setSourceYearId(e.target.value);
          setSelected(null);
        }}
        sx={{ minWidth: 220, mb: 1 }}
      >
        {candidates.map((y) => (
          <MenuItem key={y.id} value={y.id}>
            {y.title}
          </MenuItem>
        ))}
      </TextField>
      {items.length === 0 && !groups.isPending && <Alert severity="info">{w.noGroups}</Alert>}
      <List dense>
        {items.map((g) => {
          const next = promoteGroupName(g.name);
          return (
            <ListItem key={g.id} disablePadding>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={chosen.has(g.id)}
                    disabled={next === null}
                    onChange={(e) => {
                      const copy = new Set(chosen);
                      if (e.target.checked) copy.add(g.id);
                      else copy.delete(g.id);
                      setSelected(copy);
                    }}
                  />
                }
                label={`${g.name} → ${next?.name ?? '—'} (${g.studentCount})`}
              />
            </ListItem>
          );
        })}
      </List>
      <Button
        variant="outlined"
        disabled={chosen.size === 0 || promote.isPending}
        onClick={() => {
          promote.mutate();
        }}
      >
        {w.promote}
      </Button>
      <ErrorAlert error={promote.error} />
      {result && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {w.promoted}: {result.promoted.length}
          {result.skipped.length > 0 && ` · ${w.skipped}: ${result.skipped.length}`}
        </Alert>
      )}
    </>
  );
}

/** Крок 3: копіювання навантаження й шаблону розкладу. */
function LoadsStep({
  semester,
  semesters,
  years,
  result,
  onResult,
}: {
  semester: SemesterFullDto;
  semesters: readonly SemesterFullDto[];
  years: readonly AcademicYearDto[];
  result: CloneSemesterResult | null;
  onResult: (r: CloneSemesterResult) => void;
}) {
  const queryClient = useQueryClient();
  const sources = semesters.filter((s) => s.id !== semester.id);
  const [sourceId, setSourceId] = useState(
    sources.find((s) => s.number === semester.number)?.id ?? sources[0]?.id ?? '',
  );

  const clone = useMutation({
    mutationFn: () => cloneSemester(semester.id, sourceId),
    onSuccess: async (r) => {
      onResult(r);
      await queryClient.invalidateQueries({ queryKey: ['loads'] });
    },
  });

  return (
    <>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {w.stepLoadsHint}
      </Typography>
      <TextField
        select
        size="small"
        label={w.sourceSemester}
        value={sourceId}
        onChange={(e) => {
          setSourceId(e.target.value);
        }}
        sx={{ minWidth: 260, mb: 2 }}
      >
        {sources.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {semesterLabel(s, years)}
          </MenuItem>
        ))}
      </TextField>
      <div>
        <Button
          variant="outlined"
          disabled={sourceId === '' || clone.isPending || result !== null}
          onClick={() => {
            clone.mutate();
          }}
        >
          {w.clone}
        </Button>
      </div>
      <ErrorAlert error={clone.error} />
      {result && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {w.copiedLoads}: {result.copiedLoads} · {w.copiedSlots}: {result.copiedSlots}
        </Alert>
      )}
    </>
  );
}

export function NewSemesterWizard({
  open,
  onClose,
  years,
  semesters,
}: {
  open: boolean;
  onClose: () => void;
  years: readonly AcademicYearDto[];
  semesters: readonly SemesterFullDto[];
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<SemesterFormValues>(() => emptySemesterValues(years));
  const [created, setCreated] = useState<SemesterFullDto | null>(null);
  const [promoted, setPromoted] = useState<PromoteGroupsResult | null>(null);
  const [cloned, setCloned] = useState<CloneSemesterResult | null>(null);

  const create = useMutation({
    mutationFn: () => createSemesterFromForm(values),
    onSuccess: async (semester) => {
      setCreated(semester);
      setStep(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['semesters'] }),
        queryClient.invalidateQueries({ queryKey: ['years'] }),
      ]);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{w.title}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {w.steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {step === 0 && (
          <>
            <Typography color="text.secondary">{w.stepDatesHint}</Typography>
            <SemesterForm values={values} onChange={setValues} years={years} />
            <ErrorAlert error={create.error} />
          </>
        )}
        {step === 1 && created && (
          <GroupsStep semester={created} years={years} onResult={setPromoted} result={promoted} />
        )}
        {step === 2 && created && (
          <LoadsStep
            semester={created}
            semesters={semesters}
            years={years}
            result={cloned}
            onResult={setCloned}
          />
        )}
        {step === 3 && (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              {w.summary}
            </Alert>
            {cloned && (
              <>
                <Typography>
                  {w.copiedLoads}: {cloned.copiedLoads}
                </Typography>
                <Typography>
                  {w.copiedSlots}: {cloned.copiedSlots}
                </Typography>
                {cloned.skipped.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    {w.skipped}: {cloned.skipped.length} (
                    {[...new Set(cloned.skipped.map((s) => w.skipReason[s.reason]))].join(', ')})
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {step === 3 ? (
          <>
            <Button component={Link} to="/admin/schedule-builder" onClick={onClose}>
              {w.openBuilder}
            </Button>
            <Button variant="contained" onClick={onClose}>
              {uk.common.done}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>{uk.common.close}</Button>
            {step === 0 ? (
              <Button
                variant="contained"
                disabled={create.isPending}
                onClick={() => {
                  create.mutate();
                }}
              >
                {create.isPending ? uk.common.saving : uk.common.next}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => {
                  setStep(step + 1);
                }}
              >
                {uk.common.next}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
