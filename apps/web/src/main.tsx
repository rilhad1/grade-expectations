import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { theme } from './app/theme';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });
// Дані читаються з Dexie, а зміни пишуться локально, тож запити не мають зупинятися без мережі
// (за замовчуванням TanStack Query ставить їх на паузу, поки браузер офлайн).
const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'always' }, mutations: { networkMode: 'always' } },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('Не знайдено #root');

createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
