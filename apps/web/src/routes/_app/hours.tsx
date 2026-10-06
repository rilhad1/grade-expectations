import { createFileRoute } from '@tanstack/react-router';

import { HoursScreen } from '../../features/hours/HoursScreen';

export const Route = createFileRoute('/_app/hours')({ component: HoursScreen });
