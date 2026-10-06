import type { ControlForm, Role } from '@ge/shared';
import { Box } from '@mui/material';

import { uk } from '../i18n/uk';

/** Бейдж ролі: однаковий скрізь, де показується поточна роль. */
export function RoleBadge({ role }: { role: Role }) {
  const mod = role === 'MODERATOR';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        px: 0.875,
        borderRadius: '10px',
        fontSize: 11,
        fontWeight: 600,
        bgcolor: mod ? 'ge.moderator.bg' : 'ge.accentSoft',
        color: mod ? 'ge.moderator.fg' : 'primary.main',
      }}
    >
      {uk.roles[role]}
    </Box>
  );
}

/** Форма контролю: «Екзамен» — заливка акценту, «Залік» — контур. */
export function ControlFormBadge({ form }: { form: ControlForm }) {
  const exam = form === 'EXAM';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        px: 1,
        borderRadius: '4px',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '.02em',
        border: '1px solid',
        borderColor: 'primary.main',
        bgcolor: exam ? 'primary.main' : 'transparent',
        color: exam ? 'primary.contrastText' : 'primary.main',
      }}
    >
      {uk.loads.controlForms[form]}
    </Box>
  );
}
