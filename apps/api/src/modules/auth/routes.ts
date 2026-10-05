import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Передає запит Fastify у fetch-обробник Better Auth і повертає його відповідь як є. */
function toRequest(request: FastifyRequest): Request {
  const url = new URL(request.url, `${request.protocol}://${request.hostname}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value))
      value.forEach((v) => {
        headers.append(key, v);
      });
    else if (value !== undefined) headers.set(key, value);
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  return new Request(url, {
    method: request.method,
    headers,
    ...(hasBody && request.body !== undefined && request.body !== null
      ? { body: JSON.stringify(request.body) }
      : {}),
  });
}

export function authRoutes(app: FastifyInstance): void {
  app.route({
    method: ['GET', 'POST'],
    url: '/auth/*',
    // Обмеження спроб входу на рівні IP (брутфорс)
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const response = await app.auth.handler(toRequest(request));
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') return; // нижче: може бути кілька cookie
        void reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) void reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
