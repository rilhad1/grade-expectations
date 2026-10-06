import type { MeResponse } from '@ge/shared';
import KeyboardDoubleArrowLeft from '@mui/icons-material/KeyboardDoubleArrowLeft';
import { Box, ButtonBase, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';

import { uk } from '../shared/i18n/uk';
import { LinkBase } from '../shared/ui/links';

import { UserMenu } from './UserMenu';
import type { NavItem } from './nav';
import { useSidebarStore } from './sidebarStore';

/** Згорнута панель — на середніх екранах за замовчуванням, далі за вибором користувача. */
export function useSidebarCollapsed(): boolean {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const stored = useSidebarStore((s) => s.collapsed);
  return stored ?? !wide;
}

const itemSx = (selected: boolean, collapsed: boolean) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  height: 36,
  px: collapsed ? 0 : 1.25,
  justifyContent: collapsed ? 'center' : 'flex-start',
  borderRadius: '6px',
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  color: selected ? 'primary.main' : 'text.secondary',
  bgcolor: selected ? 'ge.accentSoft' : 'transparent',
  '&:hover': { bgcolor: selected ? 'ge.accentSoft' : 'ge.sunken' },
});

function Count({ value, collapsed }: { value: number; collapsed: boolean }) {
  return (
    <Box
      component="span"
      className="tnum"
      sx={{
        minWidth: collapsed ? 16 : 22,
        height: collapsed ? 16 : 20,
        px: collapsed ? 0.5 : 0.75,
        borderRadius: '10px',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontSize: collapsed ? 10 : 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(collapsed && { position: 'absolute', top: 2, right: 8 }),
      }}
    >
      {value}
    </Box>
  );
}

/** Бічна панель десктопу: бренд, розділи, «Деканат», згортання, меню користувача. */
export function AppSidebar({
  me,
  items,
  path,
  requestsCount,
  onLogout,
}: {
  me: MeResponse;
  items: readonly NavItem[];
  path: string;
  requestsCount: number;
  onLogout: () => void;
}) {
  const collapsed = useSidebarCollapsed();
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const main = items.filter((i) => i.section === 'main');
  const dean = items.filter((i) => i.section === 'dean');

  const link = (item: NavItem) => {
    const selected = item.to === '/' ? path === '/' : path.startsWith(item.to);
    const count = item.badge === 'requests' ? requestsCount : 0;
    const Icon = item.icon;
    const label = count > 0 ? `${item.label}, ${String(count)}` : item.label;
    const node = (
      <LinkBase
        key={item.to}
        to={item.to}
        aria-label={collapsed ? label : undefined}
        aria-current={selected ? 'page' : undefined}
        sx={itemSx(selected, collapsed)}
      >
        <Icon sx={{ fontSize: 18, flexShrink: 0 }} />
        {!collapsed && (
          <Box component="span" sx={{ flex: 1 }}>
            {item.label}
          </Box>
        )}
        {count > 0 && <Count value={count} collapsed={collapsed} />}
      </LinkBase>
    );
    return collapsed ? (
      <Tooltip key={item.to} title={item.label} placement="right">
        {node}
      </Tooltip>
    ) : (
      node
    );
  };

  return (
    <Box
      component="nav"
      aria-label={uk.nav.menu}
      sx={{
        position: 'sticky',
        top: 0,
        alignSelf: 'start',
        width: collapsed ? 72 : 248,
        height: '100vh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'ge.surface2',
        borderRight: 1,
        borderColor: 'divider',
        transition: 'width .15s ease',
      }}
    >
      <Box
        sx={{
          height: 64,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1.25,
          px: collapsed ? 0 : 2.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            borderRadius: '6px',
            bgcolor: 'primary.main',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '4px',
            px: 1,
            flexShrink: 0,
            '& i': {
              display: 'block',
              height: 2,
              borderRadius: '1px',
              bgcolor: 'primary.contrastText',
            },
          }}
        >
          <i />
          <i style={{ width: '70%' }} />
          <i style={{ width: '45%' }} />
        </Box>
        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ fontSize: 15, fontWeight: 600, lineHeight: '18px', letterSpacing: '-0.01em' }}
            >
              {uk.app.name}
            </Typography>
            <Typography
              noWrap
              variant="caption"
              color="ge.text3"
              component="div"
              sx={{ fontWeight: 400 }}
            >
              {me.organization.title}
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', px: 1.5 }}>
          {main.map(link)}
        </Box>
        {dean.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              px: 1.5,
              pt: 1,
              mt: 0.5,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            {!collapsed && (
              <Typography
                variant="caption"
                color="ge.text3"
                sx={{ px: 1.25, pt: 0.5, pb: 0.5, fontWeight: 600 }}
              >
                {uk.nav.dean}
              </Typography>
            )}
            {dean.map(link)}
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.5, py: 1 }}>
        <ButtonBase
          aria-label={collapsed ? uk.nav.expandPanel : uk.nav.collapsePanel}
          onClick={() => {
            setCollapsed(!collapsed);
          }}
          sx={{
            ...itemSx(false, collapsed),
            width: '100%',
            fontSize: 13,
            fontWeight: 400,
            color: 'ge.text3',
          }}
        >
          <KeyboardDoubleArrowLeft
            sx={{ fontSize: 18, flexShrink: 0, ...(collapsed && { transform: 'scaleX(-1)' }) }}
          />
          {!collapsed && uk.nav.collapse}
        </ButtonBase>
      </Box>

      <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
        <UserMenu me={me} onLogout={onLogout} collapsed={collapsed} />
      </Box>
    </Box>
  );
}
