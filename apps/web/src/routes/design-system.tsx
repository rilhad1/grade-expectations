import { createFileRoute, redirect } from '@tanstack/react-router';

import { DesignSystemPage } from '../features/design-system/DesignSystemPage';

/** Огляд дизайн-системи доступний лише в dev-збірці. */
export const Route = createFileRoute('/design-system')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: '/' });
  },
  component: DesignSystemPage,
});
