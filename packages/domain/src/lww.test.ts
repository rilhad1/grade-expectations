import { describe, expect, it } from 'vitest';

import { clampOpTime, resolveLww } from './lww.js';

describe('resolveLww', () => {
  it('без попереднього запису — застосувати', () => {
    expect(resolveLww(null, '2026-10-12T10:00:00.000Z')).toBe('apply');
  });

  it('новіша або рівна операція перемагає, старіша — пропускається', () => {
    const existing = '2026-10-12T10:10:00.000Z';
    expect(resolveLww(existing, '2026-10-12T10:20:00.000Z')).toBe('apply');
    expect(resolveLww(existing, existing)).toBe('apply');
    expect(resolveLww(existing, '2026-10-12T10:00:00.000Z')).toBe('skip');
  });
});

describe('clampOpTime', () => {
  const now = '2026-10-12T10:00:00.000Z';
  it('час із майбутнього обрізається до «зараз»', () => {
    expect(clampOpTime('2026-10-12T12:00:00.000Z', now)).toBe(now);
  });
  it('минулий час лишається', () => {
    expect(clampOpTime('2026-10-12T09:00:00.000Z', now)).toBe('2026-10-12T09:00:00.000Z');
  });
});
