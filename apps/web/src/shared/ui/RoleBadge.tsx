import type { Role } from '@ge/shared';
import { Chip } from '@mui/material';

import { uk } from '../i18n/uk';

/** Бейдж ролі: однаковий скрізь, де показується поточна роль. */
export function RoleBadge({ role }: { role: Role }) {
  return <Chip size="small" variant="outlined" color="primary" label={uk.roles[role]} />;
}
