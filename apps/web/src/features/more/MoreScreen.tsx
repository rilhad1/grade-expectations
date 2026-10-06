import ChevronRight from '@mui/icons-material/ChevronRight';
import { Box, Button, List, Paper, Typography } from '@mui/material';

import { SemesterSwitcher } from '../../app/SemesterSwitcher';
import { SyncIndicator } from '../../app/SyncIndicator';
import { ThemeModeSwitch } from '../../app/ThemeModeSwitch';
import { RoleSwitch, Initials } from '../../app/UserMenu';
import { MOBILE_PRIMARY, navFor } from '../../app/nav';
import { resolveActiveRole, useRoleStore } from '../../app/roleStore';
import { useLogout } from '../../app/useLogout';
import { useMe } from '../../app/useMe';
import { uk } from '../../shared/i18n/uk';
import { RoleBadge } from '../../shared/ui/Badges';
import { LinkBase } from '../../shared/ui/links';

const Label = ({ id, children }: { id: string; children: string }) => (
  <Typography
    id={id}
    variant="caption"
    color="ge.text3"
    sx={{ px: 0.5, fontWeight: 600, fontSize: 13 }}
  >
    {children}
  </Typography>
);

/** «Ще» на телефоні: інші розділи, семестр, роль, тема, стан синхронізації й вихід. */
export function MoreScreen() {
  const { me } = useMe();
  const preferred = useRoleStore((s) => s.preferredRole);
  const logout = useLogout();
  if (!me) return null;
  const role = resolveActiveRole(me.roles, preferred);
  const rest = navFor(role).filter((i) => !MOBILE_PRIMARY.includes(i.to));
  const sections = [
    { title: null, items: rest.filter((i) => i.section === 'main') },
    { title: uk.nav.dean, items: rest.filter((i) => i.section === 'dean') },
  ].filter((s) => s.items.length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Initials name={me.user.fullName} size={44} />
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}
        >
          <Typography sx={{ fontSize: 17, fontWeight: 600 }}>{me.user.fullName}</Typography>
          {role !== null && <RoleBadge role={role} />}
        </Box>
      </Box>

      <nav aria-label={uk.nav.moreSections}>
        {sections.map((section) => (
          <Box key={section.title ?? 'main'} sx={{ mb: 1.5 }}>
            {section.title && (
              <Typography
                variant="caption"
                color="ge.text3"
                sx={{ display: 'block', px: 0.5, pb: 0.5, fontWeight: 600, fontSize: 13 }}
              >
                {section.title}
              </Typography>
            )}
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <List disablePadding>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <LinkBase
                      key={item.to}
                      to={item.to}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.75,
                        width: '100%',
                        minHeight: 56,
                        px: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                        '&:last-of-type': { borderBottom: 0 },
                        color: 'text.primary',
                        fontSize: 16,
                        textDecoration: 'none',
                      }}
                    >
                      <Icon sx={{ fontSize: 22, color: 'text.secondary' }} />
                      <Box component="span" sx={{ flex: 1 }}>
                        {item.label}
                      </Box>
                      <ChevronRight sx={{ fontSize: 18, color: 'ge.text3' }} />
                    </LinkBase>
                  );
                })}
              </List>
            </Paper>
          </Box>
        ))}
      </nav>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Label id="more-semester">{uk.more.semester}</Label>
        <SemesterSwitcher fullWidth />
      </Box>
      {me.roles.length > 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Label id="more-role">{uk.more.role}</Label>
          <RoleSwitch me={me} />
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Label id="more-theme">{uk.menu.theme}</Label>
        <ThemeModeSwitch fullWidth />
      </Box>
      <SyncIndicator />
      <Button variant="outlined" size="large" onClick={logout}>
        {uk.menu.logout}
      </Button>
    </Box>
  );
}
