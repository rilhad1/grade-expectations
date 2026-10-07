import type { LoadDto } from '@ge/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithClient } from '../../test/renderWithProviders';

const loads: LoadDto[] = [
  {
    id: 'l1',
    kind: 'PRACTICE',
    teacher: { id: 't', fullName: 'Бойчук В.В.' },
    discipline: { id: 'd', title: 'Інформатика', shortTitle: 'Інформ.', color: '#3B6EA5' },
    group: { id: 'g', name: 'ПДт-12' },
    subgroup: null,
    plannedHours: 32,
    hours: { planned: 32, held: 10, forecast: 28, deficit: 4, extraPairsNeeded: 2 },
  } as unknown as LoadDto,
];

vi.mock('../../api/queries', () => ({
  q: { loads: () => ({ queryKey: ['loads'], queryFn: () => loads }) },
}));
vi.mock('../../app/SemesterSwitcher', () => ({
  useCurrentSemester: () => ({ semester: { id: 's1' } }),
}));
vi.mock('../../app/useMe', () => ({ useMe: () => ({ isModerator: false }) }));

const { HoursScreen } = await import('./HoursScreen');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HoursScreen', () => {
  it('на широкому екрані — таблиця', async () => {
    renderWithClient(<HoursScreen />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('на телефоні — картки з прогресом, прогнозом і нестачею', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    }));
    renderWithClient(<HoursScreen />);
    const list = await screen.findByRole('list');
    expect(screen.queryByRole('table')).toBeNull();
    const card = within(list).getAllByRole('listitem')[0];
    expect(card).toHaveTextContent('Інформ. · ПДт-12');
    expect(card).toHaveTextContent('Практична');
    expect(card).toHaveTextContent('не вистачає 4');
  });
});
