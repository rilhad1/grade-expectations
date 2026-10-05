import type { BellDto } from '@ge/shared';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { Alert, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { q } from '../../api/queries';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { saveBells } from './api';

const b = uk.directory.bells;

function BellsEditor({ initial }: { initial: BellDto[] }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<BellDto[]>(initial);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => saveBells(rows.map((row, i) => ({ ...row, pairNumber: i + 1 }))),
    onSuccess: async (data) => {
      setRows(data);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['bells'] });
    },
  });
  const update = (i: number, patch: Partial<BellDto>) => {
    setSaved(false);
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  return (
    <>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {b.hint}
      </Typography>
      <Stack spacing={1.5} sx={{ maxWidth: 460 }}>
        {rows.map((row, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="center">
            <Typography sx={{ width: 70, fontVariantNumeric: 'tabular-nums' }}>
              {b.pair} {i + 1}
            </Typography>
            <TextField
              size="small"
              type="time"
              label={b.start}
              value={row.startsAt}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(e) => {
                update(i, { startsAt: e.target.value });
              }}
            />
            <TextField
              size="small"
              type="time"
              label={b.end}
              value={row.endsAt}
              slotProps={{ inputLabel: { shrink: true } }}
              onChange={(e) => {
                update(i, { endsAt: e.target.value });
              }}
            />
            <IconButton
              aria-label={uk.common.delete}
              disabled={rows.length === 1}
              onClick={() => {
                setSaved(false);
                setRows(rows.filter((_, idx) => idx !== i));
              }}
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        ))}
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            disabled={rows.length >= 12}
            onClick={() => {
              setSaved(false);
              setRows([...rows, { pairNumber: rows.length + 1, startsAt: '', endsAt: '' }]);
            }}
          >
            {b.add}
          </Button>
          <Button
            variant="contained"
            disabled={save.isPending || rows.some((r) => r.startsAt === '' || r.endsAt === '')}
            onClick={() => {
              save.mutate();
            }}
          >
            {uk.common.save}
          </Button>
        </Stack>
      </Stack>
      <ErrorAlert error={save.error} />
      {saved && (
        <Alert severity="success" sx={{ mt: 2, maxWidth: 460 }}>
          {b.saved}
        </Alert>
      )}
    </>
  );
}

export function BellsTab() {
  const query = useQuery(q.bells());
  if (!query.data) return <Typography>{uk.common.loading}</Typography>;
  return (
    <BellsEditor
      initial={query.data.length > 0 ? query.data : [{ pairNumber: 1, startsAt: '', endsAt: '' }]}
    />
  );
}
