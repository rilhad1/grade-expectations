import { getMeta, setMeta } from './db';
import { isNetworkError } from './network';

/**
 * Читання з мережі з резервом у локальній базі: довідники й профіль, потрібні для запуску
 * застосунку без інтернету. Остання успішна відповідь зберігається під ключем.
 */
export async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const value = await fetcher();
    await setMeta(`cache:${key}`, value).catch(() => undefined);
    return value;
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const stored = await getMeta<T>(`cache:${key}`);
    if (stored === undefined) throw error;
    return stored;
  }
}
