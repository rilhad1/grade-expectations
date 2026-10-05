// Web Crypto є і в Node 22, і в браузері; пакет не підключає типи Node/DOM.
declare const crypto: { getRandomValues: <T extends ArrayBufferView>(array: T) => T };

/**
 * UUID v7 (RFC 9562): 48 біт часу в мілісекундах + випадкові біти.
 * Генерується на клієнті, тому запис можна створити офлайн; сортується за часом.
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  // 48-бітна мітка часу, big-endian (ділення замість зсувів: у JS побітові операції 32-бітні)
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // версія 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // варіант RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
