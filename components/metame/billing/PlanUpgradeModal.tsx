'use client';

/**
 * PlanUpgradeModal — consumer-facing plan-subscription upgrade surface.
 *
 * Drives the metaMe commercial ladder (Sovereignty → Stewardship → Founder
 * Office tiers) against POST /api/billing/checkout. Three rails:
 *   - Q¢   — synchronous debit; surfaces a Buy-Q¢ prompt on shortfall.
 *   - PayPal — popup + postMessage (matches ContentPurchaseModal), captured
 *             server-side via /api/billing/checkout/paypal-return.
 *   - USDC — stubbed for alpha ("Coming soon").
 *
 * KNYT is deliberately NOT a rail here — it stays in-cartridge per the
 * commercial architecture (KNYT must not bleed into metaMe plan payments).
 *
 * Prices render USD-primary per the Q¢ canonical rule; the Q¢ count is the
 * secondary line. All prices come from the live quote endpoint (which reads
 * plan_price_config) so the modal never hardcodes a figure that could drift.
 *
 * Spine fetches use personaFetch (Bearer token) per the CLAUDE.md rule.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Coins, CreditCard, Wallet, Check, Loader2, Sparkles, ArrowUpCircle } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { useEvmUsdcPayment, type UsdcPaymentIntent } from '@/app/hooks/useEvmUsdcPayment';

// The tier ladder this modal can sell. Order is the display order. Labels +
// blurbs are UI copy; the authoritative price comes from the quote endpoint.
export type PlanTierKey =
  | 'sovereign_citizen'
  | 'steward'
  | 'venture_lite'
  | 'venture_pro'
  | 'venture_elite';

interface TierMeta {
  key: PlanTierKey;
  name: string;
  blurb: string;
}

const TIER_LADDER: TierMeta[] = [
  { key: 'sovereign_citizen', name: 'Sovereignty', blurb: 'Standing history, Sonnet aigentMe, DevOn lite, Founder Office preview.' },
  { key: 'steward', name: 'Stewardship', blurb: 'Professional Standing, steward privileges, Act as Aigent.' },
  { key: 'venture_lite', name: 'Founder Office Operator', blurb: 'One venture on the Pro schema + operating model.' },
  { key: 'venture_pro', name: 'Operator Plus', blurb: 'Three ventures + portfolio.' },
  { key: 'venture_elite', name: 'Portfolio Operator', blurb: 'Unlimited ventures + portfolio. Opus aigentMe.' },
];

type Rail = 'qc' | 'paypal' | 'usdc';

interface QuoteRails {
  qc: { priceCents: number; currency: string; note: string };
  usdc: { priceUsd: number; priceCents: number; currency: string; note: string };
  paypal: { priceUsd: number; priceCents: number; currency: string; note: string };
}

interface TierQuote {
  tierKey: PlanTierKey;
  label: string;
  priceUsdCents: number;
  rails: QuoteRails;
}

export interface PlanUpgradeModalProps {
  open: boolean;
  personaId?: string;
  /** Restrict the ladder to a subset of tiers (defaults to all five). */
  tiers?: PlanTierKey[];
  /** Pre-select a tier when the modal opens (e.g. from a feature gate CTA). */
  defaultTierKey?: PlanTierKey;
  onClose: () => void;
  /** Fired after a successful purchase so the host can refresh plan state. */
  onUpgraded?: (tierKey: PlanTierKey) => void;
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PlanUpgradeModal({
  open,
  personaId,
  tiers,
  defaultTierKey,
  onClose,
  onUpgraded,
}: PlanUpgradeModalProps) {
  const ladder = tiers && tiers.length > 0 ? TIER_LADDER.filter((t) => tiers.includes(t.key)) : TIER_LADDER;

  const [quotes, setQuotes] = useState<Record<string, TierQuote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PlanTierKey | null>(defaultTierKey ?? null);
  const [rail, setRail] = useState<Rail>('qc');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsBuyQc, setNeedsBuyQc] = useState(false);
  const [success, setSuccess] = useState<{ tierKey: PlanTierKey; label: string } | null>(null);
  const [usdcStage, setUsdcStage] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const usdcPay = useEvmUsdcPayment();

  // Load live quotes for the whole ladder when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingQuotes(true);
    setError(null);
    (async () => {
      const entries = await Promise.all(
        ladder.map(async (t) => {
          try {
            const res = await personaFetch(`/api/billing/checkout?tierKey=${t.key}`, { cache: 'no-store' });
            const data = await res.json();
            if (data?.ok) return [t.key, data as TierQuote] as const;
          } catch {
            /* ignore — tier simply won't show a price */
          }
          return null;
        }),
      );
      if (cancelled) return;
      const map: Record<string, TierQuote> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setQuotes(map);
      setLoadingQuotes(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset transient state when the modal closes.
  useEffect(() => {
    if (open) return;
    setSelectedTier(defaultTierKey ?? null);
    setRail('qc');
    setProcessing(false);
    setError(null);
    setNeedsBuyQc(false);
    setSuccess(null);
    setUsdcStage(null);
  }, [open, defaultTierKey]);

  const finishSuccess = useCallback(
    (tierKey: PlanTierKey, label: string) => {
      setProcessing(false);
      setSuccess({ tierKey, label });
      onUpgraded?.(tierKey);
    },
    [onUpgraded],
  );

  // PayPal popup message listener.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; tierKey?: PlanTierKey; label?: string; error?: string };
      if (!data?.type) return;
      if (data.type === 'plan-paypal-success' && data.tierKey) {
        finishSuccess(data.tierKey, data.label ?? quotes[data.tierKey]?.label ?? 'your new tier');
      } else if (data.type === 'plan-paypal-error') {
        setProcessing(false);
        setError(data.error ?? 'PayPal payment failed.');
      } else if (data.type === 'plan-paypal-cancelled') {
        setProcessing(false);
        setError('PayPal payment was cancelled.');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [open, quotes, finishSuccess]);

  if (!open) return null;

  const quote = selectedTier ? quotes[selectedTier] : null;

  // USDC: two-step — request a server payment intent, send USDC on Base from
  // the wallet, then submit the txHash for server-side verification.
  async function handleUsdcPay(tier: PlanTierKey) {
    setProcessing(true);
    setError(null);
    setUsdcStage('Requesting payment details…');
    try {
      const intentRes = await personaFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey: tier, rail: 'usdc' }),
        personaIdHint: personaId,
      });
      const intentData = await intentRes.json();
      if (!intentData?.ok || intentData.step !== 'usdc_pay') {
        setProcessing(false);
        setUsdcStage(null);
        setError(intentData?.error ?? 'Could not start USDC checkout.');
        return;
      }

      const intent = intentData.usdc as UsdcPaymentIntent;
      const checkoutId = intentData.checkoutId as string;

      setUsdcStage('Confirm the USDC transfer in your wallet…');
      const txHash = await usdcPay.payUsdc(intent);

      setUsdcStage('Verifying the on-chain payment…');
      const settleRes = await personaFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey: tier, rail: 'usdc', txHash, checkoutId, chainId: intent.chainId }),
        personaIdHint: personaId,
      });
      const settleData = await settleRes.json();
      setUsdcStage(null);
      if (!settleData?.ok) {
        setProcessing(false);
        setError(settleData?.error ?? 'USDC verification failed.');
        return;
      }
      finishSuccess(tier, settleData.label ?? 'your new tier');
    } catch (e) {
      setProcessing(false);
      setUsdcStage(null);
      setError(e instanceof Error ? e.message : 'USDC payment failed.');
    }
  }

  async function handlePay() {
    if (!selectedTier) return;
    setProcessing(true);
    setError(null);
    setNeedsBuyQc(false);

    if (rail === 'usdc') {
      await handleUsdcPay(selectedTier);
      return;
    }

    try {
      const res = await personaFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey: selectedTier, rail }),
        personaIdHint: personaId,
      });
      const data = await res.json();

      if (!data?.ok) {
        setProcessing(false);
        if (data?.needsBuyQc) setNeedsBuyQc(true);
        setError(data?.error ?? 'Checkout failed.');
        return;
      }

      if (rail === 'qc' && data.step === 'complete') {
        finishSuccess(selectedTier, data.label ?? 'your new tier');
        return;
      }

      if (rail === 'paypal' && data.step === 'redirect' && data.approvalUrl) {
        // Open PayPal in a popup; the return route postMessages back.
        popupRef.current = window.open(
          data.approvalUrl,
          'PayPal Checkout',
          'width=500,height=720,scrollbars=yes',
        );
        // Watchdog: if the popup closes with no message, unwind.
        const watchdog = window.setInterval(() => {
          if (popupRef.current?.closed) {
            window.clearInterval(watchdog);
            setTimeout(() => {
              setProcessing((p) => {
                if (p) setError('PayPal window closed before completing.');
                return false;
              });
            }, 1000);
          }
        }, 600);
        return;
      }

      setProcessing(false);
      setError('Unexpected checkout response.');
    } catch (e) {
      setProcessing(false);
      setError(e instanceof Error ? e.message : 'Checkout failed.');
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0f] text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-semibold">Upgrade your plan</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold">You're on {success.label}</h3>
            <p className="max-w-sm text-sm text-slate-400">
              Your plan is active. New entitlements (AI tier, standing history, Founder Office surfaces) unlock immediately.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            {/* Tier ladder */}
            <div className="space-y-2">
              {ladder.map((t) => {
                const q = quotes[t.key];
                const selected = selectedTier === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      setSelectedTier(t.key);
                      setError(null);
                      setNeedsBuyQc(false);
                    }}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        {selected && <Sparkles className="h-3.5 w-3.5 text-purple-300" />}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{t.blurb}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {q ? (
                        <>
                          <div className="text-sm font-semibold">{usd(q.priceUsdCents)}</div>
                          <div className="text-[11px] text-slate-500">{q.priceUsdCents} Q¢ /mo</div>
                        </>
                      ) : loadingQuotes ? (
                        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Rail picker — only when a tier is selected and priced */}
            {selectedTier && quote && (
              <div className="mt-5">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Payment method</div>
                <div className="grid grid-cols-3 gap-2">
                  <RailButton
                    active={rail === 'qc'}
                    onClick={() => setRail('qc')}
                    icon={<Coins className="h-4 w-4" />}
                    label="Q¢"
                    sub={`${quote.rails.qc.priceCents} Q¢`}
                  />
                  <RailButton
                    active={rail === 'paypal'}
                    onClick={() => setRail('paypal')}
                    icon={<CreditCard className="h-4 w-4" />}
                    label="PayPal"
                    sub={usd(quote.rails.paypal.priceCents)}
                  />
                  <RailButton
                    active={rail === 'usdc'}
                    onClick={() => setRail('usdc')}
                    icon={<Wallet className="h-4 w-4" />}
                    label="USDC"
                    sub={usd(quote.rails.usdc.priceCents)}
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  {rail === 'qc'
                    ? 'Q¢ is the house rate — no card or network premium.'
                    : rail === 'paypal'
                      ? 'Includes the standard PayPal + fiat premium.'
                      : 'Includes the USDC network premium. Paid on Base from your wallet.'}
                </p>
              </div>
            )}

            {/* Error / shortfall */}
            {error && (
              <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
                {needsBuyQc && (
                  <span className="ml-1">
                    Top up your Q¢ balance in the wallet, then try again.
                  </span>
                )}
              </div>
            )}

            {/* Pay CTA */}
            {selectedTier && quote && (
              <button
                onClick={handlePay}
                disabled={processing}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {usdcStage ?? 'Processing…'}
                  </>
                ) : rail === 'qc' ? (
                  `Pay ${usd(quote.rails.qc.priceCents)} with Q¢`
                ) : rail === 'paypal' ? (
                  `Pay ${usd(quote.rails.paypal.priceCents)} with PayPal`
                ) : (
                  `Pay ${usd(quote.rails.usdc.priceCents)} with USDC`
                )}
              </button>
            )}

            <p className="mt-3 text-center text-[11px] text-slate-600">
              Billed monthly · cancel anytime · KNYT is not used for plan payments
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RailButton({
  active,
  onClick,
  icon,
  label,
  sub,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs transition-colors ${
        active
          ? 'border-purple-500 bg-purple-500/10 text-white'
          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="text-[10px] text-slate-500">{sub}</span>
    </button>
  );
}
