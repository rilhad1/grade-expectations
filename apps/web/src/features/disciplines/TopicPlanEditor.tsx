import type { TopicPlanDto } from '@ge/shared';
import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { Alert, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchTopics, saveTopics } from '../../api/teaching';
import { uk } from '../../shared/i18n/uk';
import { ErrorAlert } from '../../shared/ui/ErrorAlert';
import { ProgressBar } from '../../shared/ui/Stat';

import { moveItem, planBalance } from './rulesModel';

const d = uk.disciplines;
const ROW = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '28px minmax(0,1fr) 72px 104px',
    sm: '32px minmax(0,1fr) 56px 88px 112px',
  },
  gap: 1,
  alignItems: 'center',
  px: 1.5,
  py: 0.75,
} as const;
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
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: '8px',
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <Box
          sx={{
            ...ROW,
            bgcolor: 'ge.surface2',
            minHeight: 36,
            color: 'ge.text3',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span>№</span>
          <span>{d.topicTitle}</span>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {d.topicKind}
          </Box>
          <span>{d.topicHours}</span>
          <span />
        </Box>
        {rows.map((r, i) => (
          <Box key={r.key} sx={{ ...ROW, borderTop: 1, borderColor: 'divider' }}>
            <Typography
              sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}
              color="text.secondary"
            >
              {i + 1}
            </Typography>
            <TextField
              size="small"
              fullWidth
              hiddenLabel
              placeholder={d.topicTitle}
              value={r.title}
              onChange={(e) => {
                update(r.key, { title: e.target.value });
              }}
              slotProps={{ htmlInput: { 'aria-label': d.topicTitle } }}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: 'none', sm: 'block' } }}
            >
              {uk.loads.kindsShort[plan.loadKind]}
            </Typography>
            <TextField
              size="small"
              type="number"
              hiddenLabel
              value={r.hours}
              onChange={(e) => {
                update(r.key, { hours: e.target.value });
              }}
              slotProps={{ htmlInput: { min: 1, 'aria-label': d.topicHours } }}
            />
            <Stack direction="row">
              <IconButton
                size="small"
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
                size="small"
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
                size="small"
                aria-label={d.removeTopic}
                onClick={() => {
                  setSaved(false);
                  setRows(rows.filter((x) => x.key !== r.key));
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Box>
        ))}
      </Box>
      {plannedHours > 0 && (
        <Box sx={{ mb: 2 }}>
          <ProgressBar
            value={balance.total / plannedHours}
            color={balance.diff === 0 ? undefined : 'var(--mui-palette-ge-warnDot)'}
            label={d.totalHours}
          />
        </Box>
      )}
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
