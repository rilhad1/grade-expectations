import { Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { fetchMe } from '../../api/me';
import { uk } from '../../shared/i18n/uk';

export const Route = createFileRoute('/_app/')({ component: TodayPage });

function TodayPage() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  return (
    <>
      <Typography variant="h5" component="h1" gutterBottom>
        {uk.today.title}
      </Typography>
      <Typography color="text.secondary">
        {me ? `${uk.today.welcome}, ${me.user.fullName}` : uk.today.welcome} {uk.today.placeholder}
      </Typography>
    </>
  );
}
