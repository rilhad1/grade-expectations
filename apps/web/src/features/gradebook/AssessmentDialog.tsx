import type { AssessmentDto } from '@ge/shared';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';

const a = uk.gradebook.assessment;
const ATTESTATIONS = ['INTERIM', 'DIRECTOR_TEST', 'AVERAGE', 'EXAM'] as const;

export interface AssessmentValues {
  title: string;
  kind: 'LAB' | 'TEST';
  attestationKind: AssessmentDto['attestationKind'];
}

/** Нова колонка оцінювання або редагування наявної (назва, вид, атестація; видалення). */
export function AssessmentDialog({
  initial,
  suggestedTitle,
  busy,
  error,
  onSubmit,
  onDelete,
  onClose,
}: {
  /** Є — редагування, немає — створення. */
  initial?: AssessmentDto;
  /** Підказка назви для нової колонки залежно від виду. */
  suggestedTitle: (kind: 'LAB' | 'TEST') => string;
  busy: boolean;
  error: unknown;
  onSubmit: (values: AssessmentValues) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<'LAB' | 'TEST'>(initial?.kind === 'TEST' ? 'TEST' : 'LAB');
  const [title, setTitle] = useState(initial?.title ?? suggestedTitle('LAB'));
  const [titleTouched, setTitleTouched] = useState(initial !== undefined);
  const [attestation, setAttestation] = useState<AssessmentDto['attestationKind']>(
    initial?.attestationKind ?? null,
  );
  const valid = title.trim() !== '';

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="assessment-title">
      <DialogTitle id="assessment-title">{initial ? a.editTitle : a.addTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {a.hint}
          </Typography>
          <SegmentedControl
            ariaLabel={a.kind}
            value={kind}
            onChange={(next) => {
              setKind(next);
              // Автопідказка назви, поки користувач її не змінив
              if (!titleTouched) setTitle(suggestedTitle(next));
            }}
            options={[
              { value: 'LAB' as const, label: a.kinds.LAB },
              { value: 'TEST' as const, label: a.kinds.TEST },
            ]}
          />
          <TextField
            label={a.title}
            value={title}
            autoFocus
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleTouched(true);
            }}
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <TextField
            select
            label={a.attestation}
            value={attestation ?? ''}
            onChange={(e) => {
              setAttestation(ATTESTATIONS.find((k) => k === e.target.value) ?? null);
            }}
          >
            <MenuItem value="">{a.noAttestation}</MenuItem>
            {ATTESTATIONS.map((k) => (
              <MenuItem key={k} value={k}>
                {uk.attestations.modules[k]}
              </MenuItem>
            ))}
          </TextField>
          <ErrorAlert error={error} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: onDelete ? 'space-between' : 'flex-end' }}>
        {onDelete && (
          <Button color="error" onClick={onDelete} disabled={busy}>
            {uk.common.delete}
          </Button>
        )}
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onClose}>
            {uk.common.cancel}
          </Button>
          <Button
            variant="contained"
            disabled={!valid || busy}
            onClick={() => {
              onSubmit({ title: title.trim(), kind, attestationKind: attestation });
            }}
          >
            {uk.common.save}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
