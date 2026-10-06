import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { GradebookScreen } from '../../../features/gradebook/GradebookScreen';

export const Route = createFileRoute('/_app/gradebook/$loadId')({ component: GradebookPage });

function GradebookPage() {
  const { loadId } = Route.useParams();
  const navigate = useNavigate();
  return (
    <GradebookScreen
      key={loadId}
      loadId={loadId}
      onPickLoad={(id) => void navigate({ to: '/gradebook/$loadId', params: { loadId: id } })}
    />
  );
}
