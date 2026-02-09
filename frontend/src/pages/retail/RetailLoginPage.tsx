import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiError';
import { setRetailToken } from '../../lib/retailAuth';
import { Button } from '../../components/ui/Button';

const retailLoginSchema = z.object({
  username: z.string().min(3, 'Username is required'),
  password: z.string().min(3, 'Password is required'),
});

type RetailLoginForm = z.infer<typeof retailLoginSchema>;

export function RetailLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RetailLoginForm>({
    resolver: zodResolver(retailLoginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (values: RetailLoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/retail/auth/login', values);
      if (!data?.ok || !data?.token) {
        setError('Login failed');
        return;
      }
      setRetailToken(data.token);
      navigate('/retail/dashboard', { replace: true });
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-md rounded-xl border border-border-subtle bg-element-bg p-6"
      >
        <h1 className="mb-1 text-xl font-semibold text-text-contrast">Retail POS Login</h1>
        <p className="mb-6 text-sm text-text-muted">Cashier access only</p>

        <TextField className="mb-4">
          <Label className="mb-2 block text-xs font-medium text-text-muted">Username</Label>
          <Input
            {...register('username')}
            className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
          />
        </TextField>
        {errors.username ? <p className="mb-3 text-xs text-red-500">{errors.username.message}</p> : null}

        <TextField className="mb-4">
          <Label className="mb-2 block text-xs font-medium text-text-muted">Password</Label>
          <Input
            type="password"
            {...register('password')}
            className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
          />
        </TextField>
        {errors.password ? <p className="mb-3 text-xs text-red-500">{errors.password.message}</p> : null}

        {error ? <p className="mb-4 text-sm text-red-500">{error}</p> : null}

        <Button type="submit" isDisabled={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
