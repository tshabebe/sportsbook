import { useMemo, useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiError';
import { getRetailToken } from '../../lib/retailAuth';

type RetailTicket = {
  ticketId: string;
  status: string;
  claimedByRetailerId?: number | null;
  claimedAt?: string | null;
  paidAt?: string | null;
  payoutAmount?: string | null;
  bet?: {
    id: number;
    stake: string;
    status: string;
    payout?: string | null;
  };
};

const authHeaders = () => {
  const token = getRetailToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const lookupSchema = z.object({
  ticketId: z
    .string()
    .min(6, 'Ticket ID must be at least 6 characters')
    .max(64, 'Ticket ID is too long'),
});

const payoutSchema = z.object({
  payoutReference: z
    .string()
    .min(8, 'Payout reference must be at least 8 characters')
    .max(128, 'Payout reference is too long'),
});

type LookupForm = z.infer<typeof lookupSchema>;
type PayoutForm = z.infer<typeof payoutSchema>;

export function RetailDashboardPage() {
  const [ticket, setTicket] = useState<RetailTicket | null>(null);
  const [myTickets, setMyTickets] = useState<RetailTicket[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    register: registerLookup,
    handleSubmit: handleLookupSubmit,
    formState: { errors: lookupErrors },
  } = useForm<LookupForm>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { ticketId: '' },
  });
  const {
    register: registerPayout,
    handleSubmit: handlePayoutSubmit,
    formState: { errors: payoutErrors },
  } = useForm<PayoutForm>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { payoutReference: '' },
  });

  const canClaim = useMemo(() => ticket?.status === 'open', [ticket]);
  const canPayout = useMemo(() => ticket?.status === 'settled_won_unpaid', [ticket]);

  const lookupTicket = async (values: LookupForm) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.get(`/retail/tickets/${values.ticketId.trim()}`);
      setTicket(data.ticket ?? null);
      setMessage('Ticket loaded');
    } catch (error: unknown) {
      setTicket(null);
      setError(getApiErrorMessage(error, 'Failed to lookup ticket'));
    } finally {
      setLoading(false);
    }
  };

  const claimTicket = async () => {
    if (!ticket) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.post(`/retail/tickets/${ticket.ticketId}/claim`, {}, { headers: authHeaders() });
      setTicket((prev) => (prev ? { ...prev, ...data.ticket } : prev));
      setMessage('Ticket claimed');
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Claim failed'));
    } finally {
      setLoading(false);
    }
  };

  const payoutTicket = async (values: PayoutForm) => {
    if (!ticket) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.post(
        `/retail/tickets/${ticket.ticketId}/payout`,
        { payoutReference: values.payoutReference.trim() },
        { headers: authHeaders() },
      );
      setTicket((prev) => (prev ? { ...prev, ...data.ticket } : prev));
      setMessage(data.idempotent ? 'Already paid (idempotent)' : 'Payout confirmed');
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Payout failed'));
    } finally {
      setLoading(false);
    }
  };

  const loadMyTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/retail/my/tickets', { headers: authHeaders() });
      setMyTickets(data.tickets ?? []);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Failed to load tickets'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <h2 className="mb-3 text-lg font-semibold">Ticket Desk</h2>
        <form onSubmit={handleLookupSubmit(lookupTicket)} className="flex flex-col gap-2 md:flex-row">
          <TextField className="flex-1">
            <Label className="sr-only">Ticket ID</Label>
            <Input
              {...registerLookup('ticketId')}
              placeholder="Enter ticket ID"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <Button type="submit" isDisabled={loading}>
            Lookup
          </Button>
        </form>
        {lookupErrors.ticketId ? <p className="mt-2 text-xs text-red-500">{lookupErrors.ticketId.message}</p> : null}

        {ticket ? (
          <div className="mt-4 rounded border border-border-subtle p-3 text-sm">
            <p>
              <span className="text-text-muted">Ticket:</span> {ticket.ticketId}
            </p>
            <p>
              <span className="text-text-muted">Status:</span> {ticket.status}
            </p>
            <p>
              <span className="text-text-muted">Stake:</span> {ticket.bet?.stake ?? '-'}
            </p>
            <p>
              <span className="text-text-muted">Bet Status:</span> {ticket.bet?.status ?? '-'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onPress={claimTicket} isDisabled={!canClaim || loading} variant="success" size="sm">
                Claim Ticket
              </Button>
              <TextField>
                <Label className="sr-only">Payout reference</Label>
                <Input
                  {...registerPayout('payoutReference')}
                  placeholder="Payout reference"
                  className="min-w-52 rounded border border-border-subtle bg-app-bg px-2 py-1.5 text-xs outline-none focus:border-accent-solid"
                />
              </TextField>
              <Button
                onPress={() => {
                  void handlePayoutSubmit(payoutTicket)();
                }}
                isDisabled={!canPayout || loading}
                variant="solid"
                size="sm"
              >
                Confirm Payout
              </Button>
            </div>
            {payoutErrors.payoutReference ? (
              <p className="mt-2 text-xs text-red-500">{payoutErrors.payoutReference.message}</p>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="mt-3 text-sm text-green-500">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </section>

      <section className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Tickets</h2>
          <Button onPress={loadMyTickets} isDisabled={loading} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
        <div className="space-y-2">
          {myTickets.length === 0 ? (
            <p className="text-sm text-text-muted">No tickets loaded.</p>
          ) : (
            myTickets.map((t) => (
              <div key={t.ticketId} className="rounded border border-border-subtle px-3 py-2 text-sm">
                <p>{t.ticketId}</p>
                <p className="text-text-muted">{t.status}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
