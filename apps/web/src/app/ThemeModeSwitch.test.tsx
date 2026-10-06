import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { uk } from '../shared/i18n/uk';
import { renderWithClient } from '../test/renderWithProviders';

import { ThemeModeSwitch } from './ThemeModeSwitch';

beforeAll(() => {
  // jsdom не має matchMedia, який потрібен режиму «Як у системі»
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

describe('ThemeModeSwitch', () => {
  it('показує три режими й перемикає тему', () => {
    renderWithClient(<ThemeModeSwitch />);
    const group = screen.getByRole('group', { name: uk.theme.label });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: uk.theme.dark }));
    expect(screen.getByRole('button', { name: uk.theme.dark })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: uk.theme.light }));
    expect(screen.getByRole('button', { name: uk.theme.light })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
