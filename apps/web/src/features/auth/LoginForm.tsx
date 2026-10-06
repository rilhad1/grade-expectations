import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Divider, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { authClient } from '../../api/authClient';
import { uk } from '../../shared/i18n/uk';

const loginSchema = z.object({
  email: z.string().pipe(z.email(uk.login.emailInvalid)),
  password: z.string().min(8, uk.login.passwordShort),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({
  googleEnabled,
  onSignedIn,
}: {
  googleEnabled: boolean;
  onSignedIn: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const submit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await authClient.signIn.email(values);
      if (result.error) {
        setError(result.error.status === 401 ? uk.login.invalidCredentials : uk.login.unknownError);
        return;
      }
      onSignedIn();
    } catch {
      setError(uk.login.unknownError);
    }
  });

  return (
    <Stack component="form" spacing={2.5} onSubmit={(e) => void submit(e)} noValidate>
      <Typography variant="h5" component="h1" sx={{ fontSize: 26, lineHeight: '34px' }}>
        {uk.login.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {uk.login.subtitle}
      </Typography>

      {googleEnabled && (
        <>
          <Button
            variant="outlined"
            size="large"
            onClick={() => {
              void authClient.signIn.social({ provider: 'google', callbackURL: '/' });
            }}
          >
            {uk.login.google}
          </Button>
          <Divider>{uk.login.or}</Divider>
        </>
      )}

      {error !== null && <Alert severity="error">{error}</Alert>}

      <TextField
        label={uk.login.email}
        type="email"
        autoComplete="username"
        error={errors.email !== undefined}
        helperText={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label={uk.login.password}
        type="password"
        autoComplete="current-password"
        error={errors.password !== undefined}
        helperText={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
        {isSubmitting ? uk.login.submitting : uk.login.submit}
      </Button>

      <Typography variant="caption" color="text.secondary">
        {uk.login.noSignUp}
      </Typography>
    </Stack>
  );
}
