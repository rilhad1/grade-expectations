import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { uk } from '../../shared/i18n/uk';
import { renderWithClient } from '../../test/renderWithProviders';

import { DesignSystemPage } from './DesignSystemPage';

beforeAll(() => {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  });
});

describe('DesignSystemPage', () => {
  it('показує всі розділи й усі стани картки заняття', () => {
    renderWithClient(<DesignSystemPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: uk.designSystem.title }),
    ).toBeInTheDocument();
    for (const name of [
      'colors',
      'attendance',
      'disciplines',
      'typography',
      'controls',
      'lessonCards',
      'badges',
      'states',
    ] as const) {
      expect(screen.getByRole('region', { name: uk.designSystem[name] })).toBeInTheDocument();
    }
    // «Заплановано» — картка без тегу
    for (const [state, label] of Object.entries(uk.designSystem.cards)) {
      if (state === 'planned') continue;
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
