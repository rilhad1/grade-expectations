import { describe, expect, it } from 'vitest';

import { promoteGroupName } from './promoteGroup.js';

describe('promoteGroupName', () => {
  it('ПДт-11 → ПДт-21', () => {
    expect(promoteGroupName('ПДт-11')).toEqual({ name: 'ПДт-21', course: 2 });
  });
  it('зберігає номер групи з кількох цифр', () => {
    expect(promoteGroupName('ІПЗ-212')).toEqual({ name: 'ІПЗ-312', course: 3 });
  });
  it('працює без дефіса й з пробілами навколо', () => {
    expect(promoteGroupName(' КН31 ')).toEqual({ name: 'КН41', course: 4 });
  });
  it('назва без цифр → null', () => {
    expect(promoteGroupName('Випускники')).toBeNull();
    expect(promoteGroupName('ПДт-1')).toBeNull();
  });
  it('останній курс → null', () => {
    expect(promoteGroupName('ГР-91')).toBeNull();
  });
});
