import { pageOf } from '@ge/shared';
import { z } from 'zod';

/** Помилка API у форматі problem+json (RFC 9457). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    readonly detail?: string,
  ) {
    super(detail ?? title);
  }
}

const problemSchema = z.object({
  status: z.number(),
  code: z.string(),
  title: z.string(),
  detail: z.string().optional(),
});

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export async function http<T>(
  method: Method,
  path: string,
  options: { body?: unknown; schema?: z.ZodType<T> } = {},
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: options.body !== undefined ? { 'content-type': 'application/json' } : {},
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const parsed = problemSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      throw new ApiError(res.status, parsed.data.code, parsed.data.title, parsed.data.detail);
    }
    throw new ApiError(res.status, 'HTTP_ERROR', `Помилка ${res.status}`);
  }
  if (res.status === 204) return undefined as T; // 204 No Content: тіла немає
  const json: unknown = await res.json();
  return options.schema ? options.schema.parse(json) : (json as T);
}

export const get = <T>(path: string, schema: z.ZodType<T>) => http('GET', path, { schema });
export const post = <T>(path: string, body: unknown, schema?: z.ZodType<T>) =>
  http('POST', path, { body, ...(schema && { schema }) });
export const patch = <T>(path: string, body: unknown, schema: z.ZodType<T>) =>
  http('PATCH', path, { body, schema });
export const put = <T>(path: string, body: unknown, schema: z.ZodType<T>) =>
  http('PUT', path, { body, schema });
export const del = (path: string): Promise<void> =>
  http<undefined>('DELETE', path).then(() => undefined);

const withQuery = (path: string, params: Record<string, string | number | undefined>): string => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
};

/** Збирає всі сторінки курсорної пагінації (довідники невеликі). */
export async function getAll<S extends z.ZodType>(
  path: string,
  item: S,
  params: Record<string, string | number | undefined> = {},
): Promise<z.infer<S>[]> {
  const items: z.infer<S>[] = [];
  let cursor: string | undefined;
  do {
    const page = await get(withQuery(path, { ...params, limit: 200, cursor }), pageOf(item));
    items.push(...(page.items as z.infer<S>[]));
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}

/** Текст помилки для користувача: код домену → українське повідомлення. */
export function errorMessage(error: unknown, messages: Record<string, string> = {}): string {
  if (error instanceof ApiError) return messages[error.code] ?? error.detail ?? error.title;
  return 'Щось пішло не так. Спробуйте ще раз';
}
