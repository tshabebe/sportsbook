import { useState } from 'react';
import { AxiosError } from 'axios';
import { Loader2, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Button as AriaButton,
  Dialog,
  Input,
  Label,
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
  TextField,
} from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBetSlip } from '../context/BetSlipContext';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

type BetType = 'single' | 'multiple' | 'system';

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 1) return arr.map((el) => [el]);
  if (k === arr.length) return [arr];
  if (k > arr.length) return [];

  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
    for (const combo of tailCombos) result.push([head, ...combo]);
  }
  return result;
}

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
  const [activeTab, setActiveTab] = useState<BetType>('single');
  const [systemSize, setSystemSize] = useState<number>(2);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicketIds, setCreatedTicketIds] = useState<string[]>([]);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const {
    register,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors: formErrors },
  } = useForm<BetSlipStakeForm>({
    resolver: zodResolver(betSlipStakeSchema),
    defaultValues: { stake: 0 },
  });

  const { bets, removeFromBetSlip, clearBetSlip, toBetSlipInput } = useBetSlip();
  const variantFromPath = (() => {
    const match = location.pathname.match(/^\/play\/([1-5])$/);
    return match?.[1] ?? null;
  })();
  const stake = Number(watch('stake') ?? 0);

  const calculateBet = () => {
    if (bets.length === 0 || stake <= 0) {
      return { totalStake: 0, potentialWin: 0, numBets: 0, combinedOdds: 1 };
    }

    if (activeTab === 'single') {
      const stakePerBet = stake / bets.length;
      const potentialWin = bets.reduce((acc, bet) => acc + stakePerBet * bet.odds, 0);
      return { totalStake: stake, potentialWin, numBets: bets.length, combinedOdds: 0 };
    }

    if (activeTab === 'multiple') {
      if (bets.length < 2) {
        return { totalStake: stake, potentialWin: 0, numBets: 0, combinedOdds: 0, error: 'Need 2+ selections' };
      }
      const combinedOdds = bets.reduce((acc, bet) => acc * bet.odds, 1);
      const potentialWin = stake * combinedOdds;
      return { totalStake: stake, potentialWin, numBets: 1, combinedOdds };
    }

    if (bets.length < 3) {
      return { totalStake: stake, potentialWin: 0, numBets: 0, combinedOdds: 0, error: 'Need 3+ selections' };
    }

    const combos = getCombinations(bets, systemSize);
    if (combos.length === 0) {
      return { totalStake: stake, potentialWin: 0, numBets: 0, combinedOdds: 0, error: 'Invalid system' };
    }

    const stakePerCombo = stake / combos.length;
    const potentialWin = combos.reduce((acc, combo) => {
      const comboOdds = combo.reduce((o, bet) => o * bet.odds, 1);
      return acc + stakePerCombo * comboOdds;
    }, 0);

    return { totalStake: stake, potentialWin, numBets: combos.length, combinedOdds: 0 };
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
      const validatePayload = toBetSlipInput(stakeValue, activeTab, activeTab === 'system' ? systemSize : undefined);
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
      setValue('stake', 0);
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

      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as BetType)}>
        <TabList aria-label="Bet type" className="flex border-b border-border-subtle">
          <Tab
            id="single"
            className="flex-1 border-b-2 border-transparent py-2 text-sm font-medium capitalize text-text-muted outline-none transition data-[selected]:border-accent-solid data-[selected]:text-text-contrast"
          >
            single
          </Tab>
          <Tab
            id="multiple"
            isDisabled={bets.length < 2}
            className="flex-1 border-b-2 border-transparent py-2 text-sm font-medium capitalize text-text-muted outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[selected]:border-accent-solid data-[selected]:text-text-contrast"
          >
            multiple
          </Tab>
          <Tab
            id="system"
            isDisabled={bets.length < 3}
            className="flex-1 border-b-2 border-transparent py-2 text-sm font-medium capitalize text-text-muted outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[selected]:border-accent-solid data-[selected]:text-text-contrast"
          >
            system
          </Tab>
        </TabList>
      </Tabs>

      <div className="flex-1 overflow-y-auto">
        {bets.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-text-muted">
            Add selections to your bet slip to get started
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-4">
            {bets.map((bet) => (
              <div key={bet.id} className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-element-hover-bg/50 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-contrast">{bet.fixtureName}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      {bet.marketName}: {bet.selectionName}
                    </div>
                  </div>
                  <AriaButton onPress={() => removeFromBetSlip(bet.id)} className="text-text-muted transition-colors hover:text-text-contrast">
                    <X size={16} />
                  </AriaButton>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-accent-solid">@ {bet.odds.toFixed(2)}</span>
                  {activeTab === 'single' ? (
                    <span className="text-xs text-text-muted">Stake: €{(stake / bets.length).toFixed(2)}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'system' && bets.length >= 3 ? (
        <div className="border-t border-border-subtle px-4 py-2">
          <Select selectedKey={String(systemSize)} onSelectionChange={(key) => setSystemSize(Number(key))}>
            <Label className="mb-1 block text-xs text-text-muted">System Type</Label>
            <AriaButton className="flex w-full items-center justify-between rounded-md border border-border-subtle bg-element-bg px-3 py-2 text-sm text-text-contrast">
              <SelectValue />
              <span aria-hidden>▾</span>
            </AriaButton>
            <Popover className="w-(--trigger-width) rounded-md border border-border-subtle bg-element-bg p-1 shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
              <ListBox className="outline-none">
                {Array.from({ length: bets.length - 1 }, (_, i) => i + 2).map((size) => {
                  const numCombos = getCombinations(bets, size).length;
                  return (
                    <ListBoxItem
                      id={String(size)}
                      key={size}
                      textValue={`${size}/${bets.length}`}
                      className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                    >
                      {size}/{bets.length} ({numCombos} bets)
                    </ListBoxItem>
                  );
                })}
              </ListBox>
            </Popover>
          </Select>
        </div>
      ) : null}

      {bets.length > 0 ? (
        <div className="border-t border-border-subtle bg-element-bg p-4">
          <div className="mb-4">
            <TextField>
              <Label className="mb-1 block text-xs text-text-muted">Total Stake</Label>
              <Input
                type="number"
                {...register('stake', { valueAsNumber: true })}
                placeholder="0.00"
                className="w-full rounded-md border border-border-subtle bg-element-bg px-3 py-2 text-sm text-text-contrast outline-none transition-colors focus:border-accent-solid"
              />
            </TextField>
            {formErrors.stake ? <div className="mt-1 text-xs text-red-500">{formErrors.stake.message}</div> : null}
          </div>

          <div className="mb-4 flex gap-2">
            {[10, 25, 50, 100].map((amount) => (
              <AriaButton
                key={amount}
                onPress={() => setValue('stake', amount, { shouldValidate: true })}
                className="flex-1 rounded bg-element-hover-bg py-1.5 text-xs text-text-muted transition-colors hover:bg-accent-solid hover:text-[#1d1d1d]"
              >
                €{amount}
              </AriaButton>
            ))}
          </div>

          <div className="mb-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-text-muted">
              <span>Bet Type</span>
              <span className="capitalize text-text-contrast">{activeTab}</span>
            </div>
            {activeTab === 'multiple' && calculation.combinedOdds > 0 ? (
              <div className="flex justify-between text-text-muted">
                <span>Combined Odds</span>
                <span className="text-text-contrast">{calculation.combinedOdds.toFixed(2)}</span>
              </div>
            ) : null}
            {activeTab !== 'multiple' ? (
              <div className="flex justify-between text-text-muted">
                <span>Number of Bets</span>
                <span className="text-text-contrast">{calculation.numBets}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-text-muted">
              <span>Total Stake</span>
              <span className="text-text-contrast">€{calculation.totalStake.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-text-contrast">
              <span>Potential Win</span>
              <span className="text-accent-solid">€{calculation.potentialWin.toFixed(2)}</span>
            </div>
          </div>

          {error ? <div className="mb-3 rounded bg-red-500/10 p-2 text-xs text-red-500">{error}</div> : null}

          {'error' in calculation && calculation.error ? (
            <div className="mb-3 text-xs text-yellow-500">{calculation.error}</div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              variant="solid"
              className="w-full"
              onPress={handlePlaceBet}
              isDisabled={stake <= 0 || isPlacing || ('error' in calculation && !!calculation.error)}
            >
              {isPlacing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Placing...
                </span>
              ) : (
                'Place Bet'
              )}
            </Button>
            <Button variant="ghost" className="w-full text-text-muted hover:bg-element-hover-bg" onPress={clearBetSlip}>
              Clear All
            </Button>
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
                    to={`/play/track?ticket=${encodeURIComponent(ticketId)}${
                      variantFromPath ? `&v=${variantFromPath}` : ''
                    }`}
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
