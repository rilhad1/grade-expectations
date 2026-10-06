import { Box, ButtonBase } from '@mui/material';
import type { ReactNode } from 'react';

import { disciplineTone } from './discipline';

export type LessonCardState =
  'planned' | 'current' | 'held' | 'cancelled' | 'moved' | 'substituted' | 'extra';

export type TagTone = 'ok' | 'accent' | 'warn' | 'err' | 'outline' | 'neutral';

export interface LessonCardTag {
  label: string;
  tone: TagTone;
  icon?: ReactNode;
}

const TAG: Record<TagTone, { bg: string; color: string; border?: string }> = {
  ok: { bg: 'ge.okBg', color: 'ge.ok' },
  accent: { bg: 'background.paper', color: 'primary.main', border: 'ge.accentLine' },
  warn: { bg: 'ge.warnBg', color: 'ge.warn' },
  err: { bg: 'ge.errBg', color: 'ge.errFg' },
  outline: { bg: 'background.paper', color: 'text.secondary', border: 'ge.line2' },
  neutral: { bg: 'ge.sunken', color: 'text.secondary' },
};

/** Тег стану внизу картки (проведено, скасовано, заміна…). */
export function LessonTag({ label, tone, icon }: LessonCardTag) {
  const t = TAG[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        height: 20,
        px: 0.75,
        borderRadius: '4px',
        fontSize: 11,
        fontWeight: 600,
        alignSelf: 'flex-start',
        mt: 'auto',
        bgcolor: t.bg,
        color: t.color,
        ...(t.border && { border: '1px solid', borderColor: t.border }),
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

/**
 * Картка заняття: фон — колір дисципліни, стан — тегом унизу. Однакова в «Сьогодні», розкладі
 * й конструкторі.
 */
export function LessonCard({
  color,
  title,
  kind,
  meta,
  state = 'planned',
  tag,
  onClick,
  ariaLabel,
  minHeight = 96,
}: {
  color: string;
  title: string;
  /** Скорочення виду заняття в куті: Л, ПР, ЛР, КР. */
  kind?: string;
  meta?: readonly string[];
  state?: LessonCardState;
  tag?: LessonCardTag;
  onClick?: () => void;
  ariaLabel?: string;
  minHeight?: number;
}) {
  const tone = disciplineTone(color);
  const off = state === 'cancelled';
  const current = state === 'current';
  return (
    <ButtonBase
      onClick={onClick}
      disabled={onClick === undefined}
      aria-label={ariaLabel}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '3px',
        width: '100%',
        minHeight,
        p: '8px 10px',
        textAlign: 'left',
        borderRadius: '6px',
        border: off ? '1px dashed' : '1px solid',
        borderColor: off ? 'ge.line2' : tone.border,
        bgcolor: off ? 'ge.surface2' : tone.tint,
        color: off ? 'ge.text3' : 'text.primary',
        boxShadow: current ? '0 0 0 1.5px var(--mui-palette-primary-main)' : 'none',
        '&.Mui-disabled': { opacity: 1 },
      }}
    >
      {kind && (
        <Box
          component="span"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 11,
            fontWeight: 700,
            color: off ? 'ge.text3' : 'text.secondary',
          }}
        >
          {kind}
        </Box>
      )}
      <Box
        component="span"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          fontWeight: 600,
          fontSize: 13,
          lineHeight: '17px',
          pr: kind ? 3 : 0,
          textDecoration: off ? 'line-through' : 'none',
        }}
      >
        <Box
          component="i"
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: '2px',
            flexShrink: 0,
            bgcolor: off ? 'ge.line2' : tone.solid,
          }}
        />
        {title}
      </Box>
      {meta?.map((line) => (
        <Box
          component="span"
          key={line}
          sx={{
            fontSize: 12,
            lineHeight: '16px',
            color: off ? 'ge.text3' : 'text.secondary',
            textDecoration: off ? 'line-through' : 'none',
          }}
        >
          {line}
        </Box>
      ))}
      {tag && <LessonTag {...tag} />}
    </ButtonBase>
  );
}
