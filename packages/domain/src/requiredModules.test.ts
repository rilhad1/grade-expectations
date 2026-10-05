import { describe, expect, it } from 'vitest';

import { requiredModules } from './requiredModules.js';

describe('requiredModules', () => {
  it('екзамен: 4 модулі', () => {
    expect(requiredModules('EXAM')).toEqual(['INTERIM', 'DIRECTOR_TEST', 'AVERAGE', 'EXAM']);
  });
  it('залік: ті самі без екзамену', () => {
    expect(requiredModules('CREDIT')).toEqual(['INTERIM', 'DIRECTOR_TEST', 'AVERAGE']);
  });
});
