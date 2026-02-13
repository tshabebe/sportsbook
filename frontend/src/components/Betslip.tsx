import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { X, Ticket, Copy, Share2, FileText, ChevronLeft } from 'lucide-react';
import {
  Button as AriaButton,
  Dialog,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectValue,
  Tab,
  TabList,
  Tabs,
  Heading,
} from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBetSlip } from '../context/BetSlipContext';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { formatCurrency } from '../config/currency';
import { formatFixtureTime } from '../lib/date';
import { Button } from './ui/Button';
import type { BetMode } from '../types/backendSchemas';
import { calculateBetSlipPreview } from '../lib/betslip';
import { getAuthToken } from '../lib/auth';
import { useWalletProfile } from '../hooks/useWallet';

import { useMyBets } from '../hooks/useMyBets';

interface BetslipProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  initialStake?: number;
}

const betSlipStakeSchema = z.object({
  stake: z.number().positive('Stake must be greater than 0'),
});

type BetSlipStakeForm = z.infer<typeof betSlipStakeSchema>;
type PlaceChannel = 'wallet' | 'retail';
type BetslipSelectionView = {
  id: string;
  fixtureName: string;
  marketName: string;
  selectionName: string;
  odds: number;
  fixtureDate?: string;
};
type BookedTicket = {
  code: string;
  bets: BetslipSelectionView[];
  date: string;
  stake: number;
};

const QUICK_STAKE_OPTIONS = [20, 50, 100] as const;

export function Betslip({ isOpen = true, onClose, className, initialStake = 1 }: BetslipProps) {
  const [sidebarTab, setSidebarTab] = useState<'slip' | 'mybets'>('slip');
  const [activeTab, setActiveTab] = useState<BetMode>('multiple');
  const [systemSize, setSystemSize] = useState<number>(2);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBetRef, setWalletBetRef] = useState<string | null>(null);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [viewingTicketCode, setViewingTicketCode] = useState<string | null>(null);
  const [bookedTickets, setBookedTickets] = useState<BookedTicket[]>(() => {
    const saved = localStorage.getItem('booked_tickets');
    return saved ? JSON.parse(saved) : [];
  });

  const { data: userBets, refetch: refetchMyBets } = useMyBets();

  useEffect(() => {
    localStorage.setItem('booked_tickets', JSON.stringify(bookedTickets));
  }, [bookedTickets]);

  const { data: walletProfile } = useWalletProfile();
  const walletBalance = walletProfile?.balance ?? 0;
  const isAuthenticated = Boolean(getAuthToken());
  const primaryChannel: PlaceChannel = isAuthenticated ? 'wallet' : 'retail';
  const primaryActionLabel = isAuthenticated ? 'Place Bet' : 'Book a Bet';
  const normalizedInitialStake =
    Number.isFinite(initialStake) && initialStake > 0 ? initialStake : 1;

  const { watch, setValue, getValues } = useForm<BetSlipStakeForm>({
    resolver: zodResolver(betSlipStakeSchema),
    defaultValues: { stake: normalizedInitialStake },
  });

  useEffect(() => {
    setValue('stake', normalizedInitialStake, { shouldValidate: true });
  }, [normalizedInitialStake, setValue]);

  const { bets, removeFromBetSlip, clearBetSlip, toBetSlipInput } = useBetSlip();

  useEffect(() => {
    if (systemSize > bets.length) {
      setSystemSize(Math.max(2, bets.length));
    }
  }, [bets.length, systemSize]);

  const stake = Number(watch('stake') ?? 1);
  const isMultipleSingleFallback = activeTab === 'multiple' && bets.length === 1;
  const effectiveMode: BetMode = isMultipleSingleFallback ? 'single' : activeTab;

  const updateStake = (value: number) => {
    const normalized = Math.max(0, value);
    setValue('stake', normalized, { shouldValidate: true });
  };

  const preview = calculateBetSlipPreview({
    mode: effectiveMode,
    stake,
    selections: bets.map((bet) => ({ odd: bet.odds })),
    systemSize: effectiveMode === 'system' ? systemSize : undefined,
  });

  const placeSlip = async (channel: PlaceChannel) => {
    if (bets.length === 0) return;

    const stakeValue = Number(getValues('stake'));
    if (!Number.isFinite(stakeValue) || stakeValue <= 0) {
      setError('Stake must be greater than 0');
      return;
    }

    if (preview.error) {
      setError(preview.error);
      return;
    }

    if (channel === 'wallet') {
      const token = getAuthToken();
      if (!token) {
        setError('Wallet login is required to place a wallet bet');
        return;
      }
      if (walletBalance < stakeValue) {
        setError(
          `Insufficient balance. Available ${formatCurrency(walletBalance)}, required ${formatCurrency(stakeValue)}`,
        );
        return;
      }
    }

    setIsPlacing(true);
    setError(null);
    setWalletBetRef(null);
    setShowWalletDialog(false);
    setViewingTicketCode(null);

    try {
      const payload = toBetSlipInput(
        stakeValue,
        effectiveMode,
        effectiveMode === 'system' ? systemSize : undefined,
      );

      if (channel === 'wallet') {
        const placeRes = await api.post('/betslip/place', payload);
        if (!placeRes.data.ok) {
          setError(placeRes.data.error?.message || 'Failed to place wallet bet');
          return;
        }

        const ref = String(placeRes.data?.ticket?.ticketRef ?? '');
        if (ref) {
          setWalletBetRef(ref);
          setShowWalletDialog(true);
          void refetchMyBets();
        }

        clearBetSlip();
        setValue('stake', normalizedInitialStake);
        return;
      }

      const placeRes = await api.post('/betslip/place-retail', payload);
      if (!placeRes.data.ok) {
        setError(placeRes.data.error?.message || 'Failed to create retail ticket');
        return;
      }

      const createdCode = String(
        placeRes.data?.bookCode ??
        placeRes.data?.ticket?.ticketId ??
        '',
      );
      if (createdCode) {
        const newTicket = {
          code: createdCode,
          bets: [...bets] as BetslipSelectionView[],
          date: new Date().toISOString(),
          stake: stakeValue,
        };
        setBookedTickets((prev) => [newTicket, ...prev]);
        setViewingTicketCode(createdCode);
        setSidebarTab('mybets');
      }
      clearBetSlip();
      setValue('stake', normalizedInitialStake);
    } catch (requestError) {
      if (requestError instanceof AxiosError) {
        const payload = requestError.response?.data as
          | { error?: { message?: string }; reason?: string; message?: string }
          | undefined;
        setError(
          payload?.error?.message ||
            payload?.reason ||
            payload?.message ||
            'Failed to place bet',
        );
      } else {
        setError('Failed to place bet');
      }
    } finally {
      setIsPlacing(false);
    }
  };

  const copyBookCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      // Optional: Add a small toast or temporary state for success feedback
    } catch {
      setError('Failed to copy code');
    }
  };

  const shareTicket = async (code: string) => {
    const shareUrl = `${window.location.origin}/play/betslip?share=${encodeURIComponent(code)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Sportsbook Selections',
          text: `Check out my bet selections! Use code: ${code}`,
          url: shareUrl,
        });
      } catch (err) {
        // user cancelled or share failed, fallback to copy
        void copyBookCode(code);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        // feedback for copy
      } catch {
        setError('Failed to copy share link');
      }
    }
  };

  if (!isOpen) return null;

  const activeTicket = bookedTickets.find(t => t.code === viewingTicketCode);

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-l border-border-subtle bg-element-bg text-text-contrast',
        className,
      )}
    >
      {/* Top Sidebar Navigation */}
      {!viewingTicketCode && (
        <div className="flex border-b border-border-subtle bg-app-bg">
          <button
            data-testid="betslip-tab-slip"
            onClick={() => setSidebarTab('slip')}
            className={cn(
              'flex-1 py-3 text-[13px] font-semibold transition-all',
              sidebarTab === 'slip'
                ? 'border-t-2 border-accent-solid bg-element-bg text-accent-solid'
                : 'text-text-muted hover:text-text-contrast'
            )}
          >
            Bet Slip ({bets.length})
          </button>
          <button
            data-testid="betslip-tab-mybets"
            onClick={() => setSidebarTab('mybets')}
            className={cn(
              'flex-1 py-3 text-[13px] font-semibold transition-all',
              sidebarTab === 'mybets'
                ? 'border-t-2 border-accent-solid bg-element-bg text-accent-solid'
                : 'text-text-muted hover:text-text-contrast'
            )}
          >
            My Bets
          </button>
          {onClose && (
            <AriaButton
              onPress={onClose}
              className="flex items-center justify-center px-4 text-text-muted hover:text-text-contrast"
            >
              <X size={18} />
            </AriaButton>
          )}
        </div>
      )}

      {sidebarTab === 'slip' ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as BetMode)}>
            <TabList aria-label="Bet type" className="flex border-b border-border-subtle bg-app-bg">
              <Tab
                id="multiple"
                className="flex flex-1 cursor-pointer items-center justify-center border-b-2 border-transparent py-4 text-[13px] font-semibold text-text-muted outline-none transition-all hover:text-text-contrast data-[selected]:border-accent-solid data-[selected]:text-accent-solid"
              >
                Multiple
              </Tab>
              <Tab
                id="system"
                className="flex flex-1 cursor-pointer items-center justify-center border-b-2 border-transparent py-4 text-[13px] font-semibold text-text-muted outline-none transition-all hover:text-text-contrast data-[selected]:border-accent-solid data-[selected]:text-accent-solid"
              >
                System
              </Tab>
              <Tab
                id="single"
                className="flex flex-1 cursor-pointer items-center justify-center border-b-2 border-transparent py-4 text-[13px] font-semibold text-text-muted outline-none transition-all hover:text-text-contrast data-[selected]:border-accent-solid data-[selected]:text-accent-solid"
              >
                Single
              </Tab>
            </TabList>
          </Tabs>

          <div className="flex-1 overflow-y-auto bg-app-bg">
            {bets.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-text-muted">
                <div className="rounded-full bg-element-hover-bg p-5 text-accent-solid/30">
                  <Ticket size={48} />
                </div>
                <p className="text-base font-semibold text-text-contrast">Betslip is empty</p>
                <p className="text-sm font-medium">Add selections to start betting</p>
              </div>
            ) : activeTab === 'system' && bets.length < 3 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-text-muted">
                <div className="rounded-full bg-element-hover-bg p-5 text-accent-solid/30">
                  <Ticket size={48} />
                </div>
                <p className="text-base font-semibold text-text-contrast">System Bet</p>
                <p className="text-sm font-medium leading-relaxed">
                  Add at least <span className="text-accent-solid">3 selections</span> to activate System mode.
                </p>
                <Button variant="outline" onPress={() => setSidebarTab('slip')} className="px-6 py-2 text-xs font-semibold">
                  Find Matches
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3">
                {bets.map((bet) => (
                  <div
                    key={bet.id}
                    data-testid="betslip-selection-row"
                    className="flex flex-col gap-1.5 rounded border border-border-subtle bg-element-bg p-3.5 shadow-sm transition hover:bg-element-hover-bg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="truncate text-sm font-semibold text-accent-solid">
                          {bet.selectionName} <span className="text-text-muted/60">|</span> {bet.marketName}
                        </div>
                        <div className="truncate text-[13px] font-semibold text-text-contrast">
                          {bet.fixtureName.replace(' vs ', ' - ')}
                        </div>
                        <div className="text-[11px] font-semibold text-text-muted">
                          {formatFixtureTime(bet.fixtureDate || '')}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-[17px] font-black text-text-contrast">
                          {bet.odds.toFixed(2)}
                        </span>
                        <AriaButton
                          onPress={() => removeFromBetSlip(bet.id)}
                          className="text-text-muted transition-colors hover:text-text-contrast"
                        >
                          <X size={18} />
                        </AriaButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {((activeTab === 'single' && bets.length > 0) ||
            (activeTab === 'multiple' && bets.length > 0) ||
            (activeTab === 'system' && bets.length >= 3)) && (
              <div className="flex flex-col gap-4 border-t border-border-subtle bg-element-bg p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-text-muted">Total Stake</span>
                  <div className="flex items-center gap-2 rounded border border-border-subtle bg-app-bg p-1.5">
                    <button
                      type="button"
                      onClick={() => updateStake(stake - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded bg-element-hover-bg text-accent-solid transition-all hover:opacity-90 active:scale-90"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={stake}
                      onChange={(e) => updateStake(Number(e.target.value))}
                      className="w-16 bg-transparent text-center text-base font-black text-text-contrast outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                    />
                    <button
                      type="button"
                      onClick={() => updateStake(stake + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded bg-element-hover-bg text-accent-solid transition-all hover:opacity-90 active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                    {QUICK_STAKE_OPTIONS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => updateStake(amount)}
                        className={cn(
                          'flex-1 rounded border px-2 py-2 text-xs font-semibold transition-all',
                          stake === amount
                            ? 'border-accent-solid bg-accent-solid text-accent-text-contrast'
                            : 'border-border-subtle bg-app-bg text-text-muted hover:bg-element-hover-bg hover:text-text-contrast',
                        )}
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                </div>

                {activeTab === 'system' && bets.length >= 3 && (
                  <div>
                    <Select
                      selectedKey={String(systemSize)}
                      onSelectionChange={(key) => setSystemSize(Number(key))}
                    >
                      <AriaButton className="flex w-full items-center justify-between rounded border border-border-subtle bg-app-bg px-3 py-3 text-xs font-medium text-text-muted transition-all hover:bg-element-hover-bg hover:text-text-contrast">
                        <SelectValue />
                        <span aria-hidden>▾</span>
                      </AriaButton>
                      <Popover className="w-(--trigger-width) rounded border border-border-subtle bg-element-bg p-1 shadow-2xl">
                        <ListBox className="outline-none">
                          {Array.from({ length: bets.length - 1 }, (_, i) => i + 2).map((size) => (
                            <ListBoxItem
                              id={String(size)}
                              key={size}
                              textValue={`${size}/${bets.length}`}
                              className="cursor-pointer rounded px-3 py-3 text-xs font-medium text-text-muted outline-none transition data-[focused]:bg-accent-solid data-[focused]:text-accent-text-contrast"
                            >
                              {size}/{bets.length} System
                            </ListBoxItem>
                          ))}
                        </ListBox>
                      </Popover>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col gap-3 border-b border-border-subtle pb-4">
                  {(activeTab === 'multiple' || activeTab === 'system') && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted">Total Odds</span>
                      <span className="text-base font-black text-text-contrast">
                        {activeTab === 'multiple'
                          ? preview.lines[0]?.combinedOdds.toFixed(2)
                          : (preview.totalPotentialReturn / (preview.totalStake || 1)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {preview.lineCount > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted">Lines</span>
                      <span className="text-sm font-black text-text-contrast">
                        {preview.lineCount} × {formatCurrency(preview.totalStake / preview.lineCount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-muted">Possible Payout</span>
                    <span className="text-xl font-black tracking-tight text-accent-solid">
                      {formatCurrency(preview.totalPotentialReturn)}
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="rounded border border-border-subtle bg-element-hover-bg p-2 text-xs font-semibold text-text-contrast">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 py-4 text-xs font-semibold"
                    onPress={clearBetSlip}
                    isDisabled={isPlacing}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="solid"
                    data-testid="betslip-primary-action"
                    className="flex-[2] py-4 text-sm font-semibold"
                    onPress={() => {
                      void placeSlip(primaryChannel);
                    }}
                    isDisabled={isPlacing || Boolean(preview.error) || stake <= 0}
                  >
                    {isPlacing ? 'Working...' : primaryActionLabel}
                  </Button>
                </div>
              </div>
            )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto bg-app-bg">
          {activeTicket ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex flex-col gap-4 bg-element-bg p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setViewingTicketCode(null)}
                    className="rounded p-1 text-text-muted transition-colors hover:text-text-contrast"
                  >
                    <ChevronLeft size={26} strokeWidth={2.5} />
                  </button>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="rounded-sm bg-accent-solid/20 p-1 text-accent-solid">
                        <Ticket size={16} strokeWidth={3} />
                      </div>
                      <span className="text-lg font-semibold text-text-contrast">Booked Bet</span>
                    </div>
                    <span className="text-[12px] font-medium text-text-muted">
                      {new Date(activeTicket.date).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border-subtle" />

                <div className="flex flex-wrap gap-3">
                  <div className="flex min-w-[130px] flex-1 flex-col gap-1 rounded border border-border-subtle bg-app-bg p-3 text-xs">
                    <span className="font-medium text-text-muted">Type</span>
                    <span className="font-semibold text-text-contrast">
                      {activeTicket.bets.length > 1 ? `${activeTicket.bets.length} Fold` : 'Single'}
                    </span>
                  </div>
                  <div className="flex min-w-[130px] flex-1 flex-col gap-1 rounded border border-border-subtle bg-app-bg p-3 text-xs">
                    <span className="font-medium text-text-muted">Stake</span>
                    <span className="font-semibold text-accent-solid">{formatCurrency(activeTicket.stake)}</span>
                  </div>
                  <div className="flex min-w-[130px] flex-1 flex-col gap-1 rounded border border-border-subtle bg-app-bg p-3 text-xs">
                    <span className="font-medium text-text-muted">Status</span>
                    <span className="font-semibold text-text-contrast">Unpaid</span>
                  </div>
                  <div className="flex min-w-[130px] flex-1 flex-col gap-1 rounded border border-border-subtle bg-app-bg p-3 text-xs">
                    <span className="font-medium text-text-muted">Total Odds</span>
                    <span className="font-semibold text-text-contrast">
                      {activeTicket.bets.reduce((acc, b) => acc * b.odds, 1).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border-subtle" />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-text-muted">Bet Entries</p>
                  </div>
                  {activeTicket.bets.map((bet) => (
                    <div key={bet.id} className="flex items-center justify-between gap-4 rounded border border-border-subtle bg-app-bg p-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-sm font-semibold text-accent-solid">{bet.selectionName} | {bet.marketName}</p>
                        <p className="truncate text-[13px] font-semibold text-text-contrast">{bet.fixtureName}</p>
                      </div>
                      <p className="tabular-nums text-[16px] font-black text-text-contrast">{bet.odds.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-border-subtle" />

                <div className="flex items-center justify-center gap-2 rounded border border-border-subtle bg-app-bg p-3 text-sm">
                  <p className="font-semibold text-text-muted">Book A Bet Code:</p>
                  <p className="font-black tracking-tight text-accent-solid">{activeTicket.code}</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onPress={() => void copyBookCode(activeTicket.code)}
                    className="flex flex-1 items-center justify-center gap-2 py-3 text-[13px] font-semibold"
                  >
                    <Copy size={16} strokeWidth={3} />
                    Copy Code
                  </Button>
                  <Button
                    variant="solid"
                    onPress={() => void shareTicket(activeTicket.code)}
                    className="flex flex-1 items-center justify-center gap-2 py-3 text-[13px] font-semibold"
                  >
                    <Share2 size={16} strokeWidth={3} />
                    Share
                  </Button>
                </div>

                <Button variant="outline" onPress={() => setViewingTicketCode(null)} className="w-full py-3 text-xs font-semibold">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              <h3 className="px-1 text-xs font-semibold text-text-muted">Recent Activity</h3>

              {/* Wallet Bets List */}
              {isAuthenticated && userBets && userBets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="px-1 text-[10px] font-semibold text-text-muted">Wallet Bets</p>
                  {userBets.map(bet => (
                    <div key={bet.id} className="flex items-center justify-between gap-3 rounded border border-border-subtle bg-element-bg p-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-semibold text-text-contrast">{bet.betRef.slice(0, 10)}...</p>
                        <p className="text-[10px] text-text-muted">{new Date(bet.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-xs font-black text-accent-solid">{formatCurrency(Number(bet.stake))}</p>
                        <span className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                          bet.status === 'won'
                            ? 'bg-accent-solid/20 text-accent-solid'
                            : 'bg-element-hover-bg text-text-muted',
                        )}>{bet.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Booked Tickets List */}
              {bookedTickets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="px-1 text-[10px] font-semibold text-text-muted">Booked Tickets</p>
                  {bookedTickets.map(ticket => (
                    <button
                      key={ticket.code}
                      onClick={() => setViewingTicketCode(ticket.code)}
                      className="flex w-full items-center justify-between gap-3 rounded border border-border-subtle bg-element-bg p-3 text-left transition-all hover:border-accent-solid"
                    >
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-black text-accent-solid">{ticket.code}</p>
                        <p className="text-[10px] text-text-muted">{new Date(ticket.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-xs font-black text-accent-solid">{formatCurrency(ticket.stake)}</p>
                        <p className="text-[10px] text-text-muted">{ticket.bets.length} Selections</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(!bookedTickets.length && (!userBets || !userBets.length)) && (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <FileText size={48} className="text-text-muted" />
                  <p className="text-sm font-semibold text-text-muted">No bets found</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Wallet Success Dialog */}
      <ModalOverlay isOpen={showWalletDialog} onOpenChange={setShowWalletDialog} className="fixed inset-0 z-50 flex items-center justify-center bg-app-bg/80 p-4 backdrop-blur-sm">
        <Modal className="animate-in fade-in zoom-in-95 duration-200 w-full max-w-sm rounded-lg border border-border-subtle bg-element-bg p-6 shadow-2xl">
          <Dialog className="flex flex-col gap-4 outline-none">
            <header>
              <Heading slot="title" className="flex items-center gap-2 text-2xl font-semibold text-accent-solid">
                <Ticket size={24} />
                Bet Placed
              </Heading>
            </header>
            <p className="text-sm font-medium leading-relaxed text-text-muted">Your wallet bet was successful. Good luck!</p>
            <div className="flex flex-col gap-2 rounded border border-border-subtle bg-app-bg p-5 text-center">
              <p className="text-[11px] font-semibold text-text-muted">Receipt ID</p>
              <p className="select-all text-xl font-black tracking-[0.2em] text-text-contrast">{walletBetRef}</p>
            </div>
            <Button variant="solid" onPress={() => setShowWalletDialog(false)} className="w-full py-4 text-sm font-semibold">
              Great!
            </Button>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </aside>
  );
}
