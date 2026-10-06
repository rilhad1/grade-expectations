import type { MeResponse } from '@ge/shared';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uk } from '../shared/i18n/uk';
import { renderWithClient } from '../test/renderWithProviders';

vi.mock('../shared/ui/links', () => ({
  LinkBase: ({
    to,
    children,
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
  }: {
    to: string;
    children: React.ReactNode;
    'aria-label'?: string;
    'aria-current'?: 'page';
  }) => (
    <a href={to} aria-label={ariaLabel} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
}));

const logout = vi.fn();
const useMeMock = vi.hoisted(() => ({ me: undefined as MeResponse | undefined }));
vi.mock('./useMe', () => ({ useMe: () => ({ me: useMeMock.me }) }));
vi.mock('./useLogout', () => ({ useLogout: () => logout }));
vi.mock('./SemesterSwitcher', () => ({ SemesterSwitcher: () => <span>перемикач семестру</span> }));
vi.mock('./SyncIndicator', () => ({ SyncIndicator: () => <span role="status">синхр.</span> }));

const { AppSidebar } = await import('./AppSidebar');
const { MobileNav } = await import('./MobileNav');
const { MoreScreen } = await import('../features/more/MoreScreen');
const { navFor } = await import('./nav');
const { useSidebarStore } = await import('./sidebarStore');
const { useRoleStore } = await import('./roleStore');

const me = (roles: MeResponse['roles']): MeResponse => ({
  user: {
    id: '0198a3a0-0000-7000-8000-000000000001',
    email: 'both@demo.local',
    fullName: 'Бойчук В.В.',
  },
  organization: { id: '0198a3a0-0000-7000-8000-000000000002', title: 'Демо-коледж' },
  roles,
  features: { pdf: false },
});

beforeEach(() => {
  useSidebarStore.setState({ collapsed: false });
  useRoleStore.getState().reset();
  logout.mockReset();
});

describe('AppSidebar', () => {
  it('показує бренд, розділи викладача й користувача; лічильник запитів — у назві посилання', () => {
    renderWithClient(
      <AppSidebar
        me={me(['TEACHER', 'MODERATOR'])}
        items={navFor('MODERATOR')}
        path="/gradebook"
        requestsCount={5}
        onLogout={vi.fn()}
      />,
    );
    const nav = screen.getByRole('navigation', { name: uk.nav.menu });
    expect(nav).toHaveTextContent('Демо-коледж');
    expect(screen.getByRole('link', { name: uk.nav.gradebook })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: uk.nav.today })).not.toHaveAttribute('aria-current');
    expect(screen.getByText(uk.nav.dean)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Запити/ })).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: uk.menu.account })).toBeInTheDocument();
  });

  it('у викладача немає розділу «Деканат»', () => {
    renderWithClient(
      <AppSidebar
        me={me(['TEACHER'])}
        items={navFor('TEACHER')}
        path="/"
        requestsCount={0}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.queryByText(uk.nav.dean)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.today })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('згортається до іконок: підписи в aria-label, вибір зберігається', () => {
    renderWithClient(
      <AppSidebar
        me={me(['TEACHER'])}
        items={navFor('TEACHER')}
        path="/"
        requestsCount={0}
        onLogout={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: uk.nav.collapsePanel }));
    expect(useSidebarStore.getState().collapsed).toBe(true);
    expect(screen.queryByText('Демо-коледж')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.schedule })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: uk.nav.expandPanel }));
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });

  it('у згорнутому стані лічильник запитів лишається в доступній назві', () => {
    useSidebarStore.setState({ collapsed: true });
    renderWithClient(
      <AppSidebar
        me={me(['MODERATOR'])}
        items={navFor('MODERATOR')}
        path="/admin/requests"
        requestsCount={3}
        onLogout={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: `${uk.nav.requests}, 3` })).toBeInTheDocument();
  });
});

describe('MobileNav', () => {
  it('чотири пункти; активний — за шляхом', () => {
    renderWithClient(<MobileNav path="/schedule" />);
    expect(screen.getByRole('navigation', { name: uk.nav.menu })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByRole('link', { name: uk.nav.schedule })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: uk.nav.more })).not.toHaveAttribute('aria-current');
  });

  it('«Ще» активне на розділах, яких немає в нижній панелі', () => {
    renderWithClient(<MobileNav path="/attestations/abc" />);
    expect(screen.getByRole('link', { name: uk.nav.more })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: uk.nav.today })).not.toHaveAttribute('aria-current');
  });
});

describe('MoreScreen', () => {
  it('викладач: інші розділи, семестр, тема, вихід; без «Деканату» й перемикача ролі', () => {
    useMeMock.me = me(['TEACHER']);
    renderWithClient(<MoreScreen />);
    const nav = screen.getByRole('navigation', { name: uk.nav.moreSections });
    for (const label of [uk.nav.attestations, uk.nav.myDisciplines, uk.nav.hours, uk.nav.profile]) {
      expect(nav).toHaveTextContent(label);
    }
    expect(nav).not.toHaveTextContent(uk.nav.today);
    expect(screen.queryByText(uk.nav.dean)).not.toBeInTheDocument();
    expect(screen.queryByText(uk.more.role)).not.toBeInTheDocument();
    expect(screen.getByText('перемикач семестру')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: uk.menu.logout }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('модератор із двома ролями бачить «Деканат» і перемикач ролі', () => {
    useMeMock.me = me(['TEACHER', 'MODERATOR']);
    useRoleStore.getState().setPreferredRole('MODERATOR');
    renderWithClient(<MoreScreen />);
    expect(screen.getByText(uk.nav.dean)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: uk.nav.scheduleBuilder })).toBeInTheDocument();
    expect(screen.getByText(uk.more.role)).toBeInTheDocument();
  });
});
