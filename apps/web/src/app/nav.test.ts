import { describe, expect, it } from 'vitest';

import { navFor } from './nav';

describe('navFor', () => {
  it('викладач бачить лише «Сьогодні»', () => {
    expect(navFor('TEACHER').map((i) => i.to)).toEqual(['/']);
  });
  it('модератор додатково бачить розділи деканату', () => {
    const to = navFor('MODERATOR').map((i) => i.to);
    expect(to).toContain('/admin/schedule-builder');
    expect(to).toContain('/admin/requests');
    expect(navFor('MODERATOR').find((i) => i.to === '/admin/requests')?.badge).toBe('requests');
  });
  it('без ролі — як у викладача', () => {
    expect(navFor(null).map((i) => i.to)).toEqual(['/']);
  });
});
