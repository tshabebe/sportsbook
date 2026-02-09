import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiError';

type TicketResponse = {
  ticket: {
    ticketId: string;
    status: string;
    claimedByRetailerId?: number | null;
    claimedAt?: string | null;
    paidAt?: string | null;
    payoutAmount?: string | null;
  };
  bet: {
    status: string;
    stake: string;
    payout?: string | null;
    settledAt?: string | null;
  };
};

const ticketLookupSchema = z.object({
  ticketId: z.string().min(3, 'Ticket ID is required'),
});

type TicketLookupForm = z.infer<typeof ticketLookupSchema>;

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
    <div className="mx-auto w-full max-w-[800px] space-y-4">
      <div className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <h1 className="mb-1 text-xl font-semibold">Track Ticket</h1>
        <p className="mb-4 text-sm text-text-muted">Enter your ticket ID to see claim, settlement and payout status.</p>

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
        {errors.ticketId ? <p className="mt-2 text-xs text-red-500">{errors.ticketId.message}</p> : null}
      </div>

      {error ? <p className="rounded border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-500">{error}</p> : null}

      {result ? (
        <div className="rounded-lg border border-border-subtle bg-element-bg p-4 text-sm">
          <p>
            <span className="text-text-muted">Ticket:</span> {result.ticket.ticketId}
          </p>
          <p>
            <span className="text-text-muted">Ticket Status:</span> {result.ticket.status}
          </p>
          <p>
            <span className="text-text-muted">Bet Status:</span> {result.bet.status}
          </p>
          <p>
            <span className="text-text-muted">Stake:</span> {result.bet.stake}
          </p>
          <p>
            <span className="text-text-muted">Payout:</span> {result.bet.payout ?? '-'}
          </p>
          <p>
            <span className="text-text-muted">Claimed By Retailer:</span> {result.ticket.claimedByRetailerId ?? '-'}
          </p>
        </div>
      ) : null}

      <Link to="/play" className="inline-block text-sm font-medium text-accent-solid hover:underline">
        Back to betting
      </Link>
    </div>
  );
}
