import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiError';
import { setAdminToken } from '../../lib/adminAuth';
import { Button } from '../../components/ui/Button';

const adminLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (values: AdminLoginForm) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/admin/auth/login', values);
      if (!data?.ok || !data?.token) {
        setError('Login failed');
        return;
      }
      setAdminToken(data.token);
      navigate('/admin/dashboard', { replace: true });
    } catch (submitError: unknown) {
      setError(getApiErrorMessage(submitError, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-bg px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-border-subtle bg-element-bg p-6"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-text-contrast">Admin Login</h1>
          <p className="text-sm text-text-muted">Manage cashiers and retail performance</p>
        </div>

        <TextField className="flex flex-col gap-2">
          <Label className="text-xs font-medium text-text-muted">Username</Label>
          <Input
            {...register('username')}
            className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
          />
        </TextField>
        {errors.username ? <p className="text-xs text-text-muted">{errors.username.message}</p> : null}

        <TextField className="flex flex-col gap-2">
          <Label className="text-xs font-medium text-text-muted">Password</Label>
          <Input
            type="password"
            {...register('password')}
            className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
          />
        </TextField>
        {errors.password ? <p className="text-xs text-text-muted">{errors.password.message}</p> : null}

        {error ? <p className="text-sm text-text-muted">{error}</p> : null}

        <Button type="submit" isDisabled={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>
    </div>
  );
}
