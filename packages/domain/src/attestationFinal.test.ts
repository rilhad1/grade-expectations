import { describe, expect, it } from 'vitest';

import { parseFinal, proposalText } from './attestationFinal.js';

describe('parseFinal', () => {
  it('приймає число в межах шкали', () => {
    expect(parseFinal('TWELVE', ' 9 ')).toEqual({ ok: true, text: '9' });
    expect(parseFinal('HUNDRED', '0')).toEqual({ ok: true, text: '0' });
  });

  it.each(['н/а', 'НА', 'n/a', ' на '])('нормалізує «%s» до н/а', (input) => {
    expect(parseFinal('FIVE', input)).toEqual({ ok: true, text: 'н/а' });
  });

  it('відхиляє порожнє, дробове й поза шкалою', () => {
    expect(parseFinal('TWELVE', '  ')).toMatchObject({ ok: false });
    expect(parseFinal('TWELVE', '8,5')).toMatchObject({ ok: false });
    expect(parseFinal('TWELVE', '13')).toMatchObject({ ok: false });
    expect(parseFinal('FIVE', '0')).toMatchObject({ ok: false });
  });

  it('залік: зар./незар.', () => {
    expect(parseFinal('PASS_FAIL', 'Зар')).toEqual({ ok: true, text: 'зар.' });
    expect(parseFinal('PASS_FAIL', '1')).toEqual({ ok: true, text: 'зар.' });
    expect(parseFinal('PASS_FAIL', 'незар.')).toEqual({ ok: true, text: 'незар.' });
    expect(parseFinal('PASS_FAIL', '0')).toEqual({ ok: true, text: 'незар.' });
    expect(parseFinal('PASS_FAIL', '7')).toMatchObject({ ok: false });
  });
});

describe('proposalText', () => {
  it('перетворює пропозицію на текст відомості', () => {
    expect(proposalText('TWELVE', { value: 9, explanation: '' })).toBe('9');
    expect(proposalText('TWELVE', { value: 'NA', explanation: '' })).toBe('н/а');
    expect(proposalText('PASS_FAIL', { value: 1, explanation: '' })).toBe('зар.');
    expect(proposalText('PASS_FAIL', { value: 0, explanation: '' })).toBe('незар.');
  });
});
