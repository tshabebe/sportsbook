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
  header: string;
  card: string;
  badge: string;
};

const variantTone: Record<string, VariantTone> = {
  '1': {
    header: 'rounded-xl border border-border-subtle bg-element-bg p-4',
    card: 'rounded-xl border border-border-subtle bg-element-bg p-4',
    badge: 'bg-accent-solid/20 text-accent-solid',
  },
  '2': {
    header: 'rounded-xl border border-status-negative/40 bg-status-negative-soft p-4',
    card: 'rounded-xl border border-status-negative/40 bg-element-bg p-4',
    badge: 'bg-status-negative-soft text-status-negative',
  },
  '3': {
    header: 'rounded-lg border border-border-subtle bg-element-bg p-3',
    card: 'rounded-lg border border-border-subtle bg-element-bg p-3',
    badge: 'bg-app-bg text-text-muted',
  },
  '4': {
    header: 'rounded-xl border border-status-info/40 bg-status-info-soft p-4',
    card: 'rounded-xl border border-status-info/40 bg-element-bg p-4',
    badge: 'bg-status-info-soft text-status-info',
  },
  '5': {
    header: 'rounded-xl border border-status-positive/40 bg-status-positive-soft p-4',
    card: 'rounded-xl border border-status-positive/40 bg-element-bg p-4',
    badge: 'bg-status-positive-soft text-status-positive',
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
    <div className="flex w-full justify-center">
      <div className="flex w-full max-w-[880px] flex-col gap-4">
      <div className={tone.header}>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Track Ticket</h1>
          <p className="text-sm text-text-muted">Enter ticket ID to check claim, settlement, and payout status.</p>
        </div>

        <form onSubmit={handleSubmit(runLookup)} className="flex flex-col gap-2 md:flex-row">
          <TextField className="flex-1">
            <Label className="sr-only">Ticket ID</Label>
            <Input
              {...register('ticketId')}
              placeholder="Ticket ID"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <Button type="submit" isDisabled={loading}>
            {loading ? 'Checking...' : 'Check'}
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-1 ${tone.badge}`}>View Variant {variant}</span>
          <span className="rounded-full bg-app-bg px-2 py-1 text-text-muted">Ticket Lookup</span>
        </div>
        {errors.ticketId ? <p className="text-xs text-status-negative">{errors.ticketId.message}</p> : null}
      </div>

      {error ? <p className="rounded border border-status-negative/40 bg-status-negative-soft px-3 py-2 text-sm text-status-negative">{error}</p> : null}

      {result ? (
        <div className={tone.card}>
          <div className="flex flex-wrap gap-3">
            <div className="flex w-full flex-col gap-1 rounded-lg border border-border-subtle bg-app-bg p-3 text-sm md:w-[calc((100%-0.75rem)/2)]">
              <p className="text-xs uppercase tracking-wide text-text-muted">Ticket</p>
              <p className="flex items-center gap-2"><Ticket className="h-4 w-4 text-accent-solid" /> {result.ticket.ticketId}</p>
              <p className="flex items-center gap-2"><Hash className="h-4 w-4 text-accent-solid" /> Bet #{result.bet.id ?? '-'}</p>
              <p>Status: <span className="font-semibold">{result.ticket.status}</span></p>
              <p>Claimed By Retailer: {result.ticket.claimedByRetailerId ?? '-'}</p>
            </div>

            <div className="flex w-full flex-col gap-1 rounded-lg border border-border-subtle bg-app-bg p-3 text-sm md:w-[calc((100%-0.75rem)/2)]">
              <p className="text-xs uppercase tracking-wide text-text-muted">Financials</p>
              <p className="flex items-center gap-2"><Wallet className="h-4 w-4 text-accent-solid" /> Stake: {result.bet.stake}</p>
              <p>Bet Status: {result.bet.status}</p>
              <p>Payout: {result.bet.payout ?? '-'}</p>
              <p>Ticket Payout Amount: {result.ticket.payoutAmount ?? '-'}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-app-bg p-3">
            <p className="text-xs uppercase tracking-wide text-text-muted">Lifecycle</p>
            <div className="flex flex-wrap gap-2">
              {steps.map((step) => (
                <div key={step.label} className="w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle px-2 py-2 text-xs md:w-[calc((100%-1.5rem)/4)]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`h-3.5 w-3.5 ${step.done ? 'text-status-positive' : 'text-text-muted'}`} />
                    <span>{step.label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-text-muted">
              <p className="flex w-full items-center gap-1.5 md:w-[calc((100%-0.5rem)/2)]"><Clock3 className="h-3.5 w-3.5" /> Settled: {result.bet.settledAt ?? '-'}</p>
              <p className="flex w-full items-center gap-1.5 md:w-[calc((100%-0.5rem)/2)]"><CalendarDays className="h-3.5 w-3.5" /> Expires: {result.ticket.expiresAt ?? '-'}</p>
            </div>
          </div>
        </div>
      ) : null}

      <Link to="/play" className="inline-block text-sm font-medium text-accent-solid hover:underline">
        Back to betting
      </Link>
      </div>
    </div>
  );
}
