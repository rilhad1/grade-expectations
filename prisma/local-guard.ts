/**
 * Захист від випадкового запуску знищувальних/демо-скриптів проти віддаленої (продакшн) бази.
 * Дозволено лише localhost; для свідомого запуску на віддаленій базі потрібна ALLOW_REMOTE_DB=1.
 */
export function assertLocalDatabase(action: string): void {
  const url = process.env['DATABASE_URL'] ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // нерозпізнаний URL вважаємо віддаленим
  }
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  if (!local && process.env['ALLOW_REMOTE_DB'] !== '1') {
    throw new Error(
      `${action}: DATABASE_URL вказує не на localhost (${host || 'невідомий хост'}). ` +
        'Якщо це свідомий запуск, задай ALLOW_REMOTE_DB=1.',
    );
  }
}
