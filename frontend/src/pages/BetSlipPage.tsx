import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Betslip } from '../components/Betslip';
import { useBetSlip, type Bet } from '../context/BetSlipContext';
import { api } from '../lib/api';
import { getApiErrorMessage } from '../lib/apiError';

type RecreateResponse = {
  ok?: boolean;
  bookCode?: string;
  slip?: { stake?: number };
  bets?: Bet[];
};

export function BetSlipPage() {
  const [searchParams] = useSearchParams();
  const { replaceBetSlip } = useBetSlip();
  const [hydrateError, setHydrateError] = useState<string | null>(null);
  const [hydratingCode, setHydratingCode] = useState<string | null>(null);
  const [hydratedCode, setHydratedCode] = useState<string | null>(null);
  const [initialStake, setInitialStake] = useState<number>(10);
  const shareCode = searchParams.get('share');
  const legacyBookCode = searchParams.get('book');
  const recreateCode = String(shareCode ?? legacyBookCode ?? '').trim();
  const recreateParam = shareCode ? 'share' : legacyBookCode ? 'book' : null;

  useEffect(() => {
    if (!recreateCode) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setHydrateError(null);
      setHydratingCode(recreateCode);
    });

    void api
      .get<RecreateResponse>(`/tickets/${encodeURIComponent(recreateCode)}/recreate`)
      .then(({ data }) => {
        if (cancelled) return;
        const recreatedBets = Array.isArray(data?.bets) ? data.bets : [];
        if (recreatedBets.length === 0) {
          setHydrateError('No selections were found for this booking code.');
          return;
        }
        replaceBetSlip(recreatedBets);
        const recreatedStake = Number(data?.slip?.stake ?? 0);
        if (Number.isFinite(recreatedStake) && recreatedStake > 0) {
          setInitialStake(recreatedStake);
        }
        setHydratedCode(data?.bookCode ?? recreateCode);
        if (recreateParam) {
          const url = new URL(window.location.href);
          url.searchParams.delete(recreateParam);
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setHydrateError(getApiErrorMessage(error, 'Unable to recreate this booking code.'));
      })
      .finally(() => {
        if (cancelled) return;
        setHydratingCode(null);
      });

    return () => {
      cancelled = true;
    };
  }, [recreateCode, recreateParam, replaceBetSlip]);

  return (
    <div data-testid="betslip-page" className="flex h-full flex-col bg-element-bg">
      <div className="flex-1 overflow-hidden">
        {hydratingCode ? (
          <div className="border-b border-border-subtle bg-element-hover-bg px-4 py-2 text-xs text-text-muted">
            Recreating shared bet {hydratingCode}...
          </div>
        ) : null}
        {hydratedCode ? (
          <div className="border-b border-border-subtle bg-status-positive-soft px-4 py-2 text-xs text-status-positive">
            Shared bet {hydratedCode} loaded.
          </div>
        ) : null}
        {hydrateError ? (
          <div className="border-b border-border-subtle bg-status-negative-soft px-4 py-2 text-xs text-status-negative">
            {hydrateError}
          </div>
        ) : null}
        <Betslip isOpen className="w-full border-0" initialStake={initialStake} />
      </div>
    </div>
  );
}
