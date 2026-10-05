import type { MeResponse } from '@ge/shared';
import CheckIcon from '@mui/icons-material/Check';
import {
  Avatar,
  Box,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { uk } from '../shared/i18n/uk';
import { RoleBadge } from '../shared/ui/RoleBadge';

import { resolveActiveRole, useRoleStore } from './roleStore';

const initials = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function UserMenu({ me, onLogout }: { me: MeResponse; onLogout: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const preferred = useRoleStore((s) => s.preferredRole);
  const setPreferred = useRoleStore((s) => s.setPreferredRole);
  const active = resolveActiveRole(me.roles, preferred);

  return (
    <>
      <Button
        color="inherit"
        onClick={(e) => {
          setAnchor(e.currentTarget);
        }}
        aria-label={uk.menu.account}
        startIcon={
          <Avatar sx={{ width: 28, height: 28, fontSize: 13 }}>{initials(me.user.fullName)}</Avatar>
        }
      >
        {me.user.fullName}
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null);
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {me.user.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
            {uk.menu.role}
          </Typography>
          {active !== null && <RoleBadge role={active} />}
        </Box>
        {me.roles.length > 1 && [
          <Divider key="d1" />,
          <Typography
            key="t"
            variant="caption"
            color="text.secondary"
            sx={{ px: 2, pt: 1 }}
            component="div"
          >
            {uk.menu.switchRole}
          </Typography>,
          ...me.roles.map((role) => (
            <MenuItem
              key={role}
              selected={role === active}
              onClick={() => {
                setPreferred(role);
                setAnchor(null);
              }}
            >
              <ListItemText>{uk.roles[role]}</ListItemText>
              {role === active && (
                <ListItemIcon sx={{ minWidth: 0, ml: 2 }}>
                  <CheckIcon fontSize="small" />
                </ListItemIcon>
              )}
            </MenuItem>
          )),
        ]}
        <Divider />
        <MenuItem onClick={onLogout}>{uk.menu.logout}</MenuItem>
      </Menu>
    </>
  );
}
