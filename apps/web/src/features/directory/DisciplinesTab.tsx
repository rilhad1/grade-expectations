import type { DisciplineDto } from '@ge/shared';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { q } from '../../api/queries';
import { disciplinePalette } from '../../app/theme';
import { uk } from '../../shared/i18n/uk';
import { DisciplineDot } from '../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { deleteDiscipline, saveDiscipline } from './api';

const d = uk.directory.disciplines;
const SCALES = ['TWELVE', 'FIVE', 'HUNDRED', 'PASS_FAIL'] as const;

function DisciplineDialog({
  discipline,
  onClose,
}: {
  discipline?: DisciplineDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(discipline?.title ?? '');
  const [shortTitle, setShortTitle] = useState(discipline?.shortTitle ?? '');
  const [code, setCode] = useState(discipline?.code ?? '');
  const [color, setColor] = useState(discipline?.color ?? '#3B6EA5');
  const [scale, setScale] = useState<(typeof SCALES)[number]>(discipline?.defaultScale ?? 'TWELVE');

  const save = useMutation({
    mutationFn: () =>
      saveDiscipline(discipline, {
        title: title.trim(),
        shortTitle: shortTitle.trim(),
        code: code.trim() || null,
        color,
        defaultScale: scale,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['disciplines'] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{discipline ? d.edit : d.add}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label={d.title}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label={d.shortTitle}
              value={shortTitle}
              onChange={(e) => {
                setShortTitle(e.target.value);
              }}
              sx={{ flex: 1 }}
            />
            <TextField
              label={d.code}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
              }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              select
              label={d.scale}
              value={scale}
              onChange={(e) => {
                setScale(SCALES.find((s) => s === e.target.value) ?? 'TWELVE');
              }}
              sx={{ flex: 1 }}
            >
              {SCALES.map((s) => (
                <MenuItem key={s} value={s}>
                  {d.scales[s]}
                </MenuItem>
              ))}
            </TextField>
            <Box
              role="radiogroup"
              aria-label={d.color}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', flex: 1 }}
            >
              {[...new Set([color, ...disciplinePalette])].map((c, i) => (
                <ButtonBase
                  key={c}
                  role="radio"
                  aria-checked={c === color}
                  aria-label={`${d.color} ${String(i + 1)}`}
                  onClick={() => {
                    setColor(c);
                  }}
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '6px',
                    bgcolor: c,
                    border: '2px solid',
                    borderColor: c === color ? 'text.primary' : 'transparent',
                  }}
                />
              ))}
            </Box>
          </Stack>
        </Stack>
        <ErrorAlert error={save.error} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{uk.common.cancel}</Button>
        <Button
          variant="contained"
          disabled={title.trim() === '' || shortTitle.trim() === '' || save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          {uk.common.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DisciplinesTab() {
  const queryClient = useQueryClient();
  const query = useQuery(q.disciplines());
  const [dialog, setDialog] = useState<'add' | DisciplineDto | null>(null);
  const remove = useMutation({
    mutationFn: deleteDiscipline,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disciplines'] }),
  });
  const rows = query.data ?? [];

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          onClick={() => {
            setDialog('add');
          }}
        >
          {d.add}
        </Button>
      </Box>
      <ErrorAlert error={remove.error ?? query.error} />
      {query.isSuccess && rows.length === 0 && <Alert severity="info">{d.empty}</Alert>}
      {rows.length > 0 && (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{d.title}</TableCell>
                <TableCell>{d.shortTitle}</TableCell>
                <TableCell>{d.scale}</TableCell>
                <TableCell align="right">{uk.common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.id} hover>
                  <TableCell>
                    <DisciplineDot color={x.color} />
                    {x.title}
                  </TableCell>
                  <TableCell>{x.shortTitle}</TableCell>
                  <TableCell>{d.scales[x.defaultScale]}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => {
                        setDialog(x);
                      }}
                    >
                      {uk.common.edit}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => {
                        if (window.confirm(d.deleteConfirm)) remove.mutate(x.id);
                      }}
                    >
                      {uk.common.delete}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
      {dialog !== null && (
        <DisciplineDialog
          key={dialog === 'add' ? 'add' : dialog.id}
          {...(dialog === 'add' ? {} : { discipline: dialog })}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </>
  );
}
