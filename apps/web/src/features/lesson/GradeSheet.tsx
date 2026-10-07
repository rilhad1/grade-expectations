import type { GradeEntry, LessonDetailDto, RosterEntry } from '@ge/shared';
import { Box, Button, ButtonBase, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { BottomSheet } from '../../shared/ui/Dialogs';
import { GradeChip } from '../../shared/ui/GradeChip';

import { gradeLabel, gradeTone, isValidGrade, keypadValues, scaleRange } from './model';

type Kind = GradeEntry['kind'];
const KINDS: Kind[] = ['ORAL', 'PRACTICE', 'LAB', 'TEST'];

export interface GradeSheetResult {
  kind: Kind;
  value: number;
}

/**
 * Нижня шторка для оцінки: тип оцінки (2×2) і клавіатура за шкалою дисципліни.
 * Тап по числу зберігає одразу й закриває шторку, щоб виставити оцінку за секунди.
 */
export function GradeSheet({
  student,
  grade,
  scale,
  defaultKind,
  dateLabel,
  showKind = true,
  onSave,
  onDelete,
  onClose,
}: {
  student: RosterEntry;
  grade?: GradeEntry;
  scale: LessonDetailDto['scale'];
  defaultKind: Kind;
  dateLabel?: string;
  /** Вибір типу оцінки (для колонок оцінювання тип заданий колонкою). */
  showKind?: boolean;
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
    <BottomSheet
      open
      onClose={onClose}
      ariaLabel={uk.lesson.gradeFor(student.lastName, student.firstName)}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {dateLabel && (
              <Typography variant="caption" color="ge.text3" sx={{ fontWeight: 600, fontSize: 13 }}>
                {uk.lesson.gradeDate(dateLabel)}
              </Typography>
            )}
            <Typography sx={{ fontSize: 19, fontWeight: 600 }}>
              {student.lastName} {student.firstName}
            </Typography>
          </Box>
          {grade && <GradeChip value={grade.value} scale={scale} />}
        </Box>

        {showKind && (
          <Box
            role="radiogroup"
            aria-label={uk.lesson.gradeKind}
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}
          >
            {KINDS.map((k) => {
              const on = kind === k;
              return (
                <ButtonBase
                  key={k}
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setKind(k);
                  }}
                  sx={{
                    height: 44,
                    borderRadius: '6px',
                    fontSize: 15,
                    fontWeight: on ? 600 : 500,
                    border: on ? '1.5px solid' : '1px solid',
                    borderColor: on ? 'primary.main' : 'ge.line2',
                    bgcolor: on ? 'ge.accentSoft' : 'background.paper',
                    color: on ? 'primary.main' : 'text.primary',
                  }}
                >
                  {uk.lesson.gradeKinds[k]}
                </ButtonBase>
              );
            })}
          </Box>
        )}

        {pad ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: scale === 'TWELVE' ? 'repeat(4, 1fr)' : 'repeat(5, 1fr)',
              gap: 1,
            }}
          >
            {pad.map((n) => {
              const tone = gradeTone(scale, n);
              return (
                <ButtonBase
                  key={n}
                  aria-pressed={grade?.value === n}
                  onClick={() => {
                    onSave({ kind, value: n });
                  }}
                  className="tnum"
                  sx={{
                    height: 60,
                    borderRadius: '8px',
                    border: grade?.value === n ? '2px solid' : '1px solid',
                    borderColor: grade?.value === n ? 'primary.main' : 'ge.line2',
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'text.primary',
                    bgcolor:
                      tone === 'low'
                        ? 'ge.grade.low'
                        : tone === 'high'
                          ? 'ge.grade.high'
                          : 'background.paper',
                  }}
                >
                  {n}
                </ButtonBase>
              );
            })}
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

        <Stack direction="row" spacing={1} justifyContent="space-between">
          {onDelete ? (
            <Button color="error" onClick={onDelete}>
              {uk.lesson.deleteGrade}
            </Button>
          ) : (
            <span />
          )}
          <Button color="inherit" onClick={onClose} sx={{ color: 'text.secondary' }}>
            {uk.common.cancel}
          </Button>
        </Stack>
      </Stack>
    </BottomSheet>
  );
}
