"use client";

/**
 * BankrTermsSurface — item 5: fee/economic terms, always showing
 * retrievedAt/sourceUrl and whether the terms are simulated. Reads from
 * EITHER a fresh preflight quote (`bankrTerms`, controller-hook state) or
 * the launch row's own frozen `bankr_terms*` columns (once recorded) —
 * whichever is present; never fabricates a value for the other.
 */

import type { TokenLaunchRow } from "@/services/factor/tokenLaunchService";
import type { BankrTokenLaunchTerms } from "@/services/financialServices/providers/bankr/bankrTypes";
import { BankrSection, BankrModeBadge, BankrProvenance, BankrActionButton, BankrErrorNote, classifyBankrMode } from "./bankrSurfaceKit";

interface Props {
  launch: TokenLaunchRow | null;
  bankrTerms: BankrTokenLaunchTerms | null;
  busy: boolean;
  error: string | null;
  onPreflight: () => void;
}

export function BankrTermsSurface({ launch, bankrTerms, busy, error, onPreflight }: Props) {
  const raw = bankrTerms?.raw ?? (launch?.bankr_terms as Record<string, unknown> | null) ?? null;
  const simulated = raw ? Boolean(raw.simulated) : undefined;
  const sourceUrl = bankrTerms?.sourceUrl ?? launch?.bankr_terms_source_url ?? null;
  const retrievedAt = bankrTerms?.retrievedAt ?? launch?.bankr_terms_retrieved_at ?? null;
  const feeBps = bankrTerms?.feeBps ?? (typeof raw?.feeBps === "number" ? (raw.feeBps as number) : null);

  return (
    <BankrSection title="Fee / economic terms">
      {raw ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <BankrModeBadge mode={classifyBankrMode({ simulated, missing: !raw })} />
            {feeBps !== null && <span className="text-xs text-slate-300">fee: {feeBps} bps</span>}
          </div>
          <BankrProvenance sourceUrl={sourceUrl} retrievedAt={retrievedAt} />
        </div>
      ) : (
        <p className="text-xs text-slate-500">No Bankr terms recorded yet — run preflight to quote them.</p>
      )}
      <BankrActionButton label="Run deterministic preflight" onClick={onPreflight} busy={busy} disabled={!launch} />
      <BankrErrorNote message={error} />
    </BankrSection>
  );
}
