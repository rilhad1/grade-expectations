import { createFileRoute } from '@tanstack/react-router';

import { AttestationScreen } from '../../../features/attestations/AttestationScreen';

export const Route = createFileRoute('/_app/attestations/$loadId')({ component: AttestationPage });

function AttestationPage() {
  const { loadId } = Route.useParams();
  return <AttestationScreen key={loadId} loadId={loadId} />;
}
