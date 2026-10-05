import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';

import { fetchMe } from '../../api/me';

/** Розділи деканату: лише для користувачів з роллю MODERATOR (права перевіряє й сервер). */
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: async () => {
    const me = await fetchMe();
    if (!me.roles.includes('MODERATOR')) throw redirect({ to: '/' });
  },
  component: () => <Outlet />,
});
