/**
 * ctp.wallet.asset.convert — CTP Slice C (2026-09-01, "Financial Services
 * consequence proof", delivery amendment §3.3): the first genuinely
 * consequential Financial Services state transition bound to the
 * Constitutional Runtime.
 *
 * Scope for this first slice, deliberately narrow: USDC -> BASE_QC only.
 * BCENT is excluded — it remains explicitly simulated/off-chain pending
 * real BitCent settlement (see services/wallet/qctLedgerService.ts's own
 * header), so it is not yet a genuine consequential act to constitutionally
 * govern.
 *
 * BINDS, DOES NOT REWRITE (CTP-001A §3): the canonical implementation is
 * `convertWalletAsset` (services/wallet/qctLedgerService.ts), itself bound
 * to the ONE atomic Postgres function `convert_wallet_asset`
 * (supabase/migrations/20260930150000_wallet_atomic_convert.sql). This
 * primitive adds authority/authorization/consequence-projection/evidence
 * around that already-correct atomic operation — it performs no wallet
 * mutation of its own.
 *
 * Delegability (2026-09-01 design review): the durable `delegation_grants`
 * model (supabase/migrations/20260622500000_delegation_grants.sql) was
 * inspected for whether it can express amount/asset-scoped conversion
 * authority — a capability tag (`wallet.asset.convert`), a source asset,
 * permitted destination assets, a per-transaction ceiling, an aggregate/
 * time-window ceiling, expiry/revocation. It cannot: `allowed_actions` can
 * name the capability, and `max_actions` can cap a COUNT of actions, but
 * there is no amount-bounded or asset-scoped field anywhere in that schema
 * — `spend_autonomy` is a free-text label, not a structured ceiling. Per
 * the operator's explicit instruction, this primitive therefore FAILS
 * CLOSED for delegated conversion (`delegability: false`, structurally
 * enforced by the Constitutional Runtime itself — no bespoke check added
 * here) rather than reusing `spendWithinCap` or any other generic spend
 * permission to authorize what is not, semantically, an outbound spend.
 * Principal execution ships now; delegated conversion is future work once
 * a real conversion-delegation capability exists in the grant model.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { convertWalletAsset, getWalletAssetBalance } from '@/services/wallet/qctLedgerService';
import { quoteUsdcToBaseQc } from '@/services/wallet/usdcToBaseQcQuote';
import type { ConstitutionalTransitionPrimitive } from '@/types/ctp';
import { registerPrimitive } from '@/services/ctp/registry';

export interface WalletAssetConvertInput {
  usdcAmount: number;
}

export interface WalletAssetConvertResult {
  conversionId: string;
  debitTxId: string;
  creditTxId: string;
  priorUsdcBalance: number;
  resultingUsdcBalance: number;
  priorBaseQcBalance: number;
  resultingBaseQcBalance: number;
  debitedUsdc: number;
  creditedBaseQc: number;
  rate: number;
  feePercent: number;
  feeQct: number;
}

interface WalletAssetConvertState {
  usdcBalance: number;
  baseQcBalance: number;
}

const PRIMITIVE_ID = 'ctp.wallet.asset.convert';
const VERSION = '1.0.0';
const IMPLEMENTATION_REF = 'services/wallet/qctLedgerService.ts#convertWalletAsset';
const SOURCE_TAG = 'usdc_to_qct_conversion';

function namedBindingHash(implementationRef: string, version: string): string {
  return `sha256:${createHash('sha256').update(`${implementationRef}@${version}`).digest('hex')}`;
}

async function priorStateFor(personaId: string): Promise<WalletAssetConvertState> {
  const [usdc, qct] = await Promise.all([
    getWalletAssetBalance(personaId, 'USDC'),
    getWalletAssetBalance(personaId, 'QCT'),
  ]);
  return {
    usdcBalance: usdc.balance?.balance ?? 0,
    baseQcBalance: qct.balance?.balance ?? 0,
  };
}

export const walletAssetConvertPrimitive: ConstitutionalTransitionPrimitive<
  WalletAssetConvertInput,
  WalletAssetConvertResult
> = {
  primitiveId: PRIMITIVE_ID,
  version: VERSION,
  status: 'ACTIVE',
  domain: 'financial-services-wallet',
  description:
    'The wallet owner converts USDC to BASE_QC (Q¢) in their own wallet, through the one atomic ledger ' +
    'operation — an authoritative balance mutation with a canonical constitutional receipt.',
  subjectRequirement: 'PERSONHOOD',
  // Principal-only for this first slice — see the delegability rationale above.
  actorRequirement: ['AUTHORIZED_PRINCIPAL_IDENTITY'],
  delegability: false,
  permittedChannels: ['web'],
  invariantRefs: [],

  async resolveParticipants(_admin, ctx, _input) {
    // No body-supplied identity anywhere in this chain — the wallet subject
    // is ALWAYS the authenticated caller's own server-resolved persona (the
    // same authorization repair applied directly to the route). There is no
    // "acting on behalf of a different principal" path reachable through
    // this primitive at all — see the delegability note above for why.
    if (!ctx.callerPersonaId) {
      return { ok: false, reasonCode: 'NO_AUTHENTICATED_PERSONA', reason: 'No active persona resolved for this caller.' };
    }
    return {
      ok: true,
      participants: {
        subjectPersonaId: ctx.callerPersonaId,
        principalPersonaId: ctx.callerPersonaId,
        actorPersonaId: ctx.callerPersonaId,
        actorKind: 'principal',
        delegateGrantRef: null,
      },
    };
  },

  async resolveAuthority(_admin, _participants) {
    // A principal converting assets in their OWN wallet needs no external
    // grant — the same "For direct principal invocation, the caller acts
    // on their own wallet" basis the design review specified. This is
    // durable/structural, not state-dependent — see resolveParticipants for
    // the (only) gate that actually matters here.
    return { result: 'VALID', basis: ['principal-owns-wallet'] };
  },

  async readPriorState(_admin, participants) {
    const state = await priorStateFor(participants.subjectPersonaId);
    return state as unknown as Record<string, unknown>;
  },

  projectConsequence(priorState, input) {
    const state = priorState as unknown as WalletAssetConvertState;
    const quote = quoteUsdcToBaseQc(input.usdcAmount);
    // No mutation, no ID assignment here — a conversionId is assigned only
    // at execute() (realizeConsequence), matching "no mutation in
    // projection": an identifier for a transaction that has not yet
    // happened is not itself a fact this pure function may assert.
    return {
      effects: [
        `USDC prior ${state.usdcBalance} -> ${state.usdcBalance - quote.usdcAmount}`,
        `BASE_QC prior ${state.baseQcBalance} -> ${state.baseQcBalance + quote.qctNet}`,
      ],
      categories: ['financial-consequential', `rate:${quote.rate}`, `feePercent:${quote.feePercent}`],
    };
  },

  authorize(_participants, _authority, priorState, _projection, input) {
    const state = priorState as unknown as WalletAssetConvertState;
    if (state.usdcBalance < input.usdcAmount) {
      // Projected-insufficient refusal — the atomic convert_wallet_asset
      // function below re-checks this under row lock regardless; this is a
      // fast, honest pre-flight refusal, never the sole enforcement.
      return {
        result: 'REFUSED',
        reasonCode: 'INSUFFICIENT_FUNDS_PROJECTED',
        reason: `Projected USDC balance (${state.usdcBalance}) is less than the requested conversion amount (${input.usdcAmount}).`,
      };
    }
    return { result: 'AUTHORIZED' };
  },

  implementationRef: IMPLEMENTATION_REF,
  implementationHash: namedBindingHash(IMPLEMENTATION_REF, VERSION),

  async execute(_admin, participants, input) {
    const quote = quoteUsdcToBaseQc(input.usdcAmount);
    const conversionId = `usdc_to_qct_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const metadata = {
      conversionId,
      rate: quote.rate,
      feePercent: quote.feePercent,
      destination: 'BASE_QC',
      usdcAmount: quote.usdcAmount,
      qctGross: quote.qctGross,
      feeQct: quote.feeQct,
      qctNet: quote.qctNet,
      onChainSettled: true,
    };

    const result = await convertWalletAsset({
      personaId: participants.subjectPersonaId,
      sourceAsset: 'USDC',
      destinationAsset: 'QCT',
      sourceAmount: quote.usdcAmount,
      destinationAmount: quote.qctNet,
      source: SOURCE_TAG,
      metadata,
    });

    if (!result.success) return { ok: false, error: result.error ?? 'Conversion failed' };

    return {
      ok: true,
      result: {
        conversionId,
        debitTxId: result.debitTxId!,
        creditTxId: result.creditTxId!,
        priorUsdcBalance: result.priorSourceBalance!,
        resultingUsdcBalance: result.resultingSourceBalance!,
        priorBaseQcBalance: result.priorDestinationBalance!,
        resultingBaseQcBalance: result.resultingDestinationBalance!,
        debitedUsdc: quote.usdcAmount,
        creditedBaseQc: quote.qctNet,
        rate: quote.rate,
        feePercent: quote.feePercent,
        feeQct: quote.feeQct,
      },
    };
  },

  resultingStateFrom(result) {
    return {
      usdcBalance: result.resultingUsdcBalance,
      baseQcBalance: result.resultingBaseQcBalance,
    };
  },

  realizeConsequence(result) {
    // Cross-referenceable with the domain ledger (services/ctp/evidence.ts's
    // own preserved invariant: the domain transaction remains the financial
    // system of record; this receipt is the constitutional transition
    // receipt, never a replacement for it).
    return {
      conversionId: result.conversionId,
      debitTxId: result.debitTxId,
      creditTxId: result.creditTxId,
      debitedUsdc: result.debitedUsdc,
      creditedBaseQc: result.creditedBaseQc,
      rate: result.rate,
      feePercent: result.feePercent,
      feeQct: result.feeQct,
    };
  },
};

registerPrimitive(walletAssetConvertPrimitive);
