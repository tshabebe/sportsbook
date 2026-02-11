import { useState, useEffect } from 'react';
import { AxiosError } from 'axios';
import { X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button as AriaButton, Dialog, Modal, ModalOverlay } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBetSlip } from '../context/BetSlipContext';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { formatCurrency } from '../config/currency';
import { Button } from './ui/Button';
import { formatFixtureTime } from '../lib/date';

interface BetslipProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

const betSlipStakeSchema = z.object({
  stake: z.number().positive('Stake must be greater than 0'),
});
type BetSlipStakeForm = z.infer<typeof betSlipStakeSchema>;

export function Betslip({ isOpen = true, onClose, className }: BetslipProps) {
  const location = useLocation();
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicketIds, setCreatedTicketIds] = useState<string[]>([]);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const {
    watch,
    setValue,
    getValues,
    trigger,
  } = useForm<BetSlipStakeForm>({
    resolver: zodResolver(betSlipStakeSchema),
    defaultValues: { stake: 10 },
  });

  useEffect(() => {
    setValue('stake', 10, { shouldValidate: true });
  }, [setValue]);

  const { bets, removeFromBetSlip, clearBetSlip, toBetSlipInput } = useBetSlip();
  const variantFromPath = (() => {
    const match = location.pathname.match(/^\/play\/([1-5])$/);
    return match?.[1] ?? null;
  })();
  const stake = Number(watch('stake') ?? 10);

  const updateStake = (value: number) => {
    const normalized = Math.max(0, value);
    setValue('stake', normalized, { shouldValidate: true });
    trigger('stake');
  };

  const calculateBet = () => {
    if (bets.length === 0 || stake <= 0) {
      return { totalStake: 0, potentialWin: 0, numBets: 0 };
    }

    const stakePerBet = stake / bets.length;
    const potentialWin = bets.reduce((acc, bet) => acc + stakePerBet * bet.odds, 0);
    return { totalStake: stake, potentialWin, numBets: bets.length };
  };

  const calculation = calculateBet();

  const handlePlaceBet = async () => {
    const valid = await trigger('stake');
    if (!valid || bets.length === 0) return;

    const stakeValue = getValues('stake');
    if (!stakeValue || stakeValue <= 0) return;

    setIsPlacing(true);
    setError(null);
    setCreatedTicketIds([]);

    try {
      const validatePayload = toBetSlipInput(stakeValue, 'single');
      const validateRes = await api.post('/betslip/validate', validatePayload);

      if (!validateRes.data.ok) {
        setError(validateRes.data.results?.[0]?.error || 'Validation failed');
        return;
      }

      const placeRes = await api.post('/tickets', validatePayload);

      if (!placeRes.data.ok) {
        setError(placeRes.data.error?.message || 'Failed to place bet');
        return;
      }

      const ticketIds = Array.isArray(placeRes.data?.tickets)
        ? placeRes.data.tickets.map((ticket: { ticketId: string }) => ticket.ticketId)
        : [];

      setCreatedTicketIds(ticketIds);
      setShowTicketDialog(ticketIds.length > 0);
      clearBetSlip();
      setValue('stake', 10);
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.error?.message || 'Failed to place bet');
      } else {
        setError('Failed to place bet');
      }
    } finally {
      setIsPlacing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className={cn('flex h-full w-full flex-col border-l border-border-subtle bg-element-bg', className)}>
      <div className="flex items-center justify-between border-b border-border-subtle bg-element-bg px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-contrast">
          Bet Slip
          <span className="rounded-full bg-accent-solid px-2 py-0.5 text-xs text-[#1d1d1d]">{bets.length}</span>
        </h2>
        {onClose ? (
          <AriaButton onPress={onClose} className="text-text-muted transition-colors hover:text-text-contrast">
            <X size={20} />
          </AriaButton>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {bets.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-text-muted">
            Add selections to your bet slip to get started
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            {bets.map((bet) => (
              <div key={bet.id} className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-element-hover-bg/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text-contrast">
                      {bet.selectionName} <span className="text-text-muted">|</span> {bet.marketName}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-text-contrast">{bet.fixtureName.replace(' vs ', ' - ')}</div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {bet.fixtureId}
                      {bet.leagueCountry ? ` | ${bet.leagueCountry}` : ''}
                      {bet.leagueName ? ` | ${bet.leagueName}` : ''}
                    </div>
                    {bet.fixtureDate ? (
                      <div className="mt-0.5 text-xs text-text-muted">{formatFixtureTime(bet.fixtureDate)}</div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-contrast">{bet.odds.toFixed(2)}</span>
                    <AriaButton onPress={() => removeFromBetSlip(bet.id)} className="text-text-muted transition-colors hover:text-text-contrast">
                      <X size={16} />
                    </AriaButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {bets.length > 0 ? (
        <div className="border-t border-border-subtle bg-element-bg p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Stake Per Bet</span>
            <div className="flex items-center gap-2 rounded border border-border-subtle bg-[#101010] px-3 py-1 text-sm">
              <AriaButton
                onPress={() => updateStake(stake - 1)}
                className="h-6 w-6 rounded bg-[#1c1c1c] text-text-muted transition hover:bg-[#272727]"
              >
                −
              </AriaButton>
              <span className="min-w-[40px] text-center font-semibold text-text-contrast">{stake.toFixed(0)}</span>
              <AriaButton
                onPress={() => updateStake(stake + 1)}
                className="h-6 w-6 rounded bg-[#1c1c1c] text-text-muted transition hover:bg-[#272727]"
              >
                +
              </AriaButton>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[10, 25, 50, 100].map((amount) => {
              const isActive = stake === amount;
              return (
                <AriaButton
                  key={amount}
                  onPress={() => updateStake(amount)}
                  className={`flex-1 rounded py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-accent-solid text-[#1d1d1d]'
                      : 'bg-element-hover-bg text-text-muted hover:bg-accent-solid hover:text-[#1d1d1d]'
                  }`}
                >
                  {formatCurrency(amount)}
                </AriaButton>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-text-muted">Total Stake</span>
            <span className="text-text-contrast font-semibold">{formatCurrency(calculation.totalStake)}</span>
          </div>
          <div className="my-2 h-px bg-[#2a2a2a]" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Possible Returns</span>
            <span className="text-accent-solid font-semibold">{formatCurrency(calculation.potentialWin)}</span>
          </div>

          {error ? <div className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-500">{error}</div> : null}

          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="solid"
              className="h-12 rounded bg-[#31ae2f] text-sm font-semibold text-[#041207] hover:bg-[#2a9829]"
              onPress={handlePlaceBet}
              isDisabled={stake <= 0 || isPlacing}
            >
              {isPlacing ? 'Accepting...' : 'Accept Odds'}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 rounded border border-border-subtle text-sm text-text-contrast" onPress={handlePlaceBet}>
                Book a Bet
              </Button>
              <Button
                variant="ghost"
                className="flex-1 rounded border border-red-500 text-sm text-red-500 hover:bg-red-500/10"
                onPress={clearBetSlip}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ModalOverlay
        isOpen={showTicketDialog}
        onOpenChange={setShowTicketDialog}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 data-[entering]:animate-in data-[entering]:fade-in data-[exiting]:animate-out data-[exiting]:fade-out"
      >
        <Modal className="w-full max-w-md rounded-lg border border-border-subtle bg-element-bg p-4 shadow-xl outline-none data-[entering]:animate-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:zoom-out-95">
          <Dialog className="outline-none">
            <h3 className="mb-2 text-lg font-semibold text-text-contrast">Ticket Created</h3>
            <p className="mb-3 text-sm text-text-muted">Save or track your ticket IDs.</p>
            <div className="mb-4 space-y-2 rounded bg-green-500/10 p-2 text-xs text-green-500">
              {createdTicketIds.map((ticketId) => (
                <div key={ticketId} className="flex items-center justify-between gap-2">
                  <span className="font-mono">{ticketId}</span>
                  <Link
                    className="underline"
                    to={`/play/track?ticket=${encodeURIComponent(ticketId)}${variantFromPath ? `&v=${variantFromPath}` : ''}`}
                  >
                    track
                  </Link>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onPress={() => setShowTicketDialog(false)} size="sm">
                Close
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </aside>
  );
}
