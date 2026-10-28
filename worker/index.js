/* global URL, Headers, fetch */
// Cloudflare Worker: статика веба віддається з assets, а /api/* проксіюється на API (Render).
// Так веб і API для браузера — один origin: cookie сесії першопартійні, CORS не потрібен.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const target = new URL(url.pathname + url.search, env.API_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set('x-forwarded-host', url.host);
    headers.set('x-forwarded-proto', 'https');
    // Адресу клієнта визначає Cloudflare; значення X-Forwarded-For від клієнта підробляється, тож перезаписуємо його
    const clientIp = request.headers.get('cf-connecting-ip');
    if (clientIp) headers.set('x-forwarded-for', clientIp);
    else headers.delete('x-forwarded-for');
    return fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    });
  },
};
