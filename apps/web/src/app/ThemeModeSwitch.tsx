import { useColorScheme } from '@mui/material/styles';

import { uk } from '../shared/i18n/uk';
import { SegmentedControl } from '../shared/ui/SegmentedControl';

type Mode = 'light' | 'dark' | 'system';

/** Перемикач теми «Світла / Темна / Як у системі»; вибір MUI зберігає в localStorage. */
export function ThemeModeSwitch({ fullWidth = false }: { fullWidth?: boolean }) {
  const { mode, setMode } = useColorScheme();
  if (!mode) return null;
  return (
    <SegmentedControl<Mode>
      ariaLabel={uk.theme.label}
      value={mode}
      fullWidth={fullWidth}
      onChange={setMode}
      options={[
        { value: 'light', label: uk.theme.light },
        { value: 'dark', label: uk.theme.dark },
        { value: 'system', label: uk.theme.system },
      ]}
    />
  );
}
