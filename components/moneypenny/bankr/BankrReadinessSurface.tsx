"use client";

/**
 * BankrReadinessSurface + ProviderBindingSurface — items 1-2 of the Bankr
 * atomic-surface set (Factor + Aegis Bankr PRD, Phase 6 frontend half).
 * Both read the SAME `BankrIssuerReadiness` payload the controller hook
 * fetches from POST /api/moneypenny/factor/bankr/readiness — no component
 * here calls that route itself.
 */

import type { BankrIssuerReadiness } from "@/services/factor/bankrCapabilityHandlers";
import { BankrSection, BankrModeBadge, BankrBadge, BankrActionButton, BankrErrorNote, classifyBankrMode } from "./bankrSurfaceKit";

interface ReadinessProps {
  readiness: BankrIssuerReadiness | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

/** (1) Bankr connection/readiness status — configured vs simulated. */
export function BankrReadinessSurface({ readiness, loading, error, onRefresh }: ReadinessProps) {
  const mode = readiness ? classifyBankrMode({ configured: readiness.bankrConfigured }) : "unavailable";
  return (
    <BankrSection title="Bankr connection">
      <div className="flex flex-wrap items-center gap-2">
        <BankrModeBadge mode={mode} />
        {readiness && <BankrBadge label={readiness.ready ? "Issuer ready" : "Not ready"} tone={readiness.ready ? "good" : "warn"} />}
        <BankrActionButton label="Refresh readiness" onClick={onRefresh} busy={loading} />
      </div>
      {!readiness?.bankrConfigured && (
        <p className="text-xs text-slate-400">
          No BANKR_*_API_KEY is set for this deployment — every Bankr action runs against the deterministic fake transport, honestly marked
          &ldquo;simulated&rdquo; in every response.
        </p>
      )}
      {readiness && readiness.blockers.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-amber-200">
          {readiness.blockers.map((b, i) => (
            <li key={i}>&bull; {b}</li>
          ))}
        </ul>
      )}
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}

interface BindingProps {
  readiness: BankrIssuerReadiness | null;
  loading: boolean;
  error: string | null;
  onProvision: () => void;
}

/** (2) Provider-wallet binding — address, status, "provision" when absent. */
export function ProviderBindingSurface({ readiness, loading, error, onProvision }: BindingProps) {
  const binding = readiness?.providerWalletBinding ?? null;
  return (
    <BankrSection title="Provider-wallet binding (Bankr)">
      {binding ? (
        <div className="flex flex-col gap-1 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-2">
            <BankrBadge label={binding.status} tone={binding.status === "active" ? "good" : "bad"} />
            <span className="font-mono text-slate-400">{binding.metame_owner_wallet_address}</span>
          </div>
          {binding.provider_wallet_address && <span className="font-mono text-slate-500">provider wallet: {binding.provider_wallet_address}</span>}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">No provider-wallet binding exists yet for this agent.</p>
          <BankrActionButton label="Provision binding" onClick={onProvision} busy={loading} tone="primary" />
        </>
      )}
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}
