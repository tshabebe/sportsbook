import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, CheckCircle2, Clock3, Hash, Ticket, Wallet } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiError';

type TicketResponse = {
  ticket: {
    ticketId: string;
    status: string;
    createdAt?: string | null;
    claimedByRetailerId?: number | null;
    claimedAt?: string | null;
    paidAt?: string | null;
    payoutAmount?: string | null;
    expiresAt?: string | null;
  };
  bet: {
    id?: number;
    status: string;
    stake: string;
    payout?: string | null;
    settledAt?: string | null;
  };
};

const ticketLookupSchema = z.object({
  ticketId: z
    .string()
    .min(6, 'Ticket ID must be at least 6 characters')
    .max(64, 'Ticket ID is too long'),
});

type TicketLookupForm = z.infer<typeof ticketLookupSchema>;

type VariantTone = {
  shell: string;
  header: string;
  card: string;
  badge: string;
};

const variantTone: Record<string, VariantTone> = {
  '1': {
    shell: 'space-y-4',
    header: 'rounded-xl border border-border-subtle bg-element-bg p-4',
    card: 'rounded-xl border border-border-subtle bg-element-bg p-4',
    badge: 'bg-accent-solid/20 text-accent-solid',
  },
  '2': {
    shell: 'space-y-4',
    header: 'rounded-xl border border-red-500/30 bg-red-500/10 p-4',
    card: 'rounded-xl border border-red-500/30 bg-element-bg p-4',
    badge: 'bg-red-500/20 text-red-500',
  },
  '3': {
    shell: 'space-y-2',
    header: 'rounded-lg border border-border-subtle bg-element-bg p-3',
    card: 'rounded-lg border border-border-subtle bg-element-bg p-3',
    badge: 'bg-app-bg text-text-muted',
  },
  '4': {
    shell: 'space-y-4',
    header: 'rounded-xl border border-blue-500/30 bg-blue-500/10 p-4',
    card: 'rounded-xl border border-blue-500/30 bg-element-bg p-4',
    badge: 'bg-blue-500/20 text-blue-500',
  },
  '5': {
    shell: 'space-y-4',
    header: 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4',
    card: 'rounded-xl border border-emerald-500/30 bg-element-bg p-4',
    badge: 'bg-emerald-500/20 text-emerald-500',
  },
};

function statusSteps(result: TicketResponse | null) {
  if (!result) return [];
  return [
    { label: 'Created', done: Boolean(result.ticket.createdAt) },
    { label: 'Claimed', done: Boolean(result.ticket.claimedAt) },
    { label: 'Settled', done: Boolean(result.bet.settledAt) || result.bet.status !== 'pending' },
    { label: 'Paid', done: Boolean(result.ticket.paidAt) || result.ticket.status === 'paid' },
  ];
}

export function TicketTrackerPage() {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<TicketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TicketLookupForm>({
    resolver: zodResolver(ticketLookupSchema),
    defaultValues: { ticketId: '' },
  });

  const variant = searchParams.get('v') ?? '1';
  const tone = variantTone[variant] ?? variantTone['1'];
  const steps = useMemo(() => statusSteps(result), [result]);

  const runLookup = async (values: TicketLookupForm) => {
    if (!values.ticketId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<TicketResponse>(`/tickets/${values.ticketId.trim()}`);
      setResult(data);
    } catch (error: unknown) {
      setResult(null);
      setError(getApiErrorMessage(error, 'Ticket not found'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ticketFromQuery = searchParams.get('ticket');
    if (!ticketFromQuery) return;
    setValue('ticketId', ticketFromQuery);
    void runLookup({ ticketId: ticketFromQuery });
  }, [searchParams, setValue]);

  return (
    <div className={`mx-auto w-full max-w-[880px] ${tone.shell}`}>
      <div className={tone.header}>
        <h1 className="mb-1 text-xl font-semibold">Track Ticket</h1>
        <p className="mb-4 text-sm text-text-muted">Enter ticket ID to check claim, settlement, and payout status.</p>

        <form onSubmit={handleSubmit(runLookup)} className="flex flex-col gap-2 md:flex-row">
          <TextField className="flex-1">
            <Label className="sr-only">Ticket ID</Label>
            <Input
              {...register('ticketId')}
              placeholder="Ticket ID"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <Button type="submit" isDisabled={loading} className="text-black">
            {loading ? 'Checking...' : 'Check'}
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-1 ${tone.badge}`}>View Variant {variant}</span>
          <span className="rounded-full bg-app-bg px-2 py-1 text-text-muted">Ticket Lookup</span>
        </div>
        {errors.ticketId ? <p className="mt-2 text-xs text-red-500">{errors.ticketId.message}</p> : null}
      </div>

      {error ? <p className="rounded border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}

      {result ? (
        <div className={tone.card}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border-subtle bg-app-bg p-3 text-sm">
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Ticket</p>
              <p className="flex items-center gap-2"><Ticket className="h-4 w-4 text-accent-solid" /> {result.ticket.ticketId}</p>
              <p className="mt-1 flex items-center gap-2"><Hash className="h-4 w-4 text-accent-solid" /> Bet #{result.bet.id ?? '-'}</p>
              <p className="mt-1">Status: <span className="font-semibold">{result.ticket.status}</span></p>
              <p className="mt-1">Claimed By Retailer: {result.ticket.claimedByRetailerId ?? '-'}</p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-app-bg p-3 text-sm">
              <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Financials</p>
              <p className="flex items-center gap-2"><Wallet className="h-4 w-4 text-accent-solid" /> Stake: {result.bet.stake}</p>
              <p className="mt-1">Bet Status: {result.bet.status}</p>
              <p className="mt-1">Payout: {result.bet.payout ?? '-'}</p>
              <p className="mt-1">Ticket Payout Amount: {result.ticket.payoutAmount ?? '-'}</p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-border-subtle bg-app-bg p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-text-muted">Lifecycle</p>
            <div className="grid gap-2 md:grid-cols-4">
              {steps.map((step) => (
                <div key={step.label} className="rounded border border-border-subtle px-2 py-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${step.done ? 'text-green-500' : 'text-text-muted'}`} />
                    <span>{step.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 grid gap-2 text-xs text-text-muted md:grid-cols-2">
              <p className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> Settled: {result.bet.settledAt ?? '-'}</p>
              <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Expires: {result.ticket.expiresAt ?? '-'}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Link to="/play" className="inline-block text-sm font-medium text-accent-solid hover:underline">
        Back to betting
      </Link>
    </div>
  );
}
