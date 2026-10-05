import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';

import { DATABASE_URL, serverEnv } from './env.js';

const root = new URL('..', import.meta.url).pathname;
const run = (args: string[]) =>
  execFileSync('pnpm', args, {
    cwd: root,
    env: { ...process.env, ...serverEnv },
    stdio: 'inherit',
  });

/** Створює порожню БД для e2e. Видаляти можна лише базу, назва якої закінчується на _e2e. */
async function recreateDatabase(): Promise<void> {
  const url = new URL(DATABASE_URL);
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+_e2e$/.test(name)) {
    throw new Error(`Відмовляюсь перестворювати «${name}»: e2e працює лише з базами *_e2e`);
  }
  url.pathname = '/postgres'; // службова БД для DROP/CREATE
  const admin = new PrismaClient({ datasourceUrl: url.toString() });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.$disconnect();
  }
}

/** Чиста БД з міграціями й демо-даними перед кожним прогоном. */
export default async function globalSetup(): Promise<void> {
  await recreateDatabase();
  run(['db:deploy']);
  run(['db:seed']);
}
