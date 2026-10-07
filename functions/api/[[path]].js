/* global URL, Headers, fetch */
// Cloudflare Pages Function: проксі /api/* на API (Render), щоб веб і API були одним origin.
// Тоді cookie сесії першопартійні, CORS не потрібен. Змінна середовища: API_ORIGIN (https://....onrender.com).
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.API_ORIGIN);
  const headers = new Headers(request.headers);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');
  return fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });
}
