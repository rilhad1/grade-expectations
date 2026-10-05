/** Помилка домену, що серіалізується у problem+json (RFC 9457). */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly title: string,
    readonly detail?: string,
  ) {
    super(detail ?? title);
  }
}

export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Потрібен вхід');
export const forbidden = (detail?: string) =>
  new AppError(403, 'FORBIDDEN', 'Недостатньо прав', detail);
export const notFound = (detail?: string) => new AppError(404, 'NOT_FOUND', 'Не знайдено', detail);
/** Конфлікт стану (дублікат, невідповідний статус, застаріла версія). */
export const conflict = (code: string, detail?: string) =>
  new AppError(409, code, 'Конфлікт', detail);
/** Запит коректний за формою, але порушує бізнес-правило. */
export const unprocessable = (code: string, detail?: string) =>
  new AppError(422, code, 'Неможливо виконати', detail);
