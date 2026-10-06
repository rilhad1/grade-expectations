import type { GradingRules, LoadDto } from '@ge/shared';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { saveRules } from '../../api/teaching';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { WEIGHT_KINDS, weightsFromForm } from './rulesModel';

const d = uk.disciplines;
const SCALES = ['TWELVE', 'FIVE', 'HUNDRED', 'PASS_FAIL'] as const;

/** Числове поле з кнопками «−» і «+» (межі та крок задає викликач). */
function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const n = Number(value);
  const bump = (delta: number) => {
    const base = Number.isFinite(n) ? n : 0;
    onChange(String(Math.min(max, Math.max(min, base + delta))));
  };
  return (
    <TextField
      label={label}
      type="number"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      slotProps={{
        htmlInput: { min, max, step, style: { textAlign: 'center' } },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <IconButton
                size="small"
                edge="start"
                aria-label={`${label}: −`}
                disabled={n <= min}
                onClick={() => {
                  bump(-step);
                }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {suffix && (
                <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
                  {suffix}
                </Typography>
              )}
              <IconButton
                size="small"
                edge="end"
                aria-label={`${label}: +`}
                disabled={n >= max}
                onClick={() => {
                  bump(step);
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

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
    <Stack spacing={2}>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
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
            />
          ))}
        </Box>
      </div>
      <Stack spacing={1.5}>
        <NumberStepper
          label={d.minGrades}
          value={minGrades}
          onChange={setMinGrades}
          min={0}
          max={50}
        />
        <NumberStepper
          label={d.maxAbsence}
          value={maxAbsence}
          onChange={setMaxAbsence}
          min={0}
          max={100}
          step={5}
          suffix="%"
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
