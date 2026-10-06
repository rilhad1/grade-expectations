import { createFileRoute } from '@tanstack/react-router';

import { useMe } from '../../app/useMe';
import { TodayScreen } from '../../features/today/TodayScreen';

export const Route = createFileRoute('/_app/')({ component: TodayPage });

function TodayPage() {
  const { me } = useMe();
  return <TodayScreen fullName={me?.user.fullName ?? ''} />;
}
