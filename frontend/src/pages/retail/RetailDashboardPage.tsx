import { useEffect, useMemo, useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../config/currency';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/apiError';
import { printRetailTicket } from '../../lib/retailPrint';
import { getRetailToken } from '../../lib/retailAuth';

type RetailSelection = {
  fixtureId: number;
  marketBetId?: string | null;
  value: string;
  odd: string;
  handicap?: string | null;
};

type RetailTicket = {
  ticketId: string;
  status: string;
  sourceBookCode?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  claimedByRetailerId?: number | null;
  claimedAt?: string | null;
  paidAt?: string | null;
  payoutAmount?: string | null;
  bet?: {
    id: number;
    stake: string;
    status: string;
    payout?: string | null;
    selections?: RetailSelection[];
  };
};

type RecreatedSelection = {
  id: string;
  fixtureName: string;
  marketName: string;
  selectionName: string;
  odds: number;
  fixtureDate?: string;
};

type RetailReportSummary = {
  from: string;
  to: string;
  totalStake: number;
  totalPaidOut: number;
  netProfit: number;
  ticketsCount: number;
  paidTicketsCount: number;
  outstandingTicketsCount: number;
  outstandingPayoutAmount: number;
  byStatus: Record<string, number>;
};

type IssuedBatch = {
  sourceBookCode: string;
  ticketBatchId: string;
  lineCount: number;
  tickets: Array<{ ticketId: string; status: string }>;
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
const issueSchema = z.object({
  bookCode: z
    .string()
    .min(6, 'Book code must be at least 6 characters')
    .max(64, 'Book code is too long'),
});

type LookupForm = z.infer<typeof lookupSchema>;
type PayoutForm = z.infer<typeof payoutSchema>;
type IssueForm = z.infer<typeof issueSchema>;

const toDateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

const toRangeDateIso = (value: string, endOfDay: boolean): string => {
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const date = new Date(`${value}${suffix}`);
  return date.toISOString();
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeReportSummary = (summary: any): RetailReportSummary | null => {
  if (!summary || typeof summary !== 'object') return null;
  return {
    from: String(summary.from ?? ''),
    to: String(summary.to ?? ''),
    totalStake: toNumber(summary.totalStake),
    totalPaidOut: toNumber(summary.totalPaidOut),
    netProfit: toNumber(summary.netProfit),
    ticketsCount: toNumber(summary.ticketsCount),
    paidTicketsCount: toNumber(summary.paidTicketsCount),
    outstandingTicketsCount: toNumber(summary.outstandingTicketsCount),
    outstandingPayoutAmount: toNumber(summary.outstandingPayoutAmount),
    byStatus:
      summary.byStatus && typeof summary.byStatus === 'object'
        ? Object.fromEntries(
          Object.entries(summary.byStatus).map(([status, count]) => [
            status,
            toNumber(count),
          ]),
        )
        : {},
  };
};

export function RetailDashboardPage() {
  const [ticket, setTicket] = useState<RetailTicket | null>(null);
  const [recreatedSelections, setRecreatedSelections] = useState<RecreatedSelection[]>([]);
  const [myTickets, setMyTickets] = useState<RetailTicket[]>([]);
  const [issuedBatch, setIssuedBatch] = useState<IssuedBatch | null>(null);
  const [report, setReport] = useState<RetailReportSummary | null>(null);
  const [reportFrom, setReportFrom] = useState(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
    return toDateInputValue(from);
  });
  const [reportTo, setReportTo] = useState(() => toDateInputValue(new Date()));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loadingDesk, setLoadingDesk] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
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
  const {
    register: registerIssue,
    handleSubmit: handleIssueSubmit,
    formState: { errors: issueErrors },
  } = useForm<IssueForm>({
    resolver: zodResolver(issueSchema),
    defaultValues: { bookCode: '' },
  });

  const canPayout = useMemo(() => ticket?.status === 'settled_won_unpaid', [ticket]);
  const canVoid = useMemo(
    () => Boolean(ticket && !['paid', 'void', 'expired'].includes(ticket.status)),
    [ticket],
  );

  const lookupTicket = async (values: LookupForm) => {
    const ticketId = values.ticketId.trim();
    setLoadingDesk(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.get(`/retail/tickets/${ticketId}`, {
        headers: authHeaders(),
      });
      const lookedTicket = data.ticket ?? null;
      setTicket(lookedTicket);
      const recreateCode = String(lookedTicket?.sourceBookCode ?? '').trim();
      if (recreateCode) {
        try {
          const recreate = await api.get(`/tickets/${encodeURIComponent(recreateCode)}/recreate`);
          setRecreatedSelections(Array.isArray(recreate.data?.bets) ? recreate.data.bets : []);
        } catch {
          setRecreatedSelections([]);
        }
      } else {
        setRecreatedSelections([]);
      }
      setMessage('Ticket loaded');
    } catch (error: unknown) {
      setTicket(null);
      setRecreatedSelections([]);
      setError(getApiErrorMessage(error, 'Failed to lookup ticket'));
    } finally {
      setLoadingDesk(false);
    }
  };

  const payoutTicket = async (values: PayoutForm) => {
    if (!ticket) return;
    setLoadingDesk(true);
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
      void loadMyTickets();
      void loadReport();
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Payout failed'));
    } finally {
      setLoadingDesk(false);
    }
  };

  const voidTicket = async (values: PayoutForm) => {
    if (!ticket) return;
    setLoadingDesk(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.post(
        `/retail/tickets/${ticket.ticketId}/void`,
        { voidReference: values.payoutReference.trim() },
        { headers: authHeaders() },
      );
      setTicket((prev) => (prev ? { ...prev, ...data.ticket } : prev));
      setMessage(data.idempotent ? 'Already voided (idempotent)' : 'Ticket voided and refunded');
      void loadMyTickets();
      void loadReport();
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Void failed'));
    } finally {
      setLoadingDesk(false);
    }
  };

  const loadMyTickets = async () => {
    setLoadingTickets(true);
    setError(null);
    try {
      const { data } = await api.get('/retail/my/tickets', { headers: authHeaders() });
      setMyTickets(data.tickets ?? []);
    } catch (error: unknown) {
      setError(getApiErrorMessage(error, 'Failed to load tickets'));
    } finally {
      setLoadingTickets(false);
    }
  };

  const issueTicketFromBookCode = async (values: IssueForm) => {
    setLoadingDesk(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await api.post(
        '/retail/tickets/issue',
        { bookCode: values.bookCode.trim() },
        { headers: authHeaders() },
      );

      const tickets = Array.isArray(data?.tickets)
        ? data.tickets.map((ticket: any) => ({
          ticketId: String(ticket?.ticketId ?? ''),
          status: String(ticket?.status ?? 'claimed'),
        }))
        : [];

      const batch: IssuedBatch = {
        sourceBookCode: String(data?.sourceBookCode ?? values.bookCode.trim()),
        ticketBatchId: String(data?.ticketBatchId ?? ''),
        lineCount: Number(data?.lineCount ?? tickets.length),
        tickets,
      };

      setIssuedBatch(batch);
      setMessage(`Issued ticket batch ${batch.ticketBatchId || '(unknown id)'}`);

      const firstTicketId = batch.tickets[0]?.ticketId;
      if (firstTicketId) {
        try {
          const lookup = await api.get(`/retail/tickets/${firstTicketId}`, {
            headers: authHeaders(),
          });
          setTicket(lookup.data?.ticket ?? null);
        } catch {
          setTicket(null);
        }
      }

      let recreatedForPrint: RecreatedSelection[] = [];
      try {
        const recreate = await api.get(`/tickets/${encodeURIComponent(batch.sourceBookCode)}/recreate`);
        recreatedForPrint = Array.isArray(recreate.data?.bets) ? recreate.data.bets : [];
        setRecreatedSelections(recreatedForPrint);
      } catch {
        recreatedForPrint = [];
        setRecreatedSelections([]);
      }

      const firstBet = Array.isArray(data?.bets) ? data.bets[0] : null;
      if (firstTicketId && firstBet) {
        const fallbackSelections: Array<{
          fixtureName: string;
          marketName: string;
          selectionName: string;
          odds: number;
        }> = Array.isArray(firstBet?.selections)
          ? firstBet.selections.map((selection: any) => ({
            fixtureName: `Fixture ${selection?.fixtureId ?? '-'}`,
            marketName: selection?.marketBetId ? `Market ${selection.marketBetId}` : 'Market',
            selectionName: String(selection?.value ?? ''),
            odds: toNumber(selection?.odd),
          }))
          : [];
        const recreatedSelectionsForPrint = recreatedForPrint.map((selection) => ({
          fixtureName: selection.fixtureName,
          marketName: selection.marketName,
          selectionName: selection.selectionName,
          odds: toNumber(selection.odds),
          fixtureDate: selection.fixtureDate,
        }));
        const selectionsToPrint =
          recreatedSelectionsForPrint.length > 0
            ? recreatedSelectionsForPrint
            : fallbackSelections;
        const stakeValue = toNumber(firstBet?.stake ?? data?.totalStake);
        const potentialPayout =
          selectionsToPrint.length > 0
            ? selectionsToPrint.reduce(
              (acc: number, selection: { odds: number }) => acc * selection.odds,
              stakeValue || 0,
            )
            : 0;

        const printed = printRetailTicket({
          title: 'Retail Ticket',
          ticketCode: firstTicketId,
          printedAt: new Date().toISOString(),
          mode: String(data?.mode ?? 'single').toUpperCase(),
          stake: stakeValue,
          potentialPayout,
          status: 'claimed',
          selections: selectionsToPrint,
        });

        if (!printed) {
          setError('Popup blocked. Allow popups to print ticket.');
        }
      }

      void loadMyTickets();
      void loadReport();
    } catch (issueError: unknown) {
      setIssuedBatch(null);
      setError(getApiErrorMessage(issueError, 'Failed to issue ticket from book code'));
    } finally {
      setLoadingDesk(false);
    }
  };

  const loadReport = async () => {
    setLoadingReport(true);
    setReportError(null);
    try {
      const params = {
        from: toRangeDateIso(reportFrom, false),
        to: toRangeDateIso(reportTo, true),
      };
      const { data } = await api.get('/retail/my/reports/summary', {
        headers: authHeaders(),
        params,
      });
      setReport(normalizeReportSummary(data.summary));
    } catch (loadError: unknown) {
      setReportError(getApiErrorMessage(loadError, 'Failed to load report'));
    } finally {
      setLoadingReport(false);
    }
  };

  const printCurrentTicket = () => {
    if (!ticket) return;

    const fallbackSelections = (ticket.bet?.selections ?? []).map((selection, index) => ({
      fixtureName: `Fixture ${selection.fixtureId}`,
      marketName: selection.marketBetId ? `Market ${selection.marketBetId}` : 'Market',
      selectionName: selection.value,
      odds: toNumber(selection.odd),
      fixtureDate: undefined,
      id: `fallback-${index + 1}`,
    }));

    const selections =
      recreatedSelections.length > 0
        ? recreatedSelections.map((selection) => ({
          fixtureName: selection.fixtureName,
          marketName: selection.marketName,
          selectionName: selection.selectionName,
          odds: toNumber(selection.odds),
          fixtureDate: selection.fixtureDate,
        }))
        : fallbackSelections.map((selection) => ({
          fixtureName: selection.fixtureName,
          marketName: selection.marketName,
          selectionName: selection.selectionName,
          odds: selection.odds,
          fixtureDate: selection.fixtureDate,
        }));

    const stakeValue = toNumber(ticket.bet?.stake);
    const computedPayout = selections.reduce((acc, selection) => acc * selection.odds, stakeValue || 0);

    const printed = printRetailTicket({
      title: 'Retail Ticket',
      ticketCode: ticket.ticketId,
      printedAt: new Date().toISOString(),
      mode: selections.length > 1 ? `Multiple (${selections.length}/${selections.length})` : 'Single (1/1)',
      stake: stakeValue,
      potentialPayout: Math.max(
        toNumber(ticket.bet?.payout),
        toNumber(ticket.payoutAmount),
        computedPayout,
      ),
      status: ticket.status,
      selections,
    });

    if (!printed) {
      setError('Popup blocked. Allow popups to print ticket.');
    }
  };

  useEffect(() => {
    void loadMyTickets();
    void loadReport();
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <h2 className="mb-3 text-lg font-semibold">Ticket Desk</h2>
        <form onSubmit={handleIssueSubmit(issueTicketFromBookCode)} className="mb-4 flex flex-col gap-2 md:flex-row">
          <TextField className="flex-1">
            <Label className="sr-only">Book Code</Label>
            <Input
              {...registerIssue('bookCode')}
              placeholder="Enter book code to issue ticket"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <Button type="submit" isDisabled={loadingDesk} variant="success">
            Issue Ticket
          </Button>
        </form>
        {issueErrors.bookCode ? (
          <p className="mt-2 text-xs text-red-500">{issueErrors.bookCode.message}</p>
        ) : null}

        {issuedBatch ? (
          <div className="mb-4 rounded border border-border-subtle p-3 text-sm">
            <p>
              <span className="text-text-muted">Book Code:</span> {issuedBatch.sourceBookCode}
            </p>
            <p>
              <span className="text-text-muted">Issued Batch:</span> {issuedBatch.ticketBatchId}
            </p>
            <p>
              <span className="text-text-muted">Lines:</span> {issuedBatch.lineCount}
            </p>
            <p>
              <span className="text-text-muted">Tickets:</span>{' '}
              {issuedBatch.tickets.map((ticket) => ticket.ticketId).join(', ') || '-'}
            </p>
          </div>
        ) : null}

        <form onSubmit={handleLookupSubmit(lookupTicket)} className="flex flex-col gap-2 md:flex-row">
          <TextField className="flex-1">
            <Label className="sr-only">Ticket ID</Label>
            <Input
              {...registerLookup('ticketId')}
              placeholder="Enter ticket ID"
              className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
            />
          </TextField>
          <Button type="submit" isDisabled={loadingDesk}>
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
              <span className="text-text-muted">Source Code:</span> {ticket.sourceBookCode ?? '-'}
            </p>
            <p>
              <span className="text-text-muted">Stake:</span>{' '}
              {ticket.bet?.stake ? formatCurrency(toNumber(ticket.bet.stake)) : '-'}
            </p>
            <p>
              <span className="text-text-muted">Bet Status:</span> {ticket.bet?.status ?? '-'}
            </p>
            <p>
              <span className="text-text-muted">Created:</span>{' '}
              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '-'}
            </p>
            <p>
              <span className="text-text-muted">Expires:</span>{' '}
              {ticket.expiresAt ? new Date(ticket.expiresAt).toLocaleString() : '-'}
            </p>
            <p>
              <span className="text-text-muted">Payout Amount:</span>{' '}
              {ticket.payoutAmount ? formatCurrency(toNumber(ticket.payoutAmount)) : '-'}
            </p>
            <p>
              <span className="text-text-muted">Paid At:</span>{' '}
              {ticket.paidAt ? new Date(ticket.paidAt).toLocaleString() : '-'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onPress={printCurrentTicket} isDisabled={loadingDesk} variant="outline" size="sm">
                Print Ticket
              </Button>
              <TextField>
                <Label className="sr-only">Desk reference</Label>
                <Input
                  {...registerPayout('payoutReference')}
                  placeholder="Desk reference"
                  className="min-w-52 rounded border border-border-subtle bg-app-bg px-2 py-1.5 text-xs outline-none focus:border-accent-solid"
                />
              </TextField>
              <Button
                onPress={() => {
                  void handlePayoutSubmit(payoutTicket)();
                }}
                isDisabled={!canPayout || loadingDesk}
                variant="solid"
                size="sm"
              >
                Confirm Payout
              </Button>
              <Button
                onPress={() => {
                  void handlePayoutSubmit(voidTicket)();
                }}
                isDisabled={!canVoid || loadingDesk}
                variant="danger"
                size="sm"
              >
                Void & Refund
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
          <h2 className="text-lg font-semibold">Retail Report</h2>
          <Button onPress={loadReport} isDisabled={loadingReport} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            From
            <input
              type="date"
              value={reportFrom}
              onChange={(event) => setReportFrom(event.target.value)}
              className="rounded border border-border-subtle bg-app-bg px-2 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            To
            <input
              type="date"
              value={reportTo}
              onChange={(event) => setReportTo(event.target.value)}
              className="rounded border border-border-subtle bg-app-bg px-2 py-2 text-sm text-text-contrast outline-none focus:border-accent-solid"
            />
          </label>
          <Button onPress={loadReport} isDisabled={loadingReport} variant="solid" size="sm">
            Load Range
          </Button>
        </div>

        {report ? (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              {new Date(report.from).toLocaleString()} to {new Date(report.to).toLocaleString()}
            </p>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded border border-border-subtle p-3">
                <p className="text-xs text-text-muted">Total Stake</p>
                <p className="text-lg font-semibold">{formatCurrency(report.totalStake)}</p>
              </div>
              <div className="rounded border border-border-subtle p-3">
                <p className="text-xs text-text-muted">Paid Out</p>
                <p className="text-lg font-semibold">{formatCurrency(report.totalPaidOut)}</p>
              </div>
              <div className="rounded border border-border-subtle p-3">
                <p className="text-xs text-text-muted">Unpaid Liability</p>
                <p className="text-lg font-semibold text-amber-500">
                  {formatCurrency(report.outstandingPayoutAmount)}
                </p>
              </div>
              <div className="rounded border border-border-subtle p-3">
                <p className="text-xs text-text-muted">Net Profit</p>
                <p className={`text-lg font-semibold ${report.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatCurrency(report.netProfit)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded border border-border-subtle px-2 py-1">
                Tickets: {report.ticketsCount}
              </span>
              <span className="rounded border border-border-subtle px-2 py-1">
                Paid: {report.paidTicketsCount}
              </span>
              <span className="rounded border border-border-subtle px-2 py-1">
                Unpaid: {report.outstandingTicketsCount}
              </span>
              {Object.entries(report.byStatus).map(([status, count]) => (
                <span key={status} className="rounded border border-border-subtle px-2 py-1">
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No report loaded yet.</p>
        )}
        {reportError ? <p className="mt-2 text-sm text-red-500">{reportError}</p> : null}
      </section>

      <section className="rounded-lg border border-border-subtle bg-element-bg p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Tickets</h2>
          <Button onPress={loadMyTickets} isDisabled={loadingTickets} variant="outline" size="sm">
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
