import { describe, expect, it } from 'vitest';

import * as domain from './index.js';

describe('@ge/domain', () => {
  it('експортується без побічних ефектів', () => {
    expect(Object.keys(domain)).toEqual([]);
  });
});
