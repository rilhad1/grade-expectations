import { describe, expect, it } from 'vitest';

import { uk } from '../shared/i18n/uk';

describe('i18n', () => {
  it('містить назву застосунку', () => {
    expect(uk.app.name).toBe('Grade Expectations');
  });
});
