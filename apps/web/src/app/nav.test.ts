import { describe, expect, it } from 'vitest';

import { navFor } from './nav';

describe('navFor', () => {
  it('викладач бачить сторінки викладача', () => {
    expect(navFor('TEACHER').map((i) => i.to)).toEqual([
      '/',
      '/schedule',
      '/gradebook',
      '/my-disciplines',
      '/attestations',
      '/hours',
      '/profile',
    ]);
  });
  it('модератор додатково бачить розділи деканату', () => {
    const to = navFor('MODERATOR').map((i) => i.to);
    expect(to).toContain('/admin/schedule-builder');
    expect(to).toContain('/admin/requests');
    expect(navFor('MODERATOR').find((i) => i.to === '/admin/requests')?.badge).toBe('requests');
  });
  it('без ролі — як у викладача', () => {
    expect(navFor(null).map((i) => i.to)).toEqual([
      '/',
      '/schedule',
      '/gradebook',
      '/my-disciplines',
      '/attestations',
      '/hours',
      '/profile',
    ]);
  });
});
