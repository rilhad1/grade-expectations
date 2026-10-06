import { defineConfig } from '@playwright/test';

import { API_PORT, WEB_PORT, serverEnv } from './env.js';

const root = new URL('..', import.meta.url).pathname;

export default defineConfig({
  testDir: './specs',
  // Запас для навантаженої машини: dev-сервер Vite компілює сторінки при першому зверненні
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'uk-UA',
    timezoneId: 'Europe/Kyiv',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @ge/api exec tsx src/main.ts',
      cwd: root,
      port: API_PORT,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @ge/web exec vite --port ${WEB_PORT} --strictPort`,
      cwd: root,
      port: WEB_PORT,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
