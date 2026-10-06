import { defineConfig } from 'vitest/config';

// Інтеграційні тести ходять у справжню Postgres і хешують паролі (scrypt): під паралельним
// навантаженням дефолтні 10 с на beforeAll інколи не вистачає.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 60_000 },
});
