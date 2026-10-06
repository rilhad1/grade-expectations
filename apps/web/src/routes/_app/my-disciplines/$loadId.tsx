import { loadDtoSchema } from '@ge/shared';
import { Alert, Box, Tab, Tabs, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import { get } from '../../../api/http';
import { RulesEditor } from '../../../features/disciplines/RulesEditor';
import { TopicPlanEditor } from '../../../features/disciplines/TopicPlanEditor';
import { uk } from '../../../shared/i18n/uk';
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
  const [tab, setTab] = useState<'plan' | 'rules'>('plan');
  const data = load.data;
  if (!data) return <ErrorAlert error={load.error} />;

  return (
    <>
      <LinkButton to="/my-disciplines" sx={{ mb: 1 }}>
        {uk.disciplines.back}
      </LinkButton>
      <Typography variant="h5" component="h1" gutterBottom>
        <DisciplineDot color={data.discipline.color} size={12} />
        {data.discipline.title} · {data.group.name}
        {data.subgroup ? ` · ${data.subgroup.name}` : ''} · {uk.loads.kinds[data.kind]}
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, v: 'plan' | 'rules') => {
          setTab(v);
        }}
        sx={{ mb: 3 }}
      >
        <Tab value="plan" label={uk.disciplines.plan} />
        <Tab value="rules" label={uk.disciplines.rules} />
      </Tabs>
      <Box>
        {tab === 'plan' && <TopicPlanEditor loadId={loadId} plannedHours={data.plannedHours} />}
        {tab === 'rules' && <RulesEditor load={data} />}
      </Box>
      {tab === 'rules' && data.hours.held > 0 && (
        <Alert severity="info" sx={{ mt: 2, maxWidth: 560 }}>
          {uk.disciplines.scaleLocked}
        </Alert>
      )}
    </>
  );
}
