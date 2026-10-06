import { createFileRoute } from '@tanstack/react-router';

import { LessonScreen } from '../../../features/lesson/LessonScreen';

export const Route = createFileRoute('/_app/lessons/$lessonId')({ component: LessonPage });

function LessonPage() {
  const { lessonId } = Route.useParams();
  return <LessonScreen lessonId={lessonId} />;
}
