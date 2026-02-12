import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { X, Ticket, Copy, Share2, FileText, ChevronLeft, Info } from 'lucide-react';
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
type ValidationResult = {
  ok?: boolean;
  error?: string | { message?: string };
};

const getResultErrorMessage = (results: ValidationResult[] | undefined): string => {
  if (!results || results.length === 0) return 'Validation failed';
  const first = results.find((result) => !result?.ok) ?? results[0];
  if (typeof first?.error === 'string') return first.error;
  if (typeof first?.error?.message === 'string') return first.error.message;
  return 'Validation failed';
};

export function Betslip({ isOpen = true, onClose, className, initialStake = 1 }: BetslipProps) {
  const [sidebarTab, setSidebarTab] = useState<'slip' | 'mybets'>('slip');
  const [activeTab, setActiveTab] = useState<BetMode>('single');
  const [systemSize, setSystemSize] = useState<number>(2);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBetRef, setWalletBetRef] = useState<string | null>(null);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [viewingTicketCode, setViewingTicketCode] = useState<string | null>(null);
  const [bookedTickets, setBookedTickets] = useState<Array<{ code: string; bets: any[]; date: string; stake: number }>>(() => {
    const saved = localStorage.getItem('booked_tickets');
    return saved ? JSON.parse(saved) : [];
  });

  const { data: userBets, refetch: refetchMyBets } = useMyBets();

  useEffect(() => {
    localStorage.setItem('booked_tickets', JSON.stringify(bookedTickets));
  }, [bookedTickets]);

  useWalletProfile();
  const isAuthenticated = Boolean(getAuthToken());
  const primaryChannel: PlaceChannel = isAuthenticated ? 'wallet' : 'retail';
  const primaryActionLabel = isAuthenticated ? 'Place Bet' : 'Book a Bet';
  const normalizedInitialStake =
    Number.isFinite(initialStake) && initialStake > 0 ? initialStake : 1;

  const { watch, setValue, getValues, trigger } = useForm<BetSlipStakeForm>({
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

  const updateStake = (value: number) => {
    const normalized = Math.max(0, value);
    setValue('stake', normalized, { shouldValidate: true });
    trigger('stake');
  };

  const preview = calculateBetSlipPreview({
    mode: activeTab,
    stake,
    selections: bets.map((bet) => ({ odd: bet.odds })),
    systemSize: activeTab === 'system' ? systemSize : undefined,
  });

  const placeSlip = async (channel: PlaceChannel) => {
    const valid = await trigger('stake');
    if (!valid || bets.length === 0) return;

    const stakeValue = getValues('stake');
    if (!stakeValue || stakeValue <= 0) return;

    if (preview.error) {
      setError(preview.error);
      return;
    }

    setIsPlacing(true);
    setError(null);
    setWalletBetRef(null);
    setShowWalletDialog(false);
    setViewingTicketCode(null);

    try {
      const payload = toBetSlipInput(
        stakeValue,
        activeTab,
        activeTab === 'system' ? systemSize : undefined,
      );

      const validateRes = await api.post('/betslip/validate', payload);
      if (!validateRes.data.ok) {
        setError(getResultErrorMessage(validateRes.data.results));
        return;
      }

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
          bets: [...bets],
          date: new Date().toISOString(),
          stake: stakeValue
        };
        setBookedTickets(prev => [newTicket, ...prev]);
        setViewingTicketCode(createdCode);
        setSidebarTab('mybets');
      }
      clearBetSlip();
      setValue('stake', normalizedInitialStake);
    } catch (requestError) {
      if (requestError instanceof AxiosError) {
        setError(requestError.response?.data?.error?.message || 'Failed to place bet');
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
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${code}`;
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
        'flex h-full w-full flex-col border-l border-[#333] bg-[#1a1a1a] text-white',
        className,
      )}
    >
      {/* Top Sidebar Navigation */}
      {!viewingTicketCode && (
        <div className="flex border-b border-[#333] bg-[#0c0c0c]">
          <button
            onClick={() => setSidebarTab('slip')}
            className={cn(
              "flex-1 py-3 text-[13px] font-black uppercase tracking-wider transition-all",
              sidebarTab === 'slip'
                ? "bg-[#1a1a1a] text-[#ffd60a] border-t-2 border-[#ffd60a]"
                : "text-[#8a8a8a] hover:text-white"
            )}
          >
            Bet Slip ({bets.length})
          </button>
          <button
            onClick={() => setSidebarTab('mybets')}
            className={cn(
              "flex-1 py-3 text-[13px] font-black uppercase tracking-wider transition-all",
              sidebarTab === 'mybets'
                ? "bg-[#1a1a1a] text-[#ffd60a] border-t-2 border-[#ffd60a]"
                : "text-[#8a8a8a] hover:text-white"
            )}
          >
            My Bets
          </button>
          {onClose && (
            <AriaButton
              onPress={onClose}
              className="flex items-center justify-center px-4 text-[#8a8a8a] hover:text-white"
            >
              <X size={18} />
            </AriaButton>
          )}
        </div>
      )}

      {sidebarTab === 'slip' ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as BetMode)}>
            <TabList aria-label="Bet type" className="grid grid-cols-3 border-b border-[#333] bg-[#121212]">
              <Tab
                id="single"
                className="flex cursor-pointer items-center justify-center border-b-2 border-transparent py-4 text-[13px] font-black uppercase text-[#8a8a8a] outline-none transition-all hover:text-[#e0e0e0] data-[selected]:border-[#ffd60a] data-[selected]:text-[#ffd60a]"
              >
                Single
              </Tab>
              <Tab
                id="multiple"
                className="flex cursor-pointer items-center justify-center border-b-2 border-transparent py-4 text-[13px] font-black uppercase text-[#8a8a8a] outline-none transition-all hover:text-[#e0e0e0] data-[selected]:border-[#ffd60a] data-[selected]:text-[#ffd60a]"
              >
                Multiple
              </Tab>
              <Tab
                id="system"
                className="flex cursor-pointer items-center justify-center border-b-2 border-transparent py-4 text-[13px] font-black uppercase text-[#8a8a8a] outline-none transition-all hover:text-[#e0e0e0] data-[selected]:border-[#ffd60a] data-[selected]:text-[#ffd60a]"
              >
                System
              </Tab>
            </TabList>
          </Tabs>

          <div className="flex-1 overflow-y-auto bg-[#1a1a1a]">
            {bets.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[#8a8a8a]">
                <div className="mb-4 rounded-full bg-[#2a2a2a] p-5 text-[#ffd60a]/20">
                  <Ticket size={48} />
                </div>
                <p className="text-base font-black text-white uppercase tracking-widest">Betslip is empty</p>
                <p className="mt-2 text-sm font-medium">Add selections to start betting</p>
              </div>
            ) : activeTab === 'multiple' && bets.length < 2 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[#8a8a8a]">
                <div className="mb-4 rounded-full bg-[#2a2a2a] p-5 text-[#ffd60a]/20">
                  <Ticket size={48} />
                </div>
                <p className="text-base font-black text-white uppercase tracking-widest">Multiple Bet</p>
                <p className="mt-2 text-sm font-medium leading-relaxed">Add at least <span className="text-[#ffd60a]">2 selections</span> to activate Multiple mode.</p>
                <Button variant="outline" onPress={() => setSidebarTab('slip')} className="mt-6 border-[#333] text-xs font-black uppercase tracking-widest px-6 py-2 rounded">Find Matches</Button>
              </div>
            ) : activeTab === 'system' && bets.length < 3 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[#8a8a8a]">
                <div className="mb-4 rounded-full bg-[#2a2a2a] p-5 text-[#ffd60a]/20">
                  <Ticket size={48} />
                </div>
                <p className="text-base font-black text-white uppercase tracking-widest">System Bet</p>
                <p className="mt-2 text-sm font-medium leading-relaxed">Add at least <span className="text-[#ffd60a]">3 selections</span> to activate System mode.</p>
                <Button variant="outline" onPress={() => setSidebarTab('slip')} className="mt-6 border-[#333] text-xs font-black uppercase tracking-widest px-6 py-2 rounded">Find Matches</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3">
                {bets.map((bet) => (
                  <div
                    key={bet.id}
                    className="flex flex-col gap-1.5 rounded bg-[#242424] border border-[#333] p-3.5 shadow-sm transition-all hover:border-[#444]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[#ffd60a] uppercase tracking-tighter">
                          {bet.selectionName} <span className="text-white/40">|</span> {bet.marketName}
                        </div>
                        <div className="mt-1.5 truncate text-[13px] font-bold text-white uppercase tracking-tighter">
                          {bet.fixtureName.replace(' vs ', ' - ')}
                        </div>
                        <div className="mt-1 text-[11px] text-[#8a8a8a] font-bold">
                          {formatFixtureTime(bet.fixtureDate || '')}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[17px] font-black text-white tabular-nums">
                          {bet.odds.toFixed(2)}
                        </span>
                        <AriaButton
                          onPress={() => removeFromBetSlip(bet.id)}
                          className="text-[#8a8a8a] transition-colors hover:text-white"
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
            (activeTab === 'multiple' && bets.length >= 2) ||
            (activeTab === 'system' && bets.length >= 3)) && (
              <div className="border-t border-[#333] bg-[#121212] p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-[#8a8a8a]">
                    Total Stake
                  </span>
                  <div className="flex items-center gap-2 rounded bg-[#000] border border-[#333] p-1.5">
                    <button
                      type="button"
                      onClick={() => updateStake(stake - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded bg-[#1a1a1a] text-[#ffd60a] transition-all hover:bg-[#2a2a2a] active:scale-90"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={stake}
                      onChange={(e) => updateStake(Number(e.target.value))}
                      className="w-16 bg-transparent text-center text-base font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                    />
                    <button
                      type="button"
                      onClick={() => updateStake(stake + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded bg-[#1a1a1a] text-[#ffd60a] transition-all hover:bg-[#2a2a2a] active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>

                {activeTab === 'system' && bets.length >= 3 && (
                  <div className="mb-4">
                    <Select
                      selectedKey={String(systemSize)}
                      onSelectionChange={(key) => setSystemSize(Number(key))}
                    >
                      <AriaButton className="flex w-full items-center justify-between rounded bg-[#000] border border-[#333] px-3 py-3 text-xs font-black uppercase tracking-widest text-[#8a8a8a] transition-all hover:border-[#444]">
                        <SelectValue />
                        <span aria-hidden>▾</span>
                      </AriaButton>
                      <Popover className="w-(--trigger-width) rounded bg-[#1a1a1a] border border-[#333] p-1 shadow-2xl">
                        <ListBox className="outline-none">
                          {Array.from({ length: bets.length - 1 }, (_, i) => i + 2).map((size) => (
                            <ListBoxItem
                              id={String(size)}
                              key={size}
                              textValue={`${size}/${bets.length}`}
                              className="cursor-pointer rounded px-3 py-3 text-xs font-black uppercase outline-none transition data-[focused]:bg-[#ffd60a] data-[focused]:text-black"
                            >
                              {size}/{bets.length} System
                            </ListBoxItem>
                          ))}
                        </ListBox>
                      </Popover>
                    </Select>
                  </div>
                )}

                <div className="space-y-3 mb-4 border-b border-[#333] pb-4">
                  {(activeTab === 'multiple' || activeTab === 'system') && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-[#8a8a8a]">Total Odds</span>
                      <span className="font-black text-white text-base">
                        {activeTab === 'multiple'
                          ? preview.lines[0]?.combinedOdds.toFixed(2)
                          : (preview.totalPotentialReturn / (preview.totalStake || 1)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {preview.lineCount > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-[#8a8a8a]">Lines</span>
                      <span className="font-black text-white text-sm">
                        {preview.lineCount} × {formatCurrency(preview.totalStake / preview.lineCount)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-[#8a8a8a]">Possible Payout</span>
                    <span className="font-black text-[#ffd60a] text-xl tracking-tight">
                      {formatCurrency(preview.totalPotentialReturn)}
                    </span>
                  </div>
                </div>

                {error && <div className="mb-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-xs font-black text-red-500">{error}</div>}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded border border-[#333] bg-transparent text-xs font-black uppercase tracking-widest text-[#8a8a8a] hover:bg-[#1a1a1a] hover:text-white"
                    onPress={clearBetSlip}
                    isDisabled={isPlacing}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="solid"
                    className="flex-[2] rounded bg-[#31ae2f] text-sm font-black uppercase tracking-widest text-black hover:bg-[#2a9829] shadow-[0_4px_15px_rgba(49,174,47,0.3)] transition-all active:scale-95 py-4"
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
        <div className="flex-1 flex flex-col overflow-y-auto">
          {activeTicket ? (
            <div className="flex flex-col p-4 animate-in fade-in slide-in-from-right-4 duration-500 bg-[#1a1a1a]">
              <div className="flex items-start gap-4 mb-4">
                <button onClick={() => setViewingTicketCode(null)} className="mt-1 text-[#8a8a8a] hover:text-white transition-colors p-1 -ml-2"><ChevronLeft size={26} strokeWidth={2.5} /></button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="bg-[#ffd60a] p-1 rounded-sm text-black"><Ticket size={16} strokeWidth={3} /></div>
                    <span className="font-black text-lg uppercase tracking-tight italic">Book A Bet</span>
                  </div>
                  <span className="text-[12px] font-bold text-[#8a8a8a] mt-0.5">{new Date(activeTicket.date).toLocaleString()}</span>
                </div>
              </div>
              <hr className="border-[#333] mb-4" />
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-5">
                <div className="flex flex-col"><span className="text-[12px] font-black text-[#8a8a8a] uppercase tracking-wider">Type: <span className="text-white normal-case ml-1">{activeTicket.bets.length > 1 ? `${activeTicket.bets.length} Fold` : 'Single'}</span></span></div>
                <div className="flex flex-col text-right"><span className="text-[12px] font-black text-[#8a8a8a] uppercase tracking-wider">Stake: <span className="text-[#31ae2f] ml-1">{formatCurrency(activeTicket.stake)}</span></span></div>
                <div className="flex items-center gap-1.5 text-right"><span className="text-[12px] font-black text-[#8a8a8a] uppercase tracking-wider">Status: <span className="text-[#ffd60a] ml-1">UNPAID</span></span></div>
                <div className="flex flex-col text-right"><span className="text-[12px] font-black text-[#8a8a8a] uppercase tracking-wider">Total Odds: <span className="text-white ml-1">{activeTicket.bets.reduce((acc, b) => acc * b.odds, 1).toFixed(2)}</span></span></div>
              </div>
              <hr className="border-[#333] mb-5" />
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between border-b border-[#333] pb-1"><p className="text-[10px] text-[#8a8a8a] uppercase font-bold tracking-wider">Bet Entries</p><p className="text-[10px] text-[#8a8a8a] uppercase font-bold tracking-wider">Odds</p></div>
                {activeTicket.bets.map((bet) => (
                  <div key={bet.id} className="flex justify-between items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-black text-[#ffd60a] uppercase tracking-tighter leading-tight">{bet.selectionName} | {bet.marketName}</p>
                      <p className="text-[13px] font-bold text-white mt-1 uppercase tracking-tighter truncate">{bet.fixtureName}</p>
                    </div>
                    <p className="text-[16px] font-black text-white tabular-nums">{bet.odds.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <hr className="border-[#333] mb-6" />
              <div className="flex items-center justify-center gap-4 mb-8">
                <p className="text-lg font-black text-white">Book A Bet Code:</p>
                <p className="text-lg font-black text-[#3be631] tracking-tight">{activeTicket.code}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Button onPress={() => void copyBookCode(activeTicket.code)} className="bg-[#76e053] hover:bg-[#68c749] text-black border-none flex items-center justify-center gap-2 text-[13px] font-black py-3.5 rounded-lg active:scale-95"><Copy size={16} strokeWidth={3} />Copy Code</Button>
                <Button
                  variant="solid"
                  onPress={() => void shareTicket(activeTicket.code)}
                  className="bg-[#ffd60a] hover:bg-[#e6c109] text-black border-none flex items-center justify-center gap-2 text-[13px] font-black py-3.5 rounded-lg active:scale-95"
                >
                  <Share2 size={16} strokeWidth={3} />
                  Share
                </Button>
              </div>
              <Button onPress={() => setViewingTicketCode(null)} className="w-full bg-[#3a3a3a] text-white border-none py-3.5 font-black uppercase tracking-widest text-xs rounded-lg">Close</Button>
            </div>
          ) : (
            <div className="flex flex-col p-4 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#8a8a8a] mb-2 px-1">Recent Activity</h3>

              {/* Wallet Bets List */}
              {isAuthenticated && userBets && userBets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-white/40 uppercase ml-1">Wallet Bets</p>
                  {userBets.map(bet => (
                    <div key={bet.id} className="bg-[#242424] border border-[#333] rounded p-3 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-black text-white">{bet.betRef.slice(0, 10)}...</p>
                        <p className="text-[10px] text-[#8a8a8a]">{new Date(bet.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-[#ffd60a]">{formatCurrency(Number(bet.stake))}</p>
                        <span className={cn(
                          "text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                          bet.status === 'won' ? "bg-green-500/20 text-green-500" :
                            bet.status === 'lost' ? "bg-red-500/20 text-red-500" : "bg-[#333] text-[#8a8a8a]"
                        )}>{bet.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Booked Tickets List */}
              {bookedTickets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-white/40 uppercase ml-1">Booked Tickets</p>
                  {bookedTickets.map(ticket => (
                    <button
                      key={ticket.code}
                      onClick={() => setViewingTicketCode(ticket.code)}
                      className="w-full text-left bg-[#242424] border border-[#333] rounded p-3 flex justify-between items-center hover:border-[#ffd60a] transition-all"
                    >
                      <div>
                        <p className="text-sm font-black text-[#ffd60a]">{ticket.code}</p>
                        <p className="text-[10px] text-[#8a8a8a]">{new Date(ticket.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-[#31ae2f]">{formatCurrency(ticket.stake)}</p>
                        <p className="text-[10px] text-[#8a8a8a]">{ticket.bets.length} Selections</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(!bookedTickets.length && (!userBets || !userBets.length)) && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileText size={48} className="text-[#333] mb-4" />
                  <p className="text-sm font-black text-[#8a8a8a] uppercase">No bets found</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Wallet Success Dialog */}
      <ModalOverlay isOpen={showWalletDialog} onOpenChange={setShowWalletDialog} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <Modal className="w-full max-w-sm rounded-lg border border-[#333] bg-[#1a1a1a] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <Dialog className="outline-none">
            <header className="mb-4">
              <Heading slot="title" className="text-2xl font-black text-[#ffd60a] uppercase tracking-tighter italic flex items-center gap-2">
                <Ticket size={24} />
                Bet Placed
              </Heading>
            </header>
            <p className="mb-6 text-sm text-[#8a8a8a] font-bold leading-relaxed">Your wallet bet was successful. Good luck!</p>
            <div className="mb-8 rounded bg-[#000] p-5 border border-[#333] text-center">
              <p className="text-[11px] uppercase font-black text-[#8a8a8a] mb-2 tracking-widest">Receipt ID</p>
              <p className="font-black text-white tracking-[0.2em] text-xl select-all">{walletBetRef}</p>
            </div>
            <Button onPress={() => setShowWalletDialog(false)} className="w-full bg-[#ffd60a] text-black font-black py-4 uppercase tracking-widest rounded transition-all active:scale-95">Great!</Button>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </aside>
  );
}
