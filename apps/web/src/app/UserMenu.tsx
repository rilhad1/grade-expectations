import type { MeResponse, Role } from '@ge/shared';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined';
import {
  Box,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { uk } from '../shared/i18n/uk';
import { RoleBadge } from '../shared/ui/Badges';
import { SegmentedControl } from '../shared/ui/SegmentedControl';

import { ThemeModeSwitch } from './ThemeModeSwitch';
import { resolveActiveRole, useRoleStore } from './roleStore';

export const initials = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Кружок з ініціалами. */
export function Initials({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        bgcolor: 'ge.sunken',
        border: '1px solid',
        borderColor: 'ge.line2',
        color: 'text.secondary',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 36 ? 16 : 12,
        fontWeight: 600,
      }}
    >
      {initials(name)}
    </Box>
  );
}

/** Вибір ролі (лише коли їх кілька): перемикач у меню користувача й на сторінці «Ще». */
export function RoleSwitch({ me }: { me: MeResponse }) {
  const preferred = useRoleStore((s) => s.preferredRole);
  const setPreferred = useRoleStore((s) => s.setPreferredRole);
  const active = resolveActiveRole(me.roles, preferred);
  if (me.roles.length < 2 || active === null) return null;
  return (
    <SegmentedControl<Role>
      ariaLabel={uk.menu.switchRole}
      value={active}
      fullWidth
      onChange={setPreferred}
      options={me.roles.map((role) => ({ value: role, label: uk.roles[role] }))}
    />
  );
}

/** Кнопка користувача внизу бічної панелі з меню: роль, тема, вихід. */
export function UserMenu({
  me,
  onLogout,
  collapsed = false,
}: {
  me: MeResponse;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const preferred = useRoleStore((s) => s.preferredRole);
  const active = resolveActiveRole(me.roles, preferred);

  return (
    <>
      <ButtonBase
        aria-label={uk.menu.account}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={(e) => {
          setAnchor(e.currentTarget);
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          width: '100%',
          minHeight: 48,
          px: collapsed ? 0 : 1,
          py: 0.75,
          borderRadius: '8px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          textAlign: 'left',
          ...(anchor !== null && { bgcolor: 'ge.sunken' }),
          '&:hover': { bgcolor: 'ge.sunken' },
        }}
      >
        <Initials name={me.user.fullName} />
        {!collapsed && (
          <>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                alignItems: 'flex-start',
              }}
            >
              <Typography noWrap sx={{ fontWeight: 500, maxWidth: '100%' }}>
                {me.user.fullName}
              </Typography>
              {active !== null && <RoleBadge role={active} />}
            </Box>
            <UnfoldMoreOutlined fontSize="small" sx={{ color: 'ge.text3' }} />
          </>
        )}
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 248, mt: -1 } } }}
      >
        <Box sx={{ px: 2, pt: 1, pb: 1.25 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            {me.user.email}
          </Typography>
        </Box>
        {me.roles.length > 1 && (
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ px: 0.5, pb: 0.75 }}
            >
              {uk.menu.switchRole}
            </Typography>
            <RoleSwitch me={me} />
          </Box>
        )}
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            sx={{ px: 0.5, pb: 0.75 }}
          >
            {uk.menu.theme}
          </Typography>
          <ThemeModeSwitch fullWidth />
        </Box>
        <Divider />
        <MenuItem onClick={onLogout} sx={{ mt: 0.5, height: 36 }}>
          <ListItemIcon>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{uk.menu.logout}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
