/** Окреме оточення для e2e: власна БД та порти, щоб не чіпати dev-дані. */
export const API_PORT = 3101;
export const WEB_PORT = 5273;
export const DEMO_PASSWORD = 'e2e-password-123';
export const FAKE_TODAY = '2026-10-12';
/** Той самий момент для браузера: 10:30 за Києвом (UTC+3), 2-га пара йде. */
export const BROWSER_NOW = '2026-10-12T07:30:00Z';
export const DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ?? 'postgresql://ge:ge@localhost:5432/ge_e2e';

export const serverEnv = {
  DATABASE_URL,
  API_PORT: String(API_PORT),
  NODE_ENV: 'development',
  BETTER_AUTH_SECRET: 'e2e-only-secret-0123456789abcdef0123456789',
  WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
  DEMO_PASSWORD,
  // Детермінований «сьогодні» на сервері (понеділок посеред семестру з сид-розкладом)
  FAKE_TODAY: FAKE_TODAY,
  // global-setup перестворює БД уже після старту API, тож pg-boss втратив би свою схему;
  // реальна черга перевіряється інтеграційним тестом plugins/jobs.test.ts
  JOBS_DRIVER: 'inline',
  // Сценарії логіняться десятки разів за хвилину з одного IP
  AUTH_SIGNIN_LIMIT: '1000',
};
