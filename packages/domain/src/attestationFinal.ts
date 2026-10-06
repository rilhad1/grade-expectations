import type { Scale } from '@ge/shared';

import { SCALE_RANGE, type ModuleProposal } from './moduleProposal.js';

/** Тексти підсумкової оцінки модуля, які потрапляють у відомість. */
export const FINAL_NA = 'н/а';
export const FINAL_PASS = 'зар.';
export const FINAL_FAIL = 'незар.';

export type ParsedFinal = { ok: true; text: string } | { ok: false; reason: string };

const NA_ALIASES = new Set(['н/а', 'на', 'н\\а', 'n/a', 'na']);
const PASS_ALIASES = new Set(['зар', 'зар.', 'зараховано', '1']);
const FAIL_ALIASES = new Set(['незар', 'незар.', 'не зараховано', '0']);

/** Розбирає введену викладачем оцінку модуля за шкалою дисципліни й повертає канонічний текст. */
export function parseFinal(scale: Scale, input: string): ParsedFinal {
  const text = input.trim().toLowerCase();
  if (text === '') return { ok: false, reason: 'порожня оцінка' };
  if (NA_ALIASES.has(text)) return { ok: true, text: FINAL_NA };

  if (scale === 'PASS_FAIL') {
    if (PASS_ALIASES.has(text)) return { ok: true, text: FINAL_PASS };
    if (FAIL_ALIASES.has(text)) return { ok: true, text: FINAL_FAIL };
    return { ok: false, reason: 'очікується «зар.», «незар.» або «н/а»' };
  }

  const { min, max } = SCALE_RANGE[scale];
  if (!/^\d+$/.test(text)) return { ok: false, reason: `очікується число від ${min} до ${max}` };
  const value = Number(text);
  if (value < min || value > max) return { ok: false, reason: `оцінка поза шкалою: ${min}…${max}` };
  return { ok: true, text: String(value) };
}

/** Пропозиція системи у вигляді тексту відомості. */
export function proposalText(scale: Scale, proposal: ModuleProposal): string {
  if (proposal.value === 'NA') return FINAL_NA;
  if (scale === 'PASS_FAIL') return proposal.value >= 1 ? FINAL_PASS : FINAL_FAIL;
  return String(proposal.value);
}
