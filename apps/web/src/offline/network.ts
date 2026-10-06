import { ApiError } from '../api/http';

/**
 * Помилка «немає зв'язку з сервером»: fetch без відповіді (TypeError) або шлюз без бекенда.
 * Бізнес-помилки (4xx) і справжні 500 сюди не потрапляють.
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ApiError) return [502, 503, 504].includes(error.status);
  return error instanceof TypeError;
}
