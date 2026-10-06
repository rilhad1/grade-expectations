import { describe, expect, it } from 'vitest';

import { navFor } from './nav';

describe('navFor', () => {
  it('викладач бачить сторінки викладача', () => {
    expect(navFor('TEACHER').map((i) => i.to)).toEqual([
      '/',
      '/schedule',
      '/gradebook',
      '/attestations',
      '/my-disciplines',
      '/hours',
      '/profile',
    ]);
  });
  it('розділи розбито на загальні й «Деканат»; лічильник лише в запитів', () => {
    const items = navFor('MODERATOR');
    expect(items.filter((i) => i.section === 'dean').map((i) => i.to)).toContain('/admin/requests');
    expect(items.filter((i) => i.badge).map((i) => i.to)).toEqual(['/admin/requests']);
    expect(navFor('TEACHER').every((i) => i.section === 'main')).toBe(true);
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
      '/attestations',
      '/my-disciplines',
      '/hours',
      '/profile',
    ]);
  });
});
