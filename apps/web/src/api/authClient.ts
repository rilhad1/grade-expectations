import { createAuthClient } from 'better-auth/react';

/** Клієнт Better Auth; запити йдуть на той самий origin (у dev — через проксі Vite). */
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/v1/auth',
});
