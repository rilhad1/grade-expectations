import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  /** Секрет для підпису сесій Better Auth: не менше 32 символів. */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Origin веб-застосунку (cookie, callback-и, trustedOrigins). */
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Валідує змінні середовища при старті; без коректної конфігурації застосунок не запуститься. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
