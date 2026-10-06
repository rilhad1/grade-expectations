import { loadDtoSchema } from '@ge/shared';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { get } from '../../../api/http';
import { RulesEditor } from '../../../features/disciplines/RulesEditor';
import { TopicPlanEditor } from '../../../features/disciplines/TopicPlanEditor';
import { uk } from '../../../shared/i18n/uk';
import { ControlFormBadge } from '../../../shared/ui/Badges';
import { DisciplineDot } from '../../../shared/ui/DisciplineDot';
import { ErrorAlert } from '../../../shared/ui/ErrorAlert';
import { LinkButton } from '../../../shared/ui/links';

export const Route = createFileRoute('/_app/my-disciplines/$loadId')({ component: DisciplinePage });

function DisciplinePage() {
  const { loadId } = Route.useParams();
  const load = useQuery({
    queryKey: ['loads', 'one', loadId],
    queryFn: () => get(`/loads/${loadId}`, loadDtoSchema),
  });
  const data = load.data;
  if (!data) return <ErrorAlert error={load.error} />;

  return (
    <>
      <LinkButton to="/my-disciplines" sx={{ mb: 1, ml: -1 }} startIcon={<ArrowBack />}>
        {uk.disciplines.back}
      </LinkButton>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 0.5 }}
      >
        <Typography
          variant="h5"
          component="h1"
          sx={{ display: 'flex', alignItems: 'center', fontSize: 20, lineHeight: '28px' }}
        >
          <DisciplineDot color={data.discipline.color} size={12} gap={1.25} />
          {data.discipline.title} · {data.group.name}
          {data.subgroup ? ` · ${data.subgroup.name}` : ''} · {uk.loads.kinds[data.kind]}
        </Typography>
        <ControlFormBadge form={data.controlForm} />
      </Stack>
      <Typography className="tnum" color="text.secondary" sx={{ mb: 2.5 }}>
        {data.plannedHours} {uk.today.hoursUnit} · {uk.disciplines.held} {data.hours.held}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          alignItems: 'start',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
        }}
      >
        <Paper
          variant="outlined"
          component="section"
          aria-label={uk.disciplines.plan}
          sx={{ p: 2.5 }}
        >
          <Typography variant="h6" component="h2" sx={{ fontSize: 15, mb: 2 }}>
            {uk.disciplines.plan}
          </Typography>
          <TopicPlanEditor loadId={loadId} plannedHours={data.plannedHours} />
        </Paper>
        <Paper
          variant="outlined"
          component="section"
          aria-label={uk.disciplines.rules}
          sx={{ p: 2.5 }}
        >
          <Typography variant="h6" component="h2" sx={{ fontSize: 15, mb: 2 }}>
            {uk.disciplines.rules}
          </Typography>
          <RulesEditor load={data} />
          {data.hours.held > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {uk.disciplines.scaleLocked}
            </Alert>
          )}
        </Paper>
      </Box>
    </>
  );
}
