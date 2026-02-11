import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
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

export function Betslip({ isOpen = true, onClose, className, initialStake = 10 }: BetslipProps) {
  const [activeTab, setActiveTab] = useState<BetMode>('single');
  const [systemSize, setSystemSize] = useState<number>(2);
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletBetRef, setWalletBetRef] = useState<string | null>(null);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [bookCode, setBookCode] = useState<string | null>(null);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: walletProfile } = useWalletProfile();
  const walletBalance = walletProfile?.balance ?? 0;
  const isAuthenticated = Boolean(getAuthToken());
  const primaryChannel: PlaceChannel = isAuthenticated ? 'wallet' : 'retail';
  const primaryActionLabel = isAuthenticated ? 'Place Bet' : 'Book a Bet';
  const normalizedInitialStake =
    Number.isFinite(initialStake) && initialStake > 0 ? initialStake : 10;

  const { watch, setValue, getValues, trigger } = useForm<BetSlipStakeForm>({
    resolver: zodResolver(betSlipStakeSchema),
    defaultValues: { stake: normalizedInitialStake },
  });

  useEffect(() => {
    setValue('stake', normalizedInitialStake, { shouldValidate: true });
  }, [normalizedInitialStake, setValue]);

  const { bets, removeFromBetSlip, clearBetSlip, toBetSlipInput } = useBetSlip();

  useEffect(() => {
    if (activeTab === 'system' && bets.length < 3) {
      setActiveTab(bets.length >= 2 ? 'multiple' : 'single');
    }
    if (activeTab === 'multiple' && bets.length < 2) {
      setActiveTab('single');
    }
  }, [activeTab, bets.length]);

  useEffect(() => {
    if (systemSize > bets.length) {
      setSystemSize(Math.max(2, bets.length));
    }
  }, [bets.length, systemSize]);

  const stake = Number(watch('stake') ?? 10);

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
    setBookCode(null);
    setShowBookDialog(false);
    setCopiedCode(false);

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
        setBookCode(createdCode);
        setShowBookDialog(true);
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

  const copyBookCode = async () => {
    if (!bookCode) return;
    try {
      await navigator.clipboard.writeText(bookCode);
      setCopiedCode(true);
    } catch {
      setError('Failed to copy code');
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-l border-border-subtle bg-element-bg',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border-subtle bg-element-bg px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-contrast">
          Bet Slip
          <span className="rounded-full bg-accent-solid px-2 py-0.5 text-xs text-[#1d1d1d]">
            {bets.length}
          </span>
        </h2>
        {onClose ? (
          <AriaButton
            onPress={onClose}
            className="text-text-muted transition-colors hover:text-text-contrast"
          >
            <X size={20} />
          </AriaButton>
        ) : null}
      </div>

      <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(key as BetMode)}>
        <TabList aria-label="Bet type" className="grid grid-cols-3 border-b border-border-subtle">
          <Tab
            id="single"
            className="border-b-2 border-transparent py-2 text-sm font-medium capitalize text-text-muted outline-none transition data-[selected]:border-accent-solid data-[selected]:text-text-contrast"
          >
            single
          </Tab>
          <Tab
            id="multiple"
            isDisabled={bets.length < 2}
            className="border-b-2 border-transparent py-2 text-sm font-medium capitalize text-text-muted outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[selected]:border-accent-solid data-[selected]:text-text-contrast"
          >
            multiple
          </Tab>
          <Tab
            id="system"
            isDisabled={bets.length < 3}
            className="border-b-2 border-transparent py-2 text-sm font-medium capitalize text-text-muted outline-none transition data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[selected]:border-accent-solid data-[selected]:text-text-contrast"
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
              <div
                key={bet.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-element-hover-bg/50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text-contrast">
                      {bet.selectionName} <span className="text-text-muted">|</span> {bet.marketName}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-text-contrast">
                      {bet.fixtureName.replace(' vs ', ' - ')}
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {bet.fixtureId}
                      {bet.leagueCountry ? ` | ${bet.leagueCountry}` : ''}
                      {bet.leagueName ? ` | ${bet.leagueName}` : ''}
                    </div>
                    {bet.fixtureDate ? (
                      <div className="mt-0.5 text-xs text-text-muted">
                        {formatFixtureTime(bet.fixtureDate)}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-contrast">
                      {bet.odds.toFixed(2)}
                    </span>
                    <AriaButton
                      onPress={() => removeFromBetSlip(bet.id)}
                      className="text-text-muted transition-colors hover:text-text-contrast"
                    >
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
            <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Total Stake
            </span>
            <div className="flex items-center gap-2 rounded border border-border-subtle bg-[#101010] px-3 py-1 text-sm">
              <AriaButton
                onPress={() => updateStake(stake - 1)}
                className="h-6 w-6 rounded bg-[#1c1c1c] text-text-muted transition hover:bg-[#272727]"
              >
                −
              </AriaButton>
              <span className="min-w-[40px] text-center font-semibold text-text-contrast">
                {stake.toFixed(0)}
              </span>
              <AriaButton
                onPress={() => updateStake(stake + 1)}
                className="h-6 w-6 rounded bg-[#1c1c1c] text-text-muted transition hover:bg-[#272727]"
              >
                +
              </AriaButton>
            </div>
          </div>

          {activeTab === 'system' && bets.length >= 3 ? (
            <div className="mt-3">
              <Select
                selectedKey={String(systemSize)}
                onSelectionChange={(key) => setSystemSize(Number(key))}
              >
                <AriaButton className="flex w-full items-center justify-between rounded border border-border-subtle bg-[#101010] px-3 py-2 text-xs font-medium uppercase tracking-widest text-text-muted">
                  <SelectValue />
                  <span aria-hidden>▾</span>
                </AriaButton>
                <Popover className="w-(--trigger-width) rounded-md border border-border-subtle bg-element-bg p-1 shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
                  <ListBox className="outline-none">
                    {Array.from({ length: bets.length - 1 }, (_, i) => i + 2).map((size) => (
                      <ListBoxItem
                        id={String(size)}
                        key={size}
                        textValue={`${size}/${bets.length}`}
                        className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                      >
                        {size}/{bets.length} System
                      </ListBoxItem>
                    ))}
                  </ListBox>
                </Popover>
              </Select>
            </div>
          ) : null}

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
            <span className="text-text-muted">Bet Lines</span>
            <span className="font-semibold text-text-contrast">{preview.lineCount}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-text-muted">Possible Returns</span>
            <span className="font-semibold text-accent-solid">
              {formatCurrency(preview.totalPotentialReturn)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-text-muted">{isAuthenticated ? 'Wallet Balance' : 'Booking Mode'}</span>
            <span className="font-semibold text-text-contrast">
              {isAuthenticated ? formatCurrency(walletBalance) : 'No Login Required'}
            </span>
          </div>

          {preview.error ? (
            <div className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-500">
              {preview.error}
            </div>
          ) : null}
          {walletBetRef ? (
            <div className="mt-3 rounded bg-green-500/10 p-2 text-xs text-green-500">
              Wallet bet placed: <span className="font-mono">{walletBetRef}</span>
            </div>
          ) : null}
          {error ? <div className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-500">{error}</div> : null}

          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="solid"
              className="h-12 rounded bg-[#31ae2f] text-sm font-semibold text-[#041207] hover:bg-[#2a9829]"
              onPress={() => {
                void placeSlip(primaryChannel);
              }}
              isDisabled={isPlacing || Boolean(preview.error) || stake <= 0}
            >
              {isPlacing ? 'Processing...' : primaryActionLabel}
            </Button>
            <div className="text-xs text-text-muted">
              {isAuthenticated
                ? 'Place Bet debits your wallet immediately.'
                : 'Book a Bet creates a short shareable code.'}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="w-full rounded border border-red-500 text-sm text-red-500 hover:bg-red-500/10"
                onPress={clearBetSlip}
                isDisabled={isPlacing}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ModalOverlay
        isOpen={showWalletDialog}
        onOpenChange={setShowWalletDialog}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 data-[entering]:animate-in data-[entering]:fade-in data-[exiting]:animate-out data-[exiting]:fade-out"
      >
        <Modal className="w-full max-w-md rounded-lg border border-border-subtle bg-element-bg p-4 shadow-xl outline-none data-[entering]:animate-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:zoom-out-95">
          <Dialog className="outline-none">
            <h3 className="mb-2 text-lg font-semibold text-text-contrast">Wallet Bet Placed</h3>
            <p className="mb-3 text-sm text-text-muted">
              Save your bet reference for support and reconciliation.
            </p>
            <div className="mb-4 rounded bg-green-500/10 p-2 text-xs text-green-500">
              <span className="font-mono">{walletBetRef}</span>
            </div>
            <div className="flex justify-end">
              <Button onPress={() => setShowWalletDialog(false)} size="sm">
                Close
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>

      <ModalOverlay
        isOpen={showBookDialog}
        onOpenChange={setShowBookDialog}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 data-[entering]:animate-in data-[entering]:fade-in data-[exiting]:animate-out data-[exiting]:fade-out"
      >
        <Modal className="w-full max-w-md rounded-lg border border-border-subtle bg-element-bg p-4 shadow-xl outline-none data-[entering]:animate-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:zoom-out-95">
          <Dialog className="outline-none">
            <h3 className="mb-2 text-lg font-semibold text-text-contrast">Bet Booked</h3>
            <p className="mb-3 text-sm text-text-muted">
              Share this code to recreate the same selections.
            </p>
            <div className="mb-4 rounded bg-green-500/10 p-2 text-xs text-green-500">
              Book a bet code: <span className="font-mono">{bookCode}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onPress={() => void copyBookCode()} size="sm" variant="outline">
                {copiedCode ? 'Copied' : 'Copy Code'}
              </Button>
              {bookCode ? (
                <Link
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border-subtle px-3 text-xs font-medium text-text-contrast transition-colors hover:bg-element-hover-bg"
                  to={`/play/betslip?book=${encodeURIComponent(bookCode)}`}
                >
                  Share Bet Link
                </Link>
              ) : null}
              <Button onPress={() => setShowBookDialog(false)} size="sm">
                Close
              </Button>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </aside>
  );
}
