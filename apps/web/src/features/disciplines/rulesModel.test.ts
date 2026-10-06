import { describe, expect, it } from 'vitest';

import { moveItem, planBalance, weightsFromForm } from './rulesModel';

describe('planBalance', () => {
  it('рахує суму годин і різницю з навантаженням', () => {
    expect(planBalance([{ hours: 2 }, { hours: 4 }], 32)).toEqual({ total: 6, diff: -26 });
    expect(planBalance([{ hours: 40 }], 32)).toEqual({ total: 40, diff: 8 });
    expect(planBalance([], 10)).toEqual({ total: 0, diff: -10 });
  });
});

describe('moveItem', () => {
  it('рухає вгору й вниз', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });
  it('на межах нічого не змінює й не мутує вхід', () => {
    const src = ['a', 'b'];
    expect(moveItem(src, 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(src, 1, 1)).toEqual(['a', 'b']);
    expect(src).toEqual(['a', 'b']);
  });
});

describe('weightsFromForm', () => {
  it('приймає кому, відкидає порожнє, нульове та сміття', () => {
    expect(weightsFromForm({ ORAL: '1', PRACTICE: '1,5', LAB: '', TEST: 'abc' })).toEqual({
      ORAL: 1,
      PRACTICE: 1.5,
    });
    expect(weightsFromForm({ ORAL: '0', LAB: '-2' })).toEqual({});
    expect(weightsFromForm({})).toEqual({});
  });
});
