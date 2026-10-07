import type { LoadDto } from '@ge/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';
import { renderWithClient } from '../../test/renderWithProviders';

import { GradebookToolbar } from './GradebookToolbar';

const load = (id: string, group: string, kind: LoadDto['kind']): LoadDto =>
  ({
    id,
    kind,
    plannedHours: 10,
    hours: { held: 2 },
    discipline: { id: 'inf', title: 'Інформатика', shortTitle: 'Інф', color: '#3B6EA5' },
    group: { id: group, name: group },
    subgroup: null,
  }) as LoadDto;

describe('GradebookToolbar', () => {
  it('вид занять — фільтр: клік не веде в інший журнал', () => {
    const onPick = vi.fn();
    const onKindFilter = vi.fn();
    renderWithClient(
      <GradebookToolbar
        loads={[load('lec', 'ПДт-12', 'LECTURE'), load('prac', 'ПДт-12', 'PRACTICE')]}
        currentId="prac"
        onPick={onPick}
        kinds={['LECTURE', 'PRACTICE']}
        kindFilter="ALL"
        onKindFilter={onKindFilter}
      />,
    );
    const filter = screen.getByRole('group', { name: uk.gradebook.kind });
    expect(filter).toHaveTextContent(uk.gradebook.kindFilter.ALL);
    fireEvent.click(screen.getByRole('button', { name: uk.gradebook.kindFilter.PRACTICE }));
    expect(onKindFilter).toHaveBeenCalledWith('PRACTICE');
    expect(onPick).not.toHaveBeenCalled();
  });

  it('фільтра немає, коли в журналі один вид занять', () => {
    renderWithClient(
      <GradebookToolbar
        loads={[load('prac', 'ПДт-12', 'PRACTICE')]}
        currentId="prac"
        onPick={vi.fn()}
        kinds={['PRACTICE']}
        kindFilter="ALL"
        onKindFilter={vi.fn()}
      />,
    );
    expect(screen.queryByRole('group', { name: uk.gradebook.kind })).toBeNull();
  });

  it('перемикач «Майбутні заняття» з’являється лише коли вони є', () => {
    const onShowFuture = vi.fn();
    const props = {
      loads: [load('prac', 'ПДт-12', 'PRACTICE')],
      currentId: 'prac',
      onPick: vi.fn(),
      kinds: ['PRACTICE'] as LoadDto['kind'][],
      kindFilter: 'ALL' as const,
      onKindFilter: vi.fn(),
      onShowFuture,
    };
    const first = renderWithClient(<GradebookToolbar {...props} />);
    expect(screen.queryByLabelText(uk.gradebook.showFuture)).toBeNull();
    first.unmount();

    renderWithClient(<GradebookToolbar {...props} hasFuture />);
    fireEvent.click(screen.getByLabelText(uk.gradebook.showFuture));
    expect(onShowFuture).toHaveBeenCalledWith(true);
  });
});
