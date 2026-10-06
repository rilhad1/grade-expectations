import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { clearOfflineData, db } from '../offline/db';
import { refreshSyncStatus, useSyncStore } from '../offline/syncStore';
import { uk } from '../shared/i18n/uk';

import { SyncIndicator } from './SyncIndicator';

beforeEach(async () => {
  await clearOfflineData();
  useSyncStore.setState({
    online: true,
    syncing: false,
    pending: 0,
    problem: null,
    notices: [],
    lastSyncAt: null,
  });
});

describe('SyncIndicator', () => {
  it('нічого не показує, коли все збережено', () => {
    const { container } = render(<SyncIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('офлайн показує кількість змін на пристрої', () => {
    useSyncStore.setState({ online: false, pending: 14 });
    render(<SyncIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent('Офлайн · 14 змін на пристрої');
  });

  it('онлайн із чергою — «Синхронізація», проблеми авторизації й сервера — застереження', () => {
    useSyncStore.setState({ pending: 3 });
    const view = render(<SyncIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent('Синхронізація · 3');
    useSyncStore.setState({ problem: 'auth' });
    view.rerender(<SyncIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent(uk.sync.authProblem);
    useSyncStore.setState({ problem: 'server' });
    view.rerender(<SyncIndicator />);
    expect(screen.getByRole('status')).toHaveTextContent(uk.sync.serverProblem);
  });

  it('сповіщення відкриваються у діалозі й очищаються', async () => {
    await db.notices.add({
      id: 'n1',
      kind: 'rejected',
      message: 'Заняття скасовано',
      createdAt: new Date().toISOString(),
    });
    await refreshSyncStatus();
    render(<SyncIndicator />);
    fireEvent.click(await screen.findByText(uk.sync.notices(1)));
    expect(await screen.findByText('Заняття скасовано')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: uk.sync.dismiss }));
    await waitFor(() => {
      expect(useSyncStore.getState().notices).toHaveLength(0);
    });
  });
});
