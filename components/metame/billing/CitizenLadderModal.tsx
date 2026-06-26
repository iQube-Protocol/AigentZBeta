'use client';

/**
 * CitizenLadderModal — 3-column citizenship-tier comparison for pre-Founder-
 * Office upgrades: Free | Sovereignty ($29/mo) | Stewardship ($99/mo).
 *
 * Triggered whenever a user needs to upgrade to sovereign_citizen or steward
 * (e.g. unlocking aigentZ access). Shows a feature comparison table so the
 * user can see exactly what each tier unlocks before paying.
 *
 * Payment rails: Q¢ / PayPal / USDC — KNYT is deliberately excluded.
 * Spine fetches use personaFetch per CLAUDE.md.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Check, Loader2, Coins, CreditCard, Wallet, ArrowUpCircle } from 'lucide-react';
import { personaFetch } from '@/utils/personaSpine';
import { useEvmUsdcPayment, type UsdcPaymentIntent } from '@/app/hooks/useEvmUsdcPayment';
import type { PlanTierKey } from './PlanUpgradeModal';
import { CompAccessRequest } from './CompAccessRequest';
import { FeatureRow, GroupHeader, ModelCell, TierCard, usd } from './comparisonTable';

const CITIZEN_TIER_LABEL: Record<CitizenTierKey, string> = {
  sovereign_citizen: 'Sovereignty',
  steward: 'Stewardship',
};

export type CitizenTierKey = 'sovereign_citizen' | 'steward';

type Rail = 'qc' | 'paypal' | 'usdc';

interface TierQuoteRails {
  qc: { priceCents: number };
  usdc: { priceCents: number };
  paypal: { priceCents: number };
}

interface TierQuote {
  tierKey: PlanTierKey;
  priceUsdCents: number;
  rails: TierQuoteRails;
}

export interface CitizenLadderModalProps {
  open: boolean;
  personaId?: string;
  /** Pre-highlight a specific paid tier on open. */
  defaultTierKey?: CitizenTierKey;
  onClose: () => void;
  /** Fired after a successful purchase so the host can refresh plan state. */
  onUpgraded?: (tierKey: PlanTierKey) => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// Table-cell helpers are shared with the Founder Office modal — see
// comparisonTable.tsx. RailButton (below) is payment-specific and stays local.
// ──────────────────────────────────────────────────────────────────────────────

function RailButton({
  active, onClick, icon, label, sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors ${
        active
          ? 'border-purple-500 bg-purple-500/10 text-white'
          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="text-[10px] text-slate-500">{sub}</span>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main modal
// ──────────────────────────────────────────────────────────────────────────────

export function CitizenLadderModal({
  open,
  personaId,
  defaultTierKey,
  onClose,
  onUpgraded,
}: CitizenLadderModalProps) {
  const [selectedTier, setSelectedTier] = useState<CitizenTierKey | null>(defaultTierKey ?? null);
  const [quotes, setQuotes] = useState<Partial<Record<CitizenTierKey, TierQuote>>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [rail, setRail] = useState<Rail>('qc');
  const [processing, setProcessing] = useState(false);
  const [usdcStage, setUsdcStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsBuyQc, setNeedsBuyQc] = useState(false);
  const [success, setSuccess] = useState<{ tierKey: PlanTierKey; label: string } | null>(null);
  const popupRef = useRef<Window | null>(null);
  const usdcPay = useEvmUsdcPayment();

  // Load live quotes when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingQuotes(true);
    (async () => {
      const tiers: CitizenTierKey[] = ['sovereign_citizen', 'steward'];
      const entries = await Promise.all(
        tiers.map(async (tierKey) => {
          try {
            const res = await personaFetch(`/api/billing/checkout?tierKey=${tierKey}`, { cache: 'no-store' });
            const data = await res.json();
            if (data?.ok) return [tierKey, data as TierQuote] as const;
          } catch { /* ignore */ }
          return null;
        }),
      );
      if (cancelled) return;
      const map: Partial<Record<CitizenTierKey, TierQuote>> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setQuotes(map);
      setLoadingQuotes(false);
    })();
    return () => { cancelled = true; };
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
        finishSuccess(data.tierKey, data.label ?? 'your new tier');
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
  }, [open, finishSuccess]);

  if (!open) return null;

  const quote = selectedTier ? quotes[selectedTier] : null;

  async function handleUsdcPay(tier: CitizenTierKey) {
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
        popupRef.current = window.open(
          data.approvalUrl,
          'PayPal Checkout',
          'width=500,height=720,scrollbars=yes',
        );
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

  const sovPrice = loadingQuotes ? '…' : quotes.sovereign_citizen ? `${usd(quotes.sovereign_citizen.priceUsdCents)}/mo` : '$29/mo';
  const stePrice = loadingQuotes ? '…' : quotes.steward ? `${usd(quotes.steward.priceUsdCents)}/mo` : '$99/mo';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0f] text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-semibold">Citizen services tiers</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
          >
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
              New entitlements unlock immediately — aigentZ and your upgraded
              intelligence are active now.
            </p>
            <button
              onClick={onClose}
              className="mt-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="max-h-[82vh] overflow-y-auto px-5 py-5">
            {/* Tier header cards */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              <TierCard label="Free" price="$0" isFree selected={false} />
              <TierCard
                label="Sovereignty"
                price={sovPrice}
                selected={selectedTier === 'sovereign_citizen'}
                onSelect={() => {
                  setSelectedTier('sovereign_citizen');
                  setError(null);
                  setNeedsBuyQc(false);
                }}
              />
              <TierCard
                label="Stewardship"
                price={stePrice}
                selected={selectedTier === 'steward'}
                onSelect={() => {
                  setSelectedTier('steward');
                  setError(null);
                  setNeedsBuyQc(false);
                }}
              />
            </div>

            {/* Feature comparison table */}
            <table className="w-full table-fixed text-left">
              <thead>
                <tr>
                  <th className="w-[46%] pb-2 text-[11px] text-slate-600">Feature</th>
                  <th className="w-[18%] pb-2 text-center text-[11px] text-slate-400">Free</th>
                  <th className="w-[18%] pb-2 text-center text-[11px] text-purple-300">Sovereignty</th>
                  <th className="w-[18%] pb-2 text-center text-[11px] text-purple-200">Stewardship</th>
                </tr>
              </thead>
              <tbody>
                <GroupHeader label="Identity & Activations" />
                <FeatureRow label="Polity Passport" a={true} b={true} c={true} />
                <FeatureRow label="Standing Cartridge" a={true} b={true} c={true} />
                <FeatureRow label="Core content (KNYT · Qriptopian · Polity Core)" a={true} b={true} c={true} />
                <FeatureRow label="aigentMe" a={true} b={true} c={true} />
                <FeatureRow label="myCluster" a={true} b={true} c={true} />
                <FeatureRow label="AgentiQ OS" a={true} b={true} c={true} />
                <FeatureRow label="DevOn (aigentZ)" a={null} b="Lite" c="Full" />

                <GroupHeader label="Intelligence" />
                <FeatureRow
                  label="AI model (or comparable class)"
                  a={<ModelCell primary="Haiku" alts={['GPT-4o mini', 'Gemini Flash', 'Venice SM']} />}
                  b={<ModelCell primary="Sonnet" alts={['GPT-4o', 'Gemini Pro', 'Venice MD']} />}
                  c={<ModelCell primary="Sonnet" alts={['GPT-4o', 'Gemini Pro', 'Venice LG']} />}
                />
                <FeatureRow label="Standing analytics" a={null} b={true} c={true} />
                <FeatureRow label="Archetype pathways" a={null} b={true} c={true} />
                <FeatureRow label="Founder Office preview" a={null} b={null} c={true} />

                <GroupHeader label="Experience model" />
                <FeatureRow label="Goals" a="1" b="5" c="∞" />
                <FeatureRow label="KPIs" a="3" b="7" c="∞" />
                <FeatureRow label="myCartridges" a="1" b="Up to 5" c="∞" />
                <FeatureRow label="Intent-chain tracking" a="1 generation" b="2" c="3" />

                <GroupHeader label="Stewardship" />
                <FeatureRow label="Professional Standing" a={null} b={null} c={true} />
                <FeatureRow label="HMS discovery" a={null} b={null} c={true} />
                <FeatureRow label="Steward privileges" a={null} b={null} c={true} />
                <FeatureRow label="Act as Aigent" a={null} b={null} c={true} />
              </tbody>
            </table>

            {/* Payment section — appears when a paid tier is selected and priced */}
            {selectedTier && quote && (
              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Payment method
                </div>
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

                {error && (
                  <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    {error}
                    {needsBuyQc && (
                      <span className="ml-1">
                        Top up your Q¢ balance in the wallet, then try again.
                      </span>
                    )}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={processing}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {usdcStage ?? 'Processing…'}
                    </>
                  ) : rail === 'qc' ? (
                    `Pay ${usd(quote.rails.qc.priceCents)} with Q¢`
                  ) : rail === 'paypal' ? (
                    `Pay ${usd(quote.rails.paypal.priceCents)} with PayPal`
                  ) : (
                    `Pay ${usd(quote.rails.usdc.priceCents)} with USDC`
                  )}
                </button>
              </div>
            )}

            {/* Complimentary / admin access request — routes to the admin
                approval queue for qualified users who shouldn't pay. */}
            <CompAccessRequest
              personaId={personaId}
              tierKey={selectedTier ?? 'sovereign_citizen'}
              tierLabel={CITIZEN_TIER_LABEL[selectedTier ?? 'sovereign_citizen']}
            />

            <p className="mt-4 text-center text-[11px] text-slate-600">
              Billed monthly · cancel anytime · KNYT is not used for plan payments
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
