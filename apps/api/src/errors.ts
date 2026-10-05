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
