"use client";

/**
 * useArchitectDraft — the ONE state+logic implementation behind MoneyPenny
 * Architect (PRD-MPY-001 Phase 3), shared by the full cartridge component
 * (app/(shell)/moneypenny/components/ArchitectPanel.tsx) and the compact
 * wallet re-skin (app/components/wallet/MoneyPennyWalletArchitect.tsx).
 *
 * Extracted 2026-08-06: both surfaces had hand-copied the identical
 * intent/busy/result/invariantStatements state and draft()/tooltip-loading
 * logic — exactly the "one fact, two owners" defect class CLAUDE.md's
 * source-of-truth-parity rule calls out. It also blocked the operator's
 * actual ask ("the full screen modal is not getting the active inference and
 * conversation injected into it"): keeping each surface's state independently
 * preserved (2026-08-06 state-loss fix) stops either from being WIPED on
 * expand/collapse, but never made them the SAME conversation. A host that
 * mounts both surfaces together (SmartWalletDrawer's Architect viewport) now
 * calls this hook ONCE and passes the single resulting `state` to both via
 * their optional `sharedState` prop — one intent box, one result, one set of
 * invariant tooltips, visible in both compact and expanded form. Callers that
 * render only one surface (the standalone /moneypenny page, MoneyPennyCartridge)
 * pass no `sharedState` and each component falls back to calling this hook
 * itself — unchanged, uncontrolled behaviour.
 */

import { useCallback, useEffect, useState } from "react";
import { personaFetch } from "@/utils/personaSpine";

export interface ArchitectResult {
  ok: boolean;
  error?: string;
  artifactId?: string;
  title?: string;
  body?: string;
  citedInvariantIds?: string[];
}

export interface ArchitectDraftState {
  intent: string;
  setIntent: (value: string) => void;
  busy: boolean;
  result: ArchitectResult | null;
  invariantStatements: Record<string, string>;
  draft: () => Promise<void>;
}

export function useArchitectDraft(personaIdHint?: string | null): ArchitectDraftState {
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ArchitectResult | null>(null);
  // id -> statement, for the invariant pills' tooltips. Loaded once per
  // result via the single-invariant route (GET /api/invariants/[id]) — never
  // a second, hand-maintained description list.
  const [invariantStatements, setInvariantStatements] = useState<Record<string, string>>({});

  const draft = useCallback(async () => {
    if (!intent.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await personaFetch("/api/moneypenny/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
        personaIdHint: personaIdHint || undefined,
      });
      const data = (await res.json().catch(() => null)) as ArchitectResult | null;
      setResult(data ?? { ok: false, error: `Draft failed (HTTP ${res.status})` });
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Draft failed" });
    } finally {
      setBusy(false);
    }
  }, [intent, busy, personaIdHint]);

  const citedIds = result?.ok ? result.citedInvariantIds ?? [] : [];
  const loadInvariantStatement = useCallback(
    async (id: string) => {
      if (invariantStatements[id] !== undefined) return;
      try {
        const res = await personaFetch(`/api/invariants/${encodeURIComponent(id)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        setInvariantStatements((prev) => ({
          ...prev,
          [id]: res.ok && data?.invariant?.statement ? String(data.invariant.statement) : "Detail unavailable",
        }));
      } catch {
        setInvariantStatements((prev) => ({ ...prev, [id]: "Detail unavailable" }));
      }
    },
    [invariantStatements],
  );
  // Pre-fetch every cited invariant's statement once the result lands, so the
  // tooltip has content on first hover rather than an initial "Loading…" flash.
  useEffect(() => {
    citedIds.forEach((id) => void loadInvariantStatement(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.artifactId]);

  return { intent, setIntent, busy, result, invariantStatements, draft };
}
