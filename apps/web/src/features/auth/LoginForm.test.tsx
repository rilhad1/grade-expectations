import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { uk } from '../../shared/i18n/uk';

const signInEmail = vi.fn();
const signInSocial = vi.fn();
vi.mock('../../api/authClient', () => ({
  authClient: { signIn: { email: signInEmail, social: signInSocial } },
}));

const { LoginForm } = await import('./LoginForm');

const fill = async (email: string, password: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(uk.login.email), email);
  await user.type(screen.getByLabelText(uk.login.password), password);
  await user.click(screen.getByRole('button', { name: uk.login.submit }));
};

beforeEach(() => {
  signInEmail.mockReset();
  signInSocial.mockReset();
});

describe('LoginForm', () => {
  it('валідує пошту й довжину пароля, не викликаючи сервер', async () => {
    render(<LoginForm googleEnabled={false} onSignedIn={vi.fn()} />);
    await fill('не-пошта', '123');
    expect(await screen.findByText(uk.login.emailInvalid)).toBeInTheDocument();
    expect(screen.getByText(uk.login.passwordShort)).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('успішний вхід викликає signIn і onSignedIn', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const onSignedIn = vi.fn();
    render(<LoginForm googleEnabled={false} onSignedIn={onSignedIn} />);
    await fill('teacher@demo.local', 'demo-password-123');
    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledOnce();
    });
    expect(signInEmail).toHaveBeenCalledWith({
      email: 'teacher@demo.local',
      password: 'demo-password-123',
    });
  });

  it('невірні дані → повідомлення українською, без переходу', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { status: 401 } });
    const onSignedIn = vi.fn();
    render(<LoginForm googleEnabled={false} onSignedIn={onSignedIn} />);
    await fill('teacher@demo.local', 'wrong-password');
    expect(await screen.findByText(uk.login.invalidCredentials)).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('інша помилка → загальне повідомлення', async () => {
    signInEmail.mockRejectedValue(new Error('network'));
    render(<LoginForm googleEnabled={false} onSignedIn={vi.fn()} />);
    await fill('teacher@demo.local', 'demo-password-123');
    expect(await screen.findByText(uk.login.unknownError)).toBeInTheDocument();
  });

  it('кнопка Google показується лише коли вхід через Google увімкнено', async () => {
    const { rerender } = render(<LoginForm googleEnabled={false} onSignedIn={vi.fn()} />);
    expect(screen.queryByRole('button', { name: uk.login.google })).not.toBeInTheDocument();
    rerender(<LoginForm googleEnabled onSignedIn={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: uk.login.google }));
    expect(signInSocial).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/' });
  });
});
