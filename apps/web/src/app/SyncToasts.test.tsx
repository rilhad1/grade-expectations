import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSyncStore } from '../offline/syncStore';
import { uk } from '../shared/i18n/uk';
import { renderWithClient } from '../test/renderWithProviders';

import { SyncToasts } from './SyncToasts';

beforeEach(() => {
  useSyncStore.setState({ online: true, pending: 0, notices: [], syncing: false, problem: null });
});

describe('SyncToasts', () => {
  it('повідомляє про відновлення зв’язку, збереження й відмови', () => {
    renderWithClient(<SyncToasts />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      useSyncStore.setState({ online: false, pending: 3 });
    });
    act(() => {
      useSyncStore.setState({ online: true });
    });
    expect(screen.getByRole('status')).toHaveTextContent(uk.sync.toastRestored(3));

    act(() => {
      useSyncStore.setState({ pending: 0 });
    });
    expect(screen.getByRole('status')).toHaveTextContent(uk.sync.toastSaved);

    act(() => {
      useSyncStore.setState({
        notices: [
          { id: 'n1', kind: 'rejected', message: 'x', createdAt: '2026-10-12T07:00:00.000Z' },
        ],
      });
    });
    expect(screen.getByRole('alert')).toHaveTextContent(uk.sync.toastRejected(1));
  });
});
