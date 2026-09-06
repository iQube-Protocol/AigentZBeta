"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

/**
 * "Freeze Crystal vP2 for internal EXP-P1 run" — the governed internal-pilot
 * freeze act, exposed as ONE independent, self-contained component (operator
 * ruling, 2026-09-06: "Frozen generations are immutable; Crystal lineages are
 * evolutionary"; and the 2026-09-07 UI/orchestration repair: "Track 2 is
 * allowed to say science still has limitations. It is not allowed to hide a
 * separately authorized lifecycle act.").
 *
 * ── WHY THIS IS ITS OWN COMPONENT, NEVER NESTED INSIDE Track2ProgrammePanel's
 *    stage list ──────────────────────────────────────────────────────────────
 *
 * The freeze act's eligibility is a fact about the Crystal artifact's OWN
 * lifecycle (`validated`, not yet `frozen`) plus the operator's own prior
 * authorization (internal-pilot). It is NOT a fact about `loadTrack2ProgrammeState`
 * — the heavy, multi-signal composition (readiness + cohort reconciliation +
 * acquisition-pending-decision) that the Track 2 dot-strip and stage list
 * depend on, and which can legitimately take long enough to hit its own 15s
 * safety budget (`STATE_COMPOSITION_DEADLINE_MS`,
 * services/research/researchProgrammeOrchestrator.ts). Nesting the freeze
 * control inside `{programme && (...)}` (`programme` being the product of
 * THAT composition) meant a slow or failed composition silently hid an
 * independently-ready governed act — exactly the defect this component fixes.
 *
 * Every read this component performs is on the FAST, independent path:
 *   - `GET  /api/research/crystal/[experimentId]/freeze` — `getArtifactById`
 *     only (services/research/artifacts.ts). No Track 2 composition.
 *   - `POST /api/research/crystal/[experimentId]/freeze-preview` —
 *     `runFreezeCeremonyPreview` (services/research/crystalFreezeCeremony.ts),
 *     which computes `runCrystalReadinessReport`/`runCrystalStatisticsReport`
 *     directly and NEVER imports `loadTrack2ProgrammeState`. The embedded
 *     `package.recommendation.readiness.checks` is where this component reads
 *     the live failing scientific-readiness checks — never from a `readiness`
 *     prop threaded down from Track2ProgrammePanel's own (slow) state.
 *
 * Nothing is typed in by the operator: `signedBy`/`operatorRef` is resolved
 * from the admin's own session (`/api/wallet/active-persona` +
 * `/api/wallet/identity/references`); `contentHash` and the ratified boundary
 * come from the freeze-preview package; `scientificDeviations` is derived
 * live from that SAME package's embedded readiness report. ONE explicit
 * operator confirmation performs the only write this component ever makes.
 *
 * A failed REFRESH (this component's own fast reads can still time out or
 * hiccup) never clears already-good data — mirrors
 * `IRLResearchCopilotTab.tsx`'s own "never clear an already-loaded preview"
 * discipline. An honest, small "could not refresh — retry" note is shown
 * alongside whatever was last successfully observed, never in place of it.
 */

interface FreezeCheck {
  name: string;
  detail: string;
}

interface BoundaryView {
  boundary: string;
}

interface FrozenView {
  frozenAt: string | null;
  contentHash: string | null;
  signedBy: string[];
  receiptId: string | null;
  nextGovernedAction: { label: string; detail: string } | null;
}

interface ReadyToFreezeView {
  operatorRef: string;
  contentHash: string;
  boundary: BoundaryView | null;
  failingChecks: FreezeCheck[];
}

type Phase =
  | { kind: "loading" }
  | { kind: "not-eligible" }
  | { kind: "ready"; data: ReadyToFreezeView }
  | { kind: "frozen"; data: FrozenView };

const FREEZE_RATIONALE =
  "Crystal vP2 is frozen as the immutable substrate for an internal EXP-P1 experimental run. It contains 63 " +
  "externally grounded, validated and distinct invariants and satisfies the registered selection-space " +
  "requirement. Its measured limitations in derivational structure and declared-boundary coverage are " +
  "preserved as properties of this generation. Findings from the internal run may motivate corpus expansion " +
  "in a successor Crystal generation; vP2 itself will remain immutable.";

export function FreezeVP2InternalPilotAction({
  experimentId,
  onFrozen,
}: {
  experimentId: string;
  /** Optional, fire-and-forget — lets a host panel (e.g. Track2ProgrammePanel)
   *  soft-refresh its own cosmetic state after a freeze. Never awaited, and
   *  this component's own correctness never depends on it running. */
  onFrozen?: () => void;
}) {
  const crystalId = `${experimentId}/crystal-vP2`;

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [refreshErr, setRefreshErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const artRes = await personaFetch(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze?crystalId=${encodeURIComponent(crystalId)}`,
        { cache: "no-store" },
      );
      const artBody = await artRes.json().catch(() => null);
      if (!artBody?.requestSucceeded) {
        throw new Error(artBody?.error || `could not read the artifact (HTTP ${artRes.status})`);
      }
      const artifact = artBody.artifact as {
        lifecycle: string;
        frozenAt: string | null;
        contentHash: string | null;
        signedBy: string[];
        receiptId: string | null;
      } | null;

      if (artifact?.lifecycle === "frozen") {
        setPhase({
          kind: "frozen",
          data: {
            frozenAt: artifact.frozenAt,
            contentHash: artifact.contentHash,
            signedBy: artifact.signedBy,
            receiptId: artifact.receiptId,
            nextGovernedAction: (artBody.nextGovernedAction as { label: string; detail: string } | null) ?? null,
          },
        });
        setRefreshErr(null);
        return;
      }

      if (artifact?.lifecycle !== "validated") {
        setPhase({ kind: "not-eligible" });
        setRefreshErr(null);
        return;
      }

      // Who is signing — resolved, never typed. Same pattern as the wallet
      // Identity panel (`PersonaReferencesInventory.tsx`): active persona ->
      // that persona's own T2-safe `publicRef` in the identity inventory.
      const activeRes = await personaFetch("/api/wallet/active-persona", { cache: "no-store" });
      const activeBody = await activeRes.json().catch(() => null);
      const activePersonaId = activeBody?.personaId as string | undefined;
      if (!activePersonaId) throw new Error("could not resolve the signed-in admin's active persona");

      const refsRes = await personaFetch("/api/wallet/identity/references", { cache: "no-store" });
      const refsBody = await refsRes.json().catch(() => null);
      const personas = Array.isArray(refsBody?.personas) ? refsBody.personas : [];
      const operatorRef = personas.find((p: { personaId?: string }) => p?.personaId === activePersonaId)?.publicRef as
        | string
        | undefined;
      if (!operatorRef) throw new Error("could not resolve the signed-in admin's own T2-safe reference");

      // contentHash + the ratified boundary + the LIVE failing scientific-
      // readiness checks — all from ONE fast, Track-2-composition-independent
      // call. `execution`/`preconditions` on this response is deliberately
      // ignored: that verdict is confirmatory-only and always reads as
      // blocked while readiness fails, which is exactly the state this
      // internal-pilot act exists for.
      const previewRes = await personaFetch(
        `/api/research/crystal/${encodeURIComponent(experimentId)}/freeze-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operatorRef, freezeRationale: FREEZE_RATIONALE, ratifiedAt: new Date().toISOString() }),
        },
      );
      const previewBody = await previewRes.json().catch(() => null);
      if (!previewBody?.ok) {
        throw new Error(previewBody?.error || `could not build the freeze package (HTTP ${previewRes.status})`);
      }
      const pkg = previewBody.package as {
        contentHash: string;
        recommendation: { readiness: { checks: Array<{ name: string; tier: string; passed: boolean; detail: string }> } };
      };
      const failingChecks = pkg.recommendation.readiness.checks
        .filter((c) => c.tier === "scientific-readiness" && !c.passed)
        .map((c) => ({ name: c.name, detail: c.detail }));
      const boundary = previewBody.ratifiedBoundary as BoundaryView | null;

      setPhase({ kind: "ready", data: { operatorRef, contentHash: pkg.contentHash, boundary, failingChecks } });
      setRefreshErr(null);
    } catch (e) {
      // Never clear already-good data on a failed refresh — an honest "could
      // not refresh" note stands alongside the last observation, exactly
      // like IRLResearchCopilotTab's own preview discipline.
      setRefreshErr(e instanceof Error ? e.message : "could not refresh the freeze state");
    }
  }, [experimentId, crystalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = useCallback(async () => {
    if (phase.kind !== "ready") return;
    const { operatorRef, contentHash, failingChecks } = phase.data;
    if (failingChecks.length === 0) return;
    setBusy(true);
    setConfirmErr(null);
    try {
      const res = await personaFetch(`/api/research/crystal/${encodeURIComponent(experimentId)}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "freeze",
          crystalId,
          confirm: true,
          contentHash,
          signedBy: [operatorRef],
          freezeRationale: FREEZE_RATIONALE,
          boundaryAcknowledged: true,
          executionDesignation: "internal-pilot",
          scientificDeviations: failingChecks.map((c) => ({ checkName: c.name, rationale: FREEZE_RATIONALE })),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!d?.requestSucceeded) {
        throw new Error(
          [d?.error, d?.currentContentHash ? `current: ${d.currentContentHash}` : null].filter(Boolean).join(" — ") ||
            `the freeze was refused (HTTP ${res.status})`,
        );
      }
      await load();
      try {
        onFrozen?.();
      } catch {
        /* cosmetic only — never lets a host's own refresh failure affect this component */
      }
    } catch (e) {
      setConfirmErr(e instanceof Error ? e.message : "the freeze was refused");
    } finally {
      setBusy(false);
    }
  }, [phase, experimentId, crystalId, load, onFrozen]);

  const memberCountLabel = useMemo(() => "63-member generation", []);

  if (phase.kind === "loading") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Reading the Crystal vP2 lifecycle state…
      </div>
    );
  }

  if (phase.kind === "not-eligible") {
    return null;
  }

  if (phase.kind === "frozen") {
    const { data } = phase;
    return (
      <div className="mt-2 space-y-1.5 rounded border border-emerald-900/60 bg-emerald-950/20 p-2 text-[11px] text-emerald-100">
        <div className="flex items-center gap-1.5 font-medium text-emerald-200">
          <Lock className="h-3.5 w-3.5" /> Crystal vP2 — frozen (internal/pilot)
        </div>
        <div className="space-y-0.5 text-emerald-200/80">
          <div>Frozen at <span className="text-emerald-100">{data.frozenAt ?? "—"}</span></div>
          <div>Receipt <span className="font-mono text-emerald-100">{data.receiptId ?? "not recorded"}</span></div>
        </div>
        {data.nextGovernedAction && (
          <div className="rounded border border-slate-800 bg-slate-950/60 p-2 text-slate-300">
            <span className="font-medium text-slate-200">Next governed action:</span> {data.nextGovernedAction.label}
            <div className="mt-1 text-slate-500">{data.nextGovernedAction.detail}</div>
          </div>
        )}
        {refreshErr && <div className="text-amber-300/80">Last refresh could not confirm this is still current — {refreshErr}.</div>}
      </div>
    );
  }

  const { data } = phase;
  return (
    <div className="mt-2 space-y-2 rounded border border-violet-900/50 bg-violet-950/10 p-2 text-[11px]">
      <div className="font-medium text-violet-200">Freeze Crystal vP2 for internal EXP-P1 run</div>
      <div className="text-slate-400">
        {memberCountLabel} · executionDesignation <span className="font-mono text-violet-200">internal-pilot</span> —
        an explicit, operator-authorized internal/pilot freeze, never a confirmatory result. The measured
        scientific-readiness limitations below are preserved exactly as observed, never marked passed.
      </div>

      <ul className="space-y-0.5">
        {data.failingChecks.length === 0 && (
          <li className="text-amber-200">
            No currently-failing scientific-readiness check remains — an internal-pilot designation has nothing
            to deviate over; use the confirmatory freeze once readiness completes.
          </li>
        )}
        {data.failingChecks.map((c) => (
          <li key={c.name} className="text-amber-200">
            ○ {c.name} — recorded limitation — {c.detail}
          </li>
        ))}
      </ul>

      <div className="rounded border border-slate-800 bg-slate-950 p-2 text-slate-300">{FREEZE_RATIONALE}</div>

      {data.boundary && (
        <div className="rounded border border-slate-700 bg-slate-950 p-2 text-slate-500">
          Ratified domain boundary — <span className="text-slate-300">{data.boundary.boundary}</span>
        </div>
      )}

      <div className="text-slate-500">
        Signed by <span className="font-mono text-slate-300">{data.operatorRef}</span> · content commitment{" "}
        <span className="font-mono text-slate-300">{data.contentHash.slice(0, 24)}…</span>
      </div>

      {refreshErr && <div className="text-amber-300/80">Last refresh could not confirm this is still current — {refreshErr}.</div>}
      {confirmErr && <div className="rounded border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-200">{confirmErr}</div>}

      <button
        onClick={() => void confirm()}
        disabled={busy || data.failingChecks.length === 0}
        className="flex items-center gap-1 rounded border border-violet-800 bg-violet-900/30 px-2.5 py-1 text-violet-200 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />} Confirm: Freeze Crystal
        vP2 for internal EXP-P1 run
      </button>
    </div>
  );
}
