import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

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

/** Ключ ліміту входу: IP + пошта. За спільним NAT коледжу інші користувачі не блокуються, а перебір пароля одного облікового запису обмежений. */
const signInKey = (request: FastifyRequest): string => {
  const email = (request.body as { email?: unknown } | null)?.email;
  return `${request.ip}:${typeof email === 'string' ? email.toLowerCase() : ''}`;
};

export function authRoutes(app: FastifyInstance): void {
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const response = await app.auth.handler(toRequest(request));
    reply.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') return; // нижче: може бути кілька cookie
      void reply.header(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) void reply.header('set-cookie', cookies);
    return reply.send(response.body ? await response.text() : null);
  };

  // Обмежуємо лише дії, що перебирають облікові дані; get-session і вихід викликаються постійно
  const limited = { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: signInKey } };
  app.route({ method: 'POST', url: '/auth/sign-in/*', config: limited, handler });
  app.route({ method: 'POST', url: '/auth/sign-up/*', config: limited, handler });
  app.route({ method: 'POST', url: '/auth/forget-password', config: limited, handler });
  app.route({ method: ['GET', 'POST'], url: '/auth/*', handler });
}
