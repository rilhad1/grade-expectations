import { createFileRoute } from '@tanstack/react-router';

import { GradebookScreen } from '../../../features/gradebook/GradebookScreen';

export const Route = createFileRoute('/_app/gradebook/$loadId')({ component: GradebookPage });

function GradebookPage() {
  const { loadId } = Route.useParams();
  return <GradebookScreen key={loadId} loadId={loadId} />;
}
