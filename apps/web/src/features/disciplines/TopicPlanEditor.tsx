import type { TopicPlanDto } from '@ge/shared';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { Alert, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchTopics, saveTopics } from '../../api/teaching';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';

import { moveItem, planBalance } from './rulesModel';

const d = uk.disciplines;
type Row = { key: string; id?: string; title: string; hours: string };

function Editor({
  loadId,
  plannedHours,
  plan,
}: {
  loadId: string;
  plannedHours: number;
  plan: TopicPlanDto;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() =>
    plan.topics.map((t) => ({ key: t.id, id: t.id, title: t.title, hours: String(t.hours) })),
  );
  const [saved, setSaved] = useState(false);
  const update = (key: string, patch: Partial<Row>) => {
    setSaved(false);
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const parsed = rows.map((r) => ({ ...r, hoursN: Number(r.hours) }));
  const valid =
    parsed.length > 0 &&
    parsed.every((r) => r.title.trim() !== '' && Number.isInteger(r.hoursN) && r.hoursN >= 1);
  const balance = planBalance(
    parsed.map((r) => ({ hours: Number.isFinite(r.hoursN) ? r.hoursN : 0 })),
    plannedHours,
  );

  const save = useMutation({
    mutationFn: () =>
      saveTopics(
        loadId,
        parsed.map((r) => ({ ...(r.id && { id: r.id }), title: r.title.trim(), hours: r.hoursN })),
      ),
    onSuccess: async (data) => {
      setRows(
        data.topics.map((t) => ({ key: t.id, id: t.id, title: t.title, hours: String(t.hours) })),
      );
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['topics', loadId] });
      await queryClient.invalidateQueries({ queryKey: ['gradebook'] });
    },
  });

  return (
    <>
      {rows.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {d.noTopics}
        </Alert>
      )}
      <Stack spacing={1} sx={{ mb: 2 }}>
        {rows.map((r, i) => (
          <Stack key={r.key} direction="row" spacing={1} alignItems="center">
            <Typography
              sx={{ width: 28, fontVariantNumeric: 'tabular-nums' }}
              color="text.secondary"
            >
              {i + 1}
            </Typography>
            <TextField
              size="small"
              fullWidth
              label={d.topicTitle}
              value={r.title}
              onChange={(e) => {
                update(r.key, { title: e.target.value });
              }}
            />
            <TextField
              size="small"
              type="number"
              label={d.topicHours}
              value={r.hours}
              onChange={(e) => {
                update(r.key, { hours: e.target.value });
              }}
              sx={{ width: 100 }}
              slotProps={{ htmlInput: { min: 1 } }}
            />
            <IconButton
              aria-label={d.moveUp}
              disabled={i === 0}
              onClick={() => {
                setSaved(false);
                setRows(moveItem(rows, i, -1));
              }}
            >
              <ArrowUpward fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={d.moveDown}
              disabled={i === rows.length - 1}
              onClick={() => {
                setSaved(false);
                setRows(moveItem(rows, i, 1));
              }}
            >
              <ArrowDownward fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={d.removeTopic}
              onClick={() => {
                setSaved(false);
                setRows(rows.filter((x) => x.key !== r.key));
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Button
          onClick={() => {
            setSaved(false);
            setRows([...rows, { key: crypto.randomUUID(), title: '', hours: '2' }]);
          }}
        >
          {d.addTopic}
        </Button>
        <Typography
          variant="body2"
          sx={{ fontVariantNumeric: 'tabular-nums' }}
          color={balance.diff === 0 ? 'text.secondary' : 'warning.main'}
        >
          {d.totalHours} {balance.total} {uk.today.hoursUnit}, {d.planned} {plannedHours}
          {balance.diff > 0 && ` — +${balance.diff} ${d.planDiffMore}`}
          {balance.diff < 0 && rows.length > 0 && ` — ${-balance.diff} ${d.planDiffLess}`}
        </Typography>
        <Button
          variant="contained"
          disabled={!valid || save.isPending}
          onClick={() => {
            save.mutate();
          }}
          sx={{ ml: 'auto' }}
        >
          {d.savePlan}
        </Button>
      </Stack>
      <ErrorAlert error={save.error} />
      {saved && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {d.planSaved}
        </Alert>
      )}
    </>
  );
}

export function TopicPlanEditor({
  loadId,
  plannedHours,
}: {
  loadId: string;
  plannedHours: number;
}) {
  const plan = useQuery({ queryKey: ['topics', loadId], queryFn: () => fetchTopics(loadId) });
  if (!plan.data) return <ErrorAlert error={plan.error} />;
  return (
    <Editor
      key={plan.data.programId ?? 'new'}
      loadId={loadId}
      plannedHours={plannedHours}
      plan={plan.data}
    />
  );
}
