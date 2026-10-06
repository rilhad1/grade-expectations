import type { GradingRules, LoadDto } from '@ge/shared';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { saveRules } from '../../api/teaching';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { WEIGHT_KINDS, weightsFromForm } from './rulesModel';

const d = uk.disciplines;
const SCALES = ['TWELVE', 'FIVE', 'HUNDRED', 'PASS_FAIL'] as const;

/** Правила оцінювання навантаження: шкала, ваги типів оцінок, пороги «н/а». */
export function RulesEditor({ load }: { load: LoadDto }) {
  const queryClient = useQueryClient();
  const r = load.gradingRules;
  const [scale, setScale] = useState<GradingRules['scale']>(r.scale);
  const [weights, setWeights] = useState<Record<(typeof WEIGHT_KINDS)[number], string>>({
    ORAL: String(r.weights.ORAL ?? ''),
    PRACTICE: String(r.weights.PRACTICE ?? ''),
    LAB: String(r.weights.LAB ?? ''),
    TEST: String(r.weights.TEST ?? ''),
  });
  const [minGrades, setMinGrades] = useState(String(r.minGrades));
  const [maxAbsence, setMaxAbsence] = useState(String(r.maxUnexcusedAbsencePercent));
  const [missed, setMissed] = useState<GradingRules['missedTest']>(r.missedTest);

  const next: GradingRules = {
    scale,
    weights: weightsFromForm(weights),
    minGrades: Number(minGrades),
    maxUnexcusedAbsencePercent: Number(maxAbsence),
    rounding: 'HALF_UP',
    missedTest: missed,
  };
  const valid =
    Number.isInteger(next.minGrades) &&
    next.minGrades >= 0 &&
    next.maxUnexcusedAbsencePercent >= 0 &&
    next.maxUnexcusedAbsencePercent <= 100;

  const save = useMutation({
    mutationFn: () => saveRules(load.id, next),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['loads'] });
      await queryClient.invalidateQueries({ queryKey: ['gradebook'] });
    },
  });

  return (
    <Stack spacing={2} sx={{ maxWidth: 560 }}>
      <TextField
        select
        label={d.scale}
        value={scale}
        onChange={(e) => {
          save.reset();
          setScale(SCALES.find((s) => s === e.target.value) ?? 'TWELVE');
        }}
      >
        {SCALES.map((s) => (
          <MenuItem key={s} value={s}>
            {d.scales[s]}
          </MenuItem>
        ))}
      </TextField>
      <div>
        <Typography variant="subtitle2" gutterBottom>
          {d.weights}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {WEIGHT_KINDS.map((k) => (
            <TextField
              key={k}
              size="small"
              label={uk.lesson.gradeKinds[k]}
              value={weights[k]}
              onChange={(e) => {
                save.reset();
                setWeights({ ...weights, [k]: e.target.value });
              }}
              sx={{ width: 130 }}
            />
          ))}
        </Stack>
      </div>
      <Stack direction="row" spacing={2}>
        <TextField
          label={d.minGrades}
          type="number"
          value={minGrades}
          onChange={(e) => {
            setMinGrades(e.target.value);
          }}
          sx={{ flex: 1 }}
        />
        <TextField
          label={d.maxAbsence}
          type="number"
          value={maxAbsence}
          onChange={(e) => {
            setMaxAbsence(e.target.value);
          }}
          sx={{ flex: 1 }}
        />
      </Stack>
      <TextField
        select
        label={d.missedTest}
        value={missed}
        onChange={(e) => {
          setMissed(e.target.value === 'ZERO' ? 'ZERO' : 'IGNORE');
        }}
      >
        <MenuItem value="IGNORE">{d.missedIgnore}</MenuItem>
        <MenuItem value="ZERO">{d.missedZero}</MenuItem>
      </TextField>
      <Alert severity="info" icon={false}>
        {d.rulesSummary(next.minGrades, next.maxUnexcusedAbsencePercent)}
      </Alert>
      <ErrorAlert error={save.error} />
      {save.isSuccess && <Alert severity="success">{d.rulesSaved}</Alert>}
      <div>
        <Button
          variant="contained"
          disabled={!valid || save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          {d.saveRules}
        </Button>
      </div>
    </Stack>
  );
}
