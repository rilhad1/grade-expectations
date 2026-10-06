import type { GradeEntry, LessonDetailDto, RosterEntry } from '@ge/shared';
import {
  Box,
  Button,
  Drawer,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';

import { gradeLabel, isValidGrade, keypadValues, scaleRange } from './model';

type Kind = GradeEntry['kind'];
const KINDS: Kind[] = ['ORAL', 'PRACTICE', 'LAB', 'TEST'];

export interface GradeSheetResult {
  kind: Kind;
  value: number;
}

/**
 * Нижня шторка для оцінки: клавіатура за шкалою дисципліни та тип оцінки.
 * Тап по числу зберігає одразу й закриває шторку, щоб виставити оцінку за секунди.
 */
export function GradeSheet({
  student,
  grade,
  scale,
  defaultKind,
  onSave,
  onDelete,
  onClose,
}: {
  student: RosterEntry;
  grade?: GradeEntry;
  scale: LessonDetailDto['scale'];
  defaultKind: Kind;
  onSave: (result: GradeSheetResult) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<Kind>(grade?.kind ?? defaultKind);
  const [custom, setCustom] = useState(grade ? String(grade.value) : '');
  const pad = keypadValues(scale);
  const { min, max } = scaleRange[scale];
  const customValue = Number(custom);
  const customValid = custom !== '' && isValidGrade(scale, customValue);

  return (
    <Drawer
      anchor="bottom"
      open
      onClose={onClose}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 2 } } }}
    >
      <Box
        sx={{ p: 2, maxWidth: 560, width: '100%', mx: 'auto' }}
        role="dialog"
        aria-label={uk.lesson.gradeFor(student.lastName, student.firstName)}
      >
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          {student.lastName} {student.firstName}
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={kind}
          onChange={(_, v: Kind | null) => {
            if (v) setKind(v);
          }}
          sx={{ mb: 2 }}
          aria-label={uk.lesson.gradeKind}
        >
          {KINDS.map((k) => (
            <ToggleButton key={k} value={k} sx={{ minHeight: 44 }}>
              {uk.lesson.gradeKinds[k]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {pad ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: scale === 'TWELVE' ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)',
              gap: 1,
            }}
          >
            {pad.map((n) => (
              <Button
                key={n}
                variant={grade?.value === n ? 'contained' : 'outlined'}
                onClick={() => {
                  onSave({ kind, value: n });
                }}
                sx={{ minHeight: 56, fontSize: 20, fontVariantNumeric: 'tabular-nums' }}
              >
                {n}
              </Button>
            ))}
          </Box>
        ) : scale === 'PASS_FAIL' ? (
          <Stack direction="row" spacing={1}>
            {[1, 0].map((v) => (
              <Button
                key={v}
                fullWidth
                size="large"
                variant={grade?.value === v ? 'contained' : 'outlined'}
                onClick={() => {
                  onSave({ kind, value: v });
                }}
                sx={{ minHeight: 56 }}
              >
                {gradeLabel(scale, v) === 'зар.' ? uk.lesson.passed : uk.lesson.failed}
              </Button>
            ))}
          </Stack>
        ) : (
          <Stack direction="row" spacing={1}>
            <TextField
              autoFocus
              type="number"
              fullWidth
              label={`${min}–${max}`}
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
              }}
              slotProps={{ htmlInput: { inputMode: 'numeric', min, max } }}
            />
            <Button
              variant="contained"
              disabled={!customValid}
              onClick={() => {
                onSave({ kind, value: customValue });
              }}
              sx={{ minWidth: 96 }}
            >
              {uk.common.save}
            </Button>
          </Stack>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} justifyContent="space-between">
          {onDelete ? (
            <Button color="error" onClick={onDelete} sx={{ minHeight: 44 }}>
              {uk.lesson.deleteGrade}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            {uk.common.cancel}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
