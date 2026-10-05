import type { MeResponse } from '@ge/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uk } from '../shared/i18n/uk';

import { UserMenu } from './UserMenu';
import { useRoleStore } from './roleStore';

const me = (roles: MeResponse['roles']): MeResponse => ({
  user: {
    id: '0198a3a0-0000-7000-8000-000000000001',
    email: 'both@demo.local',
    fullName: 'Гончар Л.І.',
  },
  organization: { id: '0198a3a0-0000-7000-8000-000000000002', title: 'Демо-коледж' },
  roles,
});

beforeEach(() => {
  useRoleStore.getState().reset();
});

describe('UserMenu', () => {
  it('показує пошту, бейдж поточної ролі й пункт «Вийти»', async () => {
    const onLogout = vi.fn();
    render(<UserMenu me={me(['TEACHER'])} onLogout={onLogout} />);
    await userEvent.setup().click(screen.getByRole('button', { name: uk.menu.account }));
    expect(screen.getByText('both@demo.local')).toBeInTheDocument();
    expect(screen.getByText(uk.roles.TEACHER)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('menuitem', { name: uk.menu.logout }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('перемикач ролей є лише коли ролей кілька', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<UserMenu me={me(['TEACHER'])} onLogout={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: uk.menu.account }));
    expect(screen.queryByText(uk.menu.switchRole)).not.toBeInTheDocument();
    unmount();

    render(<UserMenu me={me(['TEACHER', 'MODERATOR'])} onLogout={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: uk.menu.account }));
    expect(screen.getByText(uk.menu.switchRole)).toBeInTheDocument();
  });

  it('вибір ролі зберігається й змінює бейдж', async () => {
    const user = userEvent.setup();
    render(<UserMenu me={me(['TEACHER', 'MODERATOR'])} onLogout={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: uk.menu.account }));
    await user.click(screen.getByRole('menuitem', { name: uk.roles.MODERATOR }));
    expect(useRoleStore.getState().preferredRole).toBe('MODERATOR');

    await user.click(screen.getByRole('button', { name: uk.menu.account }));
    // бейдж поточної ролі й пункт у списку обох показують «Модератор»
    expect(screen.getAllByText(uk.roles.MODERATOR).length).toBeGreaterThanOrEqual(2);
  });
});
