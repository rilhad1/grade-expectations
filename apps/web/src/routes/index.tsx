import { Alert, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { fetchHealth } from '../api/health';
import { uk } from '../shared/i18n/uk';

export const Route = createFileRoute('/')({ component: HomePage });

function HomePage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  let status = <Alert severity="info">{uk.home.loading}</Alert>;
  if (isError) status = <Alert severity="error">{uk.home.apiDown}</Alert>;
  else if (!isPending)
    status =
      data.db === 'ok' ? (
        <Alert severity="success">{uk.home.apiOk}</Alert>
      ) : (
        <Alert severity="warning">{uk.home.apiDbDown}</Alert>
      );

  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        {uk.home.title}
      </Typography>
      {status}
    </>
  );
}
