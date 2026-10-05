/** Окреме оточення для e2e: власна БД та порти, щоб не чіпати dev-дані. */
export const API_PORT = 3101;
export const WEB_PORT = 5273;
export const DEMO_PASSWORD = 'e2e-password-123';
export const DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ?? 'postgresql://ge:ge@localhost:5432/ge_e2e';

export const serverEnv = {
  DATABASE_URL,
  API_PORT: String(API_PORT),
  NODE_ENV: 'development',
  BETTER_AUTH_SECRET: 'e2e-only-secret-0123456789abcdef0123456789',
  WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
  DEMO_PASSWORD,
};
