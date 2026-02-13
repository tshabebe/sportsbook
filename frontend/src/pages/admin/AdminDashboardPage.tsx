import { useEffect, useMemo, useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../config/currency';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiError';
import { getAdminToken } from '../../lib/adminAuth';

type CashierSummary = {
  retailerId: number;
  name: string;
  username: string;
  isActive: boolean;
  totalStake: number;
  totalPaidOut: number;
  outstandingPayoutAmount: number;
  ticketsCount: number;
  paidTicketsCount: number;
  outstandingTicketsCount: number;
  netProfit: number;
};

type DashboardSummary = {
  totalStake: number;
  totalPaidOut: number;
  outstandingPayoutAmount: number;
  netProfit: number;
  ticketsCount: number;
  paidTicketsCount: number;
  outstandingTicketsCount: number;
};

const createCashierSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  username: z.string().min(3, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 chars'),
});

type CreateCashierForm = z.infer<typeof createCashierSchema>;

const toDateInputValue = (date: Date): string => date.toISOString().slice(0, 10);
const toRangeDateIso = (value: string, endOfDay: boolean): string => {
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  return new Date(`${value}${suffix}`).toISOString();
};

const authHeaders = () => {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function AdminDashboardPage() {
  const [cashiers, setCashiers] = useState<CashierSummary[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
    return toDateInputValue(from);
  });
  const [toDate, setToDate] = useState(() => toDateInputValue(new Date()));
  const [rowPasswordDraft, setRowPasswordDraft] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [rowActionLoadingId, setRowActionLoadingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCashierForm>({
    resolver: zodResolver(createCashierSchema),
    defaultValues: { name: '', username: '', password: '' },
  });

  const activeCashiers = useMemo(
    () => cashiers.filter((cashier) => cashier.isActive).length,
    [cashiers],
  );

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        from: toRangeDateIso(fromDate, false),
        to: toRangeDateIso(toDate, true),
      };
      const { data } = await api.get('/admin/cashiers', {
        headers: authHeaders(),
        params,
      });
      setCashiers(Array.isArray(data?.cashiers) ? data.cashiers : []);
      setSummary(data?.summary ?? null);
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, 'Failed to load admin dashboard'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const onCreateCashier = async (values: CreateCashierForm) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(
        '/admin/cashiers',
        {
          name: values.name.trim(),
          username: values.username.trim(),
          password: values.password,
        },
        { headers: authHeaders() },
      );
      setMessage(`Cashier ${values.username.trim()} created`);
      reset();
      await loadDashboard();
    } catch (createError: unknown) {
      setError(getApiErrorMessage(createError, 'Failed to create cashier'));
      setLoading(false);
    }
  };

  const toggleCashierStatus = async (cashier: CashierSummary) => {
    setRowActionLoadingId(cashier.retailerId);
    setError(null);
    setMessage(null);
    try {
      await api.patch(
        `/admin/cashiers/${cashier.retailerId}/status`,
        { isActive: !cashier.isActive },
        { headers: authHeaders() },
      );
      setMessage(
        `${cashier.username} ${cashier.isActive ? 'deactivated' : 'activated'}`,
      );
      await loadDashboard();
    } catch (statusError: unknown) {
      setError(getApiErrorMessage(statusError, 'Failed to update cashier status'));
    } finally {
      setRowActionLoadingId(null);
    }
  };

  const resetCashierPassword = async (cashierId: number, username: string) => {
    const nextPassword = String(rowPasswordDraft[cashierId] ?? '').trim();
    if (nextPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setRowActionLoadingId(cashierId);
    setError(null);
    setMessage(null);
    try {
      await api.patch(
        `/admin/cashiers/${cashierId}/password`,
        { password: nextPassword },
        { headers: authHeaders() },
      );
      setRowPasswordDraft((prev) => ({ ...prev, [cashierId]: '' }));
      setMessage(`Password changed for ${username}`);
    } catch (passwordError: unknown) {
      setError(getApiErrorMessage(passwordError, 'Failed to reset password'));
    } finally {
      setRowActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Admin Summary</h2>
          <Button onPress={loadDashboard} isDisabled={loading} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="rounded border border-border-subtle bg-app-bg px-2 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            To
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded border border-border-subtle bg-app-bg px-2 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
            />
          </label>
          <Button onPress={loadDashboard} isDisabled={loading} variant="solid" size="sm">
            Load Range
          </Button>
        </div>

        {summary ? (
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded border border-border-subtle p-3">
              <p className="text-xs text-text-muted">Total Stake</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.totalStake)}</p>
            </div>
            <div className="rounded border border-border-subtle p-3">
              <p className="text-xs text-text-muted">Paid Out</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.totalPaidOut)}</p>
            </div>
            <div className="rounded border border-border-subtle p-3">
              <p className="text-xs text-text-muted">Unpaid Liability</p>
              <p className="text-lg font-semibold text-amber-500">
                {formatCurrency(summary.outstandingPayoutAmount)}
              </p>
            </div>
            <div className="rounded border border-border-subtle p-3">
              <p className="text-xs text-text-muted">Net Profit</p>
              <p
                className={`text-lg font-semibold ${
                  summary.netProfit >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {formatCurrency(summary.netProfit)}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No data loaded yet.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-border-subtle px-2 py-1">
            Cashiers: {cashiers.length}
          </span>
          <span className="rounded border border-border-subtle px-2 py-1">
            Active: {activeCashiers}
          </span>
          <span className="rounded border border-border-subtle px-2 py-1">
            Tickets: {summary?.ticketsCount ?? 0}
          </span>
          <span className="rounded border border-border-subtle px-2 py-1">
            Paid: {summary?.paidTicketsCount ?? 0}
          </span>
          <span className="rounded border border-border-subtle px-2 py-1">
            Unpaid: {summary?.outstandingTicketsCount ?? 0}
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <h2 className="mb-3 text-lg font-semibold">Create Cashier</h2>
        <form onSubmit={handleSubmit(onCreateCashier)} className="grid gap-2 md:grid-cols-4">
          <TextField className="md:col-span-1">
            <Label className="sr-only">Name</Label>
            <Input
              {...register('name')}
              placeholder="Name"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <TextField className="md:col-span-1">
            <Label className="sr-only">Username</Label>
            <Input
              {...register('username')}
              placeholder="Username"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <TextField className="md:col-span-1">
            <Label className="sr-only">Password</Label>
            <Input
              type="password"
              {...register('password')}
              placeholder="Password"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <Button type="submit" isDisabled={loading} variant="success">
            Create
          </Button>
        </form>
        {errors.name ? <p className="mt-2 text-xs text-red-500">{errors.name.message}</p> : null}
        {errors.username ? <p className="mt-2 text-xs text-red-500">{errors.username.message}</p> : null}
        {errors.password ? <p className="mt-2 text-xs text-red-500">{errors.password.message}</p> : null}
      </section>

      <section className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <h2 className="mb-3 text-lg font-semibold">Cashiers</h2>
        <div className="space-y-2">
          {cashiers.length === 0 ? (
            <p className="text-sm text-text-muted">No cashiers found.</p>
          ) : (
            cashiers.map((cashier) => {
              const rowLoading = rowActionLoadingId === cashier.retailerId;
              return (
                <div
                  key={cashier.retailerId}
                  className="rounded border border-border-subtle p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{cashier.name}</p>
                      <p className="text-sm text-text-muted">@{cashier.username}</p>
                    </div>
                    <span
                      className={`rounded px-2 py-1 text-xs font-semibold ${
                        cashier.isActive
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}
                    >
                      {cashier.isActive ? 'active' : 'inactive'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                    <p>Stake: {formatCurrency(cashier.totalStake)}</p>
                    <p>Paid Out: {formatCurrency(cashier.totalPaidOut)}</p>
                    <p>Unpaid: {formatCurrency(cashier.outstandingPayoutAmount)}</p>
                    <p
                      className={cashier.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}
                    >
                      Profit: {formatCurrency(cashier.netProfit)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
                    <span>tickets: {cashier.ticketsCount}</span>
                    <span>paid: {cashier.paidTicketsCount}</span>
                    <span>unpaid: {cashier.outstandingTicketsCount}</span>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                    <TextField className="md:flex-1">
                      <Label className="sr-only">New password</Label>
                      <Input
                        type="password"
                        value={rowPasswordDraft[cashier.retailerId] ?? ''}
                        onChange={(event) =>
                          setRowPasswordDraft((prev) => ({
                            ...prev,
                            [cashier.retailerId]: event.target.value,
                          }))
                        }
                        placeholder="New password"
                        className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
                      />
                    </TextField>
                    <Button
                      onPress={() =>
                        void resetCashierPassword(cashier.retailerId, cashier.username)
                      }
                      isDisabled={rowLoading}
                      variant="outline"
                      size="sm"
                    >
                      Reset Password
                    </Button>
                    <Button
                      onPress={() => void toggleCashierStatus(cashier)}
                      isDisabled={rowLoading}
                      variant={cashier.isActive ? 'danger' : 'success'}
                      size="sm"
                    >
                      {cashier.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {message ? <p className="text-sm text-green-500">{message}</p> : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
