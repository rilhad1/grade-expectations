import type { Scale } from '@ge/shared';
import { Box } from '@mui/material';

import { gradeLabel, gradeTone } from '../../features/lesson/model';

type State = 'normal' | 'pending' | 'error' | 'conflict' | 'editing';

/**
 * Оцінка в клітинці або чипі. Тон (1–3 червонуватий, 10–12 зеленуватий) — лише для 12-бальної шкали;
 * стани: очікує синхронізації (крапка), помилка (кружечок «!»), конфлікт, редагується.
 */
export function GradeChip({
  value,
  scale = 'TWELVE',
  state = 'normal',
  size = 'md',
  label,
  ariaLabel,
}: {
  value: number;
  scale?: Scale;
  state?: State;
  size?: 'sm' | 'md';
  /** Підпис замість числа (наприклад, «зар.» для заліку). */
  label?: string;
  ariaLabel?: string;
}) {
  const tone = gradeTone(scale, value);
  const text = label ?? gradeLabel(scale, value);
  const ring =
    state === 'error'
      ? 'inset 0 0 0 1.5px var(--mui-palette-ge-err)'
      : state === 'conflict'
        ? 'inset 0 0 0 1.5px var(--mui-palette-ge-warnDot)'
        : state === 'editing'
          ? 'inset 0 0 0 2px var(--mui-palette-primary-main)'
          : undefined;
  return (
    <Box
      component="span"
      aria-label={ariaLabel}
      className="tnum"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: size === 'md' ? 30 : 26,
        height: size === 'md' ? 30 : 24,
        px: 0.75,
        borderRadius: size === 'md' ? '6px' : '4px',
        fontSize: size === 'md' ? 15 : 13,
        fontWeight: 600,
        flexShrink: 0,
        color: 'text.primary',
        bgcolor: tone === 'low' ? 'ge.grade.low' : tone === 'high' ? 'ge.grade.high' : 'ge.sunken',
        boxShadow: ring,
      }}
    >
      {text}
      {state === 'pending' && (
        <Box
          component="span"
          aria-hidden
          sx={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 5,
            height: 5,
            borderRadius: '50%',
            bgcolor: 'ge.warnDot',
          }}
        />
      )}
      {state === 'error' && (
        <Box
          component="span"
          aria-hidden
          sx={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: 'ge.err',
            color: 'primary.contrastText',
            fontSize: 9,
            fontWeight: 700,
            lineHeight: '12px',
            textAlign: 'center',
          }}
        >
          !
        </Box>
      )}
    </Box>
  );
}
