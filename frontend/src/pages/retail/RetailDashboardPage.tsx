import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
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

type ToastKind = 'success' | 'error' | 'info';

type DeskToast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
};

type ReportPreset = 'today' | 'tomorrow' | 'this_week' | 'last_7_days' | 'this_month' | 'custom';
type TicketSort = 'newest' | 'oldest' | 'status';

const REPORT_PRESET_OPTIONS: Array<{ value: ReportPreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

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

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const formatStatusLabel = (status: string): string => {
  if (!status) return '-';
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const statusBadgeClass = (status?: string): string => {
  switch (status) {
    case 'paid':
      return 'border-status-positive/40 bg-status-positive-soft text-status-positive';
    case 'settled_won_unpaid':
      return 'border-status-warning/40 bg-status-warning-soft text-status-warning';
    case 'settled_lost':
    case 'expired':
      return 'border-status-negative/40 bg-status-negative-soft text-status-negative';
    case 'claimed':
      return 'border-status-info/40 bg-status-info-soft text-status-info';
    case 'void':
      return 'border-border-subtle bg-app-bg text-text-muted';
    default:
      return 'border-border-subtle bg-element-hover-bg text-text-muted';
  }
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

const resolvePresetRange = (preset: Exclude<ReportPreset, 'custom'>, now: Date) => {
  if (preset === 'today') {
    return { from: startOfDay(now), to: endOfDay(now) };
  }

  if (preset === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { from: startOfDay(tomorrow), to: endOfDay(tomorrow) };
  }

  if (preset === 'this_week') {
    const start = startOfDay(new Date(now));
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    const end = endOfDay(new Date(start));
    end.setDate(start.getDate() + 6);
    return { from: start, to: end };
  }

  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: start, to: end };
  }

  const start = startOfDay(new Date(now));
  start.setDate(start.getDate() - 6);
  return { from: start, to: endOfDay(now) };
};

const defaultRange = resolvePresetRange('today', new Date());

export function RetailDashboardPage() {
  const [ticket, setTicket] = useState<RetailTicket | null>(null);
  const [myTickets, setMyTickets] = useState<RetailTicket[]>([]);
  const [issuedBatch, setIssuedBatch] = useState<IssuedBatch | null>(null);
  const [report, setReport] = useState<RetailReportSummary | null>(null);
  const [reportPreset, setReportPreset] = useState<ReportPreset>('today');
  const [reportFrom, setReportFrom] = useState(() => toDateInputValue(defaultRange.from));
  const [reportTo, setReportTo] = useState(() => toDateInputValue(defaultRange.to));
  const [ticketSort, setTicketSort] = useState<TicketSort>('newest');
  const [deskError, setDeskError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [loadingDesk, setLoadingDesk] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [hasLoadedTickets, setHasLoadedTickets] = useState(false);
  const [hasLoadedReport, setHasLoadedReport] = useState(false);
  const [toasts, setToasts] = useState<DeskToast[]>([]);
  const toastIdRef = useRef(1);
  const [searchParams, setSearchParams] = useSearchParams();

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
  const activeTab: 'work' | 'data' = searchParams.get('tab') === 'data' ? 'data' : 'work';

  const setActiveTab = useCallback(
    (tab: 'work' | 'data') => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (kind: ToastKind, title: string, detail?: string) => {
      const id = toastIdRef.current++;
      setToasts((prev) => [...prev, { id, kind, title, detail }].slice(-4));
      window.setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast],
  );

  const resolveActiveReportRange = useCallback(() => {
    if (reportPreset === 'custom') {
      return {
        fromIso: toRangeDateIso(reportFrom, false),
        toIso: toRangeDateIso(reportTo, true),
      };
    }

    const range = resolvePresetRange(reportPreset, new Date());
    return {
      fromIso: range.from.toISOString(),
      toIso: range.to.toISOString(),
    };
  }, [reportPreset, reportFrom, reportTo]);

  const loadReport = useCallback(async (options?: { silent?: boolean; fromIso?: string; toIso?: string }) => {
    setLoadingReport(true);
    setReportError(null);

    const range =
      options?.fromIso && options?.toIso
        ? { fromIso: options.fromIso, toIso: options.toIso }
        : resolveActiveReportRange();

    try {
      const { data } = await api.get('/retail/my/reports/summary', {
        headers: authHeaders(),
        params: {
          from: range.fromIso,
          to: range.toIso,
        },
      });
      setReport(normalizeReportSummary(data.summary));
    } catch (loadError: unknown) {
      const message = getApiErrorMessage(loadError, 'Failed to load report');
      setReportError(message);
      if (!options?.silent) {
        pushToast('error', 'Report failed', message);
      }
    } finally {
      setHasLoadedReport(true);
      setLoadingReport(false);
    }
  }, [pushToast, resolveActiveReportRange]);

  const loadMyTickets = useCallback(async (options?: { silent?: boolean }) => {
    setLoadingTickets(true);
    setTicketsError(null);
    try {
      const { data } = await api.get('/retail/my/tickets', { headers: authHeaders() });
      setMyTickets(data.tickets ?? []);
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Failed to load tickets');
      setTicketsError(message);
      if (!options?.silent) {
        pushToast('error', 'Ticket list failed', message);
      }
    } finally {
      setHasLoadedTickets(true);
      setLoadingTickets(false);
    }
  }, [pushToast]);

  const lookupTicket = async (values: LookupForm) => {
    const ticketId = values.ticketId.trim();
    setLoadingDesk(true);
    setDeskError(null);
    try {
      const { data } = await api.get(`/retail/tickets/${ticketId}`, {
        headers: authHeaders(),
      });
      setTicket(data.ticket ?? null);
      pushToast('success', 'Ticket loaded', ticketId);
    } catch (error: unknown) {
      setTicket(null);
      const message = getApiErrorMessage(error, 'Failed to lookup ticket');
      setDeskError(message);
      pushToast('error', 'Lookup failed', message);
    } finally {
      setLoadingDesk(false);
    }
  };

  const payoutTicket = async (values: PayoutForm) => {
    if (!ticket) return;
    setLoadingDesk(true);
    setDeskError(null);
    try {
      const { data } = await api.post(
        `/retail/tickets/${ticket.ticketId}/payout`,
        { payoutReference: values.payoutReference.trim() },
        { headers: authHeaders() },
      );
      setTicket((prev) => (prev ? { ...prev, ...data.ticket } : prev));
      pushToast(
        'success',
        data.idempotent ? 'Payout already completed' : 'Payout confirmed',
        ticket.ticketId,
      );
      void loadMyTickets({ silent: true });
      void loadReport({ silent: true });
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Payout failed');
      setDeskError(message);
      pushToast('error', 'Payout failed', message);
    } finally {
      setLoadingDesk(false);
    }
  };

  const issueTicketFromBookCode = async (values: IssueForm) => {
    setLoadingDesk(true);
    setDeskError(null);
    try {
      const { data } = await api.post(
        '/retail/tickets/issue',
        { bookCode: values.bookCode.trim() },
        { headers: authHeaders() },
      );

      const tickets = Array.isArray(data?.tickets)
        ? data.tickets.map((issued: any) => ({
          ticketId: String(issued?.ticketId ?? ''),
          status: String(issued?.status ?? 'claimed'),
        }))
        : [];

      const batch: IssuedBatch = {
        sourceBookCode: String(data?.sourceBookCode ?? values.bookCode.trim()),
        ticketBatchId: String(data?.ticketBatchId ?? ''),
        lineCount: Number(data?.lineCount ?? tickets.length),
        tickets,
      };

      setIssuedBatch(batch);
      pushToast(
        'success',
        'Ticket issued',
        batch.ticketBatchId || batch.tickets[0]?.ticketId || batch.sourceBookCode,
      );

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
      } catch {
        recreatedForPrint = [];
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
          pushToast('info', 'Print blocked', 'Allow popups to print the ticket.');
        }
      }

      void loadMyTickets({ silent: true });
      void loadReport({ silent: true });
    } catch (issueError: unknown) {
      setIssuedBatch(null);
      const rawMessage = getApiErrorMessage(issueError, 'Failed to issue ticket from book code');
      const message = /book code not found/i.test(rawMessage)
        ? 'Book code expired or not found. Ask player to re-book.'
        : rawMessage;
      setDeskError(message);
      pushToast('error', 'Issue failed', message);
    } finally {
      setLoadingDesk(false);
    }
  };

  const sortedTickets = useMemo(() => {
    const list = [...myTickets];
    if (ticketSort === 'status') {
      return list.sort((a, b) => a.status.localeCompare(b.status));
    }

    const direction = ticketSort === 'newest' ? -1 : 1;
    return list.sort((a, b) => {
      const aTime = new Date(a.createdAt ?? 0).getTime() || 0;
      const bTime = new Date(b.createdAt ?? 0).getTime() || 0;
      return (aTime - bTime) * direction;
    });
  }, [myTickets, ticketSort]);

  useEffect(() => {
    if (activeTab !== 'data') return;
    if (!hasLoadedReport && !loadingReport) {
      void loadReport({ silent: true });
    }
    if (!hasLoadedTickets && !loadingTickets) {
      void loadMyTickets({ silent: true });
    }
  }, [
    activeTab,
    hasLoadedReport,
    loadingReport,
    loadReport,
    hasLoadedTickets,
    loadingTickets,
    loadMyTickets,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-3 py-2 shadow-lg backdrop-blur ${
              toast.kind === 'success'
                ? 'border-status-positive/40 bg-status-positive-soft text-status-positive'
                : toast.kind === 'error'
                  ? 'border-status-negative/40 bg-status-negative-soft text-status-negative'
                  : 'border-status-info/40 bg-status-info-soft text-status-info'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.detail ? <p className="text-xs opacity-90">{toast.detail}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-xs opacity-70 transition hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'work' ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-element-bg p-3 md:p-4">
          <div className="flex flex-wrap gap-2">
            <form
              onSubmit={handleIssueSubmit(issueTicketFromBookCode)}
              className="flex w-full items-start gap-2 md:w-[calc((100%-0.5rem)/2)]"
            >
              <TextField className="min-w-0 flex-1">
                <Label className="sr-only">Book code</Label>
                <Input
                  {...registerIssue('bookCode')}
                  placeholder="Enter book code"
                  className="w-full rounded border border-border-subtle bg-app-bg px-3 py-2 text-sm outline-none focus:border-accent-solid"
                />
              </TextField>
              <Button type="submit" isDisabled={loadingDesk} variant="success">
                Issue
              </Button>
            </form>

            <form
              onSubmit={handleLookupSubmit(lookupTicket)}
              className="flex w-full items-start gap-2 md:w-[calc((100%-0.5rem)/2)]"
            >
              <TextField className="min-w-0 flex-1">
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
          </div>

          {issueErrors.bookCode ? (
            <p className="text-xs text-status-negative">{issueErrors.bookCode.message}</p>
          ) : null}
          {lookupErrors.ticketId ? (
            <p className="text-xs text-status-negative">{lookupErrors.ticketId.message}</p>
          ) : null}

          {deskError ? (
            <div className="rounded-lg border border-status-negative/40 bg-status-negative-soft px-3 py-2 text-sm text-status-negative">
              {deskError}
            </div>
          ) : null}

          {issuedBatch ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-app-bg px-3 py-2">
              <p className="text-sm">
                {issuedBatch.sourceBookCode} • {issuedBatch.ticketBatchId || '-'} • {issuedBatch.lineCount} lines
              </p>
              <div className="flex flex-wrap gap-2">
                {issuedBatch.tickets.map((issued) => (
                  <button
                    key={issued.ticketId}
                    type="button"
                    className="rounded border border-border-subtle px-2 py-1 text-xs text-text-muted transition hover:bg-element-hover-bg hover:text-text-contrast"
                    onClick={() => {
                      void lookupTicket({ ticketId: issued.ticketId });
                    }}
                  >
                    {issued.ticketId}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {ticket ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border-subtle p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{ticket.ticketId}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusBadgeClass(ticket.status)}`}>
                  {formatStatusLabel(ticket.status)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                <p className="w-full md:w-[calc((100%-0.5rem)/2)]">
                  <span className="text-text-muted">Stake:</span>{' '}
                  {ticket.bet?.stake ? formatCurrency(toNumber(ticket.bet.stake)) : '-'}
                </p>
                <p className="w-full md:w-[calc((100%-0.5rem)/2)]">
                  <span className="text-text-muted">Payout:</span>{' '}
                  {ticket.payoutAmount ? formatCurrency(toNumber(ticket.payoutAmount)) : '-'}
                </p>
                <p className="w-full md:w-[calc((100%-0.5rem)/2)]">
                  <span className="text-text-muted">Created:</span> {formatDateTime(ticket.createdAt)}
                </p>
                <p className="w-full md:w-[calc((100%-0.5rem)/2)]">
                  <span className="text-text-muted">Paid:</span> {formatDateTime(ticket.paidAt)}
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <TextField className="w-full md:min-w-[240px]">
                  <Label className="sr-only">Payout reference</Label>
                  <Input
                    {...registerPayout('payoutReference')}
                    placeholder="Payout reference"
                    className="w-full rounded border border-border-subtle bg-app-bg px-2 py-2 text-sm outline-none focus:border-accent-solid"
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
              </div>
              {payoutErrors.payoutReference ? (
                <p className="text-xs text-status-negative">{payoutErrors.payoutReference.message}</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'data' ? (
        <>
          <section className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-element-bg p-3 md:p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Report</h2>
                {loadingReport ? (
                  <span className="rounded border border-border-subtle px-2 py-0.5 text-xs text-text-muted">
                    Loading...
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={reportPreset}
                  onChange={(event) => {
                    const value = event.target.value as ReportPreset;
                    setReportPreset(value);
                    if (value !== 'custom') {
                      const range = resolvePresetRange(value, new Date());
                      setReportFrom(toDateInputValue(range.from));
                      setReportTo(toDateInputValue(range.to));
                      void loadReport({
                        silent: true,
                        fromIso: range.from.toISOString(),
                        toIso: range.to.toISOString(),
                      });
                    }
                  }}
                  className="rounded border border-border-subtle bg-app-bg px-2 py-1.5 text-sm text-text-contrast outline-none focus:border-accent-solid"
                >
                  {REPORT_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button onPress={() => void loadReport()} isDisabled={loadingReport} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            </div>

            {reportPreset === 'custom' ? (
              <div className="flex flex-wrap items-end gap-2">
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
                <Button onPress={() => void loadReport()} isDisabled={loadingReport} size="sm">
                  Apply
                </Button>
              </div>
            ) : null}

            {loadingReport && !report ? (
              <div className="flex flex-col gap-3 animate-pulse">
                <div className="h-4 w-56 rounded bg-element-hover-bg" />
                <div className="flex flex-wrap gap-2">
                  <div className="h-20 w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle bg-app-bg md:w-[calc((100%-1.5rem)/4)]" />
                  <div className="h-20 w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle bg-app-bg md:w-[calc((100%-1.5rem)/4)]" />
                  <div className="h-20 w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle bg-app-bg md:w-[calc((100%-1.5rem)/4)]" />
                  <div className="h-20 w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle bg-app-bg md:w-[calc((100%-1.5rem)/4)]" />
                </div>
                <div className="h-6 rounded bg-element-hover-bg" />
              </div>
            ) : report ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-muted">
                  {formatDateTime(report.from)} to {formatDateTime(report.to)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <div className="w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle p-3 md:w-[calc((100%-1.5rem)/4)]">
                    <p className="text-xs text-text-muted">Total Stake</p>
                    <p className="text-lg font-semibold">{formatCurrency(report.totalStake)}</p>
                  </div>
                  <div className="w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle p-3 md:w-[calc((100%-1.5rem)/4)]">
                    <p className="text-xs text-text-muted">Paid Out</p>
                    <p className="text-lg font-semibold">{formatCurrency(report.totalPaidOut)}</p>
                  </div>
                  <div className="w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle p-3 md:w-[calc((100%-1.5rem)/4)]">
                    <p className="text-xs text-text-muted">Unpaid Liability</p>
                    <p className="text-lg font-semibold text-status-warning">
                      {formatCurrency(report.outstandingPayoutAmount)}
                    </p>
                  </div>
                  <div className="w-[calc((100%-0.5rem)/2)] rounded border border-border-subtle p-3 md:w-[calc((100%-1.5rem)/4)]">
                    <p className="text-xs text-text-muted">Net Profit</p>
                    <p className={`text-lg font-semibold ${report.netProfit >= 0 ? 'text-status-positive' : 'text-status-negative'}`}>
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
                      {formatStatusLabel(status)}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">No report loaded.</p>
            )}
            {reportError ? <p className="text-sm text-status-negative">{reportError}</p> : null}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-element-bg p-3 md:p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Tickets</h2>
                {loadingTickets ? (
                  <span className="rounded border border-border-subtle px-2 py-0.5 text-xs text-text-muted">
                    Loading...
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={ticketSort}
                  onChange={(event) => setTicketSort(event.target.value as TicketSort)}
                  className="rounded border border-border-subtle bg-app-bg px-2 py-1.5 text-sm text-text-contrast outline-none focus:border-accent-solid"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="status">Status</option>
                </select>
                <Button onPress={() => void loadMyTickets()} isDisabled={loadingTickets} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            </div>

            {loadingTickets && myTickets.length === 0 ? (
              <div className="flex flex-col gap-2 animate-pulse">
                <div className="h-12 rounded border border-border-subtle bg-app-bg" />
                <div className="h-12 rounded border border-border-subtle bg-app-bg" />
                <div className="h-12 rounded border border-border-subtle bg-app-bg" />
              </div>
            ) : sortedTickets.length === 0 ? (
              <p className="text-sm text-text-muted">No tickets loaded.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedTickets.map((item) => (
                  <div
                    key={item.ticketId}
                    className="flex items-center justify-between gap-3 rounded border border-border-subtle px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.ticketId}</p>
                      <p className="text-xs text-text-muted">{formatDateTime(item.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${statusBadgeClass(item.status)}`}>
                        {formatStatusLabel(item.status)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => {
                          setActiveTab('work');
                          void lookupTicket({ ticketId: item.ticketId });
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ticketsError ? <p className="text-sm text-status-negative">{ticketsError}</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
