import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const apiPort = loadEnv(mode, '../..', '')['API_PORT'] ?? '3000';
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Grade Expectations',
          short_name: 'Grade Expectations',
          lang: 'uk',
          theme_color: '#1F3A5F',
          background_color: '#F7F5F0',
          display: 'standalone',
          icons: [],
        },
      }),
    ],
    server: {
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  };
});
