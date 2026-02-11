import { useEffect, useRef, useState } from 'react';
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
  const loadedCodeRef = useRef<string | null>(null);

  useEffect(() => {
    const code = String(searchParams.get('book') ?? '').trim();
    if (!code || loadedCodeRef.current === code) return;
    loadedCodeRef.current = code;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setHydrateError(null);
      setHydratingCode(code);
    });

    void api
      .get<RecreateResponse>(`/tickets/${encodeURIComponent(code)}/recreate`)
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
        setHydratedCode(data?.bookCode ?? code);
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
  }, [replaceBetSlip, searchParams]);

  return (
    <div className="flex h-full flex-col bg-element-bg">
      <div className="flex-1 overflow-hidden">
        {hydratingCode ? (
          <div className="border-b border-border-subtle bg-element-hover-bg px-4 py-2 text-xs text-text-muted">
            Recreating shared bet {hydratingCode}...
          </div>
        ) : null}
        {hydratedCode ? (
          <div className="border-b border-border-subtle bg-green-500/10 px-4 py-2 text-xs text-green-500">
            Shared bet {hydratedCode} loaded.
          </div>
        ) : null}
        {hydrateError ? (
          <div className="border-b border-border-subtle bg-red-500/10 px-4 py-2 text-xs text-red-500">
            {hydrateError}
          </div>
        ) : null}
        <Betslip isOpen className="w-full border-0" initialStake={initialStake} />
      </div>
    </div>
  );
}
