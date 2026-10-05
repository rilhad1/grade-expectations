import { describe, expect, it } from 'vitest';

import { pickSemester } from './semesterStore';

const sems = [
  { id: 'a', status: 'CLOSED' },
  { id: 'b', status: 'ACTIVE' },
  { id: 'c', status: 'DRAFT' },
];

describe('pickSemester', () => {
  it('збережений семестр має пріоритет', () => {
    expect(pickSemester(sems, 'c')?.id).toBe('c');
  });
  it('без збереженого або з неіснуючим — активний', () => {
    expect(pickSemester(sems, null)?.id).toBe('b');
    expect(pickSemester(sems, 'zzz')?.id).toBe('b');
  });
  it('без активного — перший у списку', () => {
    expect(pickSemester([{ id: 'x', status: 'DRAFT' }], null)?.id).toBe('x');
  });
  it('порожній список — null', () => {
    expect(pickSemester([], null)).toBeNull();
  });
});
