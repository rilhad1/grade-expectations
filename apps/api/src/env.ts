import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    /** Секрет для підпису сесій Better Auth: не менше 32 символів. */
    BETTER_AUTH_SECRET: z.string().min(32),
    /** Origin веб-застосунку (cookie, callback-и, trustedOrigins). */
    WEB_ORIGIN: z.url().default('http://localhost:5173'),
    /** Лише для e2e/розробки: підміна «сьогодні» (YYYY-MM-DD). У production заборонена. */
    FAKE_TODAY: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.FAKE_TODAY === undefined, {
    message: 'FAKE_TODAY заборонено в production',
    path: ['FAKE_TODAY'],
  });

export type Env = z.infer<typeof envSchema>;

/** Валідує змінні середовища при старті; без коректної конфігурації застосунок не запуститься. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
