import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import CalendarViewWeekOutlined from '@mui/icons-material/CalendarViewWeekOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import { Box } from '@mui/material';

import { uk } from '../shared/i18n/uk';
import { LinkBase } from '../shared/ui/links';

const item = (selected: boolean) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  height: 64,
  borderRadius: '8px',
  fontSize: 12,
  fontWeight: selected ? 600 : 500,
  textDecoration: 'none',
  color: selected ? 'primary.main' : 'ge.text3',
});

/** Нижня панель телефона: Сьогодні, Розклад, Журнал, Ще. */
export function MobileNav({ path }: { path: string }) {
  const primary = path === '/' || path.startsWith('/schedule') || path.startsWith('/gradebook');
  const links = [
    { to: '/', label: uk.nav.today, Icon: CalendarTodayOutlined, on: path === '/' },
    {
      to: '/schedule',
      label: uk.nav.schedule,
      Icon: CalendarViewWeekOutlined,
      on: path.startsWith('/schedule'),
    },
    {
      to: '/gradebook',
      label: uk.nav.gradebook,
      Icon: MenuBookOutlined,
      on: path.startsWith('/gradebook'),
    },
  ] as const;
  return (
    <Box
      component="nav"
      aria-label={uk.nav.menu}
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1100,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        px: 1,
        pt: 0.5,
        pb: 'max(12px, env(safe-area-inset-bottom))',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {links.map(({ to, label, Icon, on }) => (
        <LinkBase key={to} to={to} aria-current={on ? 'page' : undefined} sx={item(on)}>
          <Icon sx={{ fontSize: 24 }} />
          {label}
        </LinkBase>
      ))}
      <LinkBase to="/more" aria-current={!primary ? 'page' : undefined} sx={item(!primary)}>
        <MenuOutlined sx={{ fontSize: 24 }} />
        {uk.nav.more}
      </LinkBase>
    </Box>
  );
}
