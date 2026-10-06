import { createFileRoute } from '@tanstack/react-router';

import { MoreScreen } from '../../features/more/MoreScreen';

export const Route = createFileRoute('/_app/more')({ component: MoreScreen });
