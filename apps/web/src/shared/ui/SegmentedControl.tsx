import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/** Сегмент-контрол (група, період, шкала, тема, роль): один обраний варіант, `aria-pressed`. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  fullWidth = false,
  size = 'medium',
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size={size}
      value={value}
      fullWidth={fullWidth}
      aria-label={ariaLabel}
      onChange={(_, next: T | null) => {
        if (next !== null) onChange(next);
      }}
    >
      {options.map((o) => (
        <ToggleButton key={o.value} value={o.value} disabled={o.disabled ?? false}>
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
