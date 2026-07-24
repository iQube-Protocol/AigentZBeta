"use client";

/**
 * mySoftware — the sixth myCluster tab (PRD-MMC-IMPL-007 Phase 1 +
 * SPEC-MMC-002 §6.2 Phase 2).
 *
 * A compact mirror of the persona's OWN Developer-strand output, from two
 * sources:
 *
 *  1. Dev-loop sessions (Dev Command Center / Constitutional Development
 *     Environment, CFS-020) — composing the SAME
 *     `/api/dev-command-center/sessions?list=true` route the DCC itself
 *     calls. No new gate: persona-owned-only, no admin check.
 *  2. (Phase 2, SPEC-MMC-002 §6.2) `artifact_records` software productions
 *     the caller themselves produced — via the new `/api/artifact/records/
 *     mine` route, which filters on the T2-safe `actor_commitment` column
 *     the 20260819000000 migration added. Phase 1 could not read this table
 *     at all (every row was stamped the generic `delegate: 'operator'` with
 *     no per-persona column — PRD-MMC-IMPL-007 §0.2/§0.3); Phase 2 closes
 *     that gap for GOING-FORWARD productions only. Rows written before the
 *     migration ran keep `actor_commitment: null` and correctly never
 *     appear here — that is honest, not a bug (nothing was guessed).
 *
 * PRIMARY section (SPEC-MMC-002 §6.2 amendment, 2026-07-24 — "broaden to
 * Capability Registry"): the caller's OWN registered capabilities, via
 * `/api/constitutional/capability-registry/mine` (persona-scoped, no admin
 * gate — cross-references the caller's own `capability_registered` receipts
 * against the registry). This exists because most real capability work never
 * touches `dev_loop_sessions` or `artifact_records` at all — it ships as
 * ordinary feature development — so those two sources alone under-represent
 * "software I've built." A capability only appears here once someone has
 * actually run `registerCapability()` for it (Constitutional Acceptance,
 * CFS-032 §4) — registration is a real ceremony, not automatic on shipping;
 * this section is not a substitute for that step, only its display surface.
 *
 * Deep links (SPEC-MMC-002 §6.2 bullet 5): every card links back into
 * aigentZ → Command Center. THIS IS AN IN-CARTRIDGE TAB SWITCH, not a
 * cross-cartridge navigation — mySoftware and Command Center are both tabs
 * of the SAME `metame` codex (`data/codex-configs.ts`'s `agentz` and
 * `mycluster` groups). The correct mechanism is the existing
 * `codex:navigate-tab` CustomEvent (`CodexPanelDynamic.tsx`'s handler,
 * already used by e.g. `LockerTab.tsx`) — dispatching it swaps the active
 * tab in place with no page reload. An earlier version of this file used
 * `buildCodexUrl()` + a plain `<a href>`, which (a) is the CROSS-cartridge
 * mechanism (every other real usage in this repo targets a DIFFERENT codex
 * slug — see `AlphaProgrammeTab.tsx`), so using it here forced a full page
 * navigation that looked like the app "popping out"; and (b) pointed at
 * `tab: 'dev-command-center'`, which is not a tab slug that exists on the
 * `metame` codex at all — metaMe's own Command Center mirror has
 * `slug: 'aigent-z'` (`data/codex-configs.ts`, id
 * `metame-agentz-command-center`; `'dev-command-center'` is a DIFFERENT
 * top-level codex's tab). Both bugs are fixed below.
 *
 * The Command Center (`DevCommandCenterTab.tsx`) hydrates only the caller's
 * MOST RECENT session on mount — it has no `sessionId` resume affordance
 * today, so this still honestly lands on Command Center generally, not a
 * specific past session. `artifact_records` rows have no originating
 * Builder/Studio surface wired yet either — they link to the same tab as
 * the closest reasonable destination, not a fabricated more-specific one.
 *
 * Phase 3 (SPEC-MMC-002 §6.3, 2026-07-24) — Core actions on registered-
 * capability cards. Every action below either (a) flips a pure status/
 * lifecycle field + writes a receipt, or (b) forms/proposes something a
 * human must separately act on in the browser. None executes code, pushes a
 * commit, or deploys anything — D1 (CFS-016) stays exactly as written.
 *
 *  - Archive → `POST /api/constitutional/capability-registry/mine`
 *    `{ action: 'archive' }` — the route re-derives ownership server-side
 *    (never trusts the client) before flipping `lifecycle_state` to
 *    'deprecated' and writing a `capability_deprecated` receipt.
 *  - Test → same route, `{ action: 'test', evidence }` — calls the
 *    PRE-EXISTING `recordOperationalValidation` (unchanged), now reachable
 *    by the capability's own registrant rather than only an admin.
 *  - Deploy → calls the PRE-EXISTING, D1-safe
 *    `POST /api/constitutional/deployment-proposal` directly (admin-gated,
 *    unchanged) — this UI is only a caller of that ceremony, never a second
 *    implementation of it. The operator supplies the real packId/commitRange
 *    (never fabricated); the route only ever creates a PROPOSAL receipt —
 *    "review the chain, then push manually" per its own D1 semantics.
 *  - Delegate → composes the PRE-EXISTING `constitutionalAgreement.ts`
 *    primitive via `/api/constitutional/agreement`: "Propose delegation"
 *    does `form` + `accept` (the agent's own side) in one click; a
 *    SEPARATE, distinctly-labelled "Authorize" button — mirroring
 *    `RuntimePanel.tsx`'s reviewed form/accept/authorize precedent — is the
 *    only code path that calls the agreement route's authorize action, and
 *    it only ever fires on an explicit human click in this browser. No code
 *    path here calls it automatically.
 *
 * Run / Publish / Share are NOT built this pass — see the module's
 * companion doc (`codexes/packs/agentiq/updates/`) and SPEC-MMC-002 §6.3 for
 * why: no existing D1-safe "run" ceremony exists to compose; `Publish` has
 * no state transition to perform (`registerCapability` already sets
 * `published` immediately); no clean persona-to-persona capability-sharing
 * primitive was found. Forcing any of the three would mean inventing new
 * execution/authority machinery from scratch — exactly what this pass was
 * told not to do.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Code, Loader2, RefreshCw, ExternalLink, Package, Archive, FlaskConical, Rocket, UserCog } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { STAGE_ORDER, getStageLabel } from "@/services/devCommandCenter/devLoop";
import type { DevLoopStage, DevLoopReceipt, DevReceiptClass } from "@/types/devCommandCenter";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface DevLoopSessionSummary {
  sessionId: string;
  stage: DevLoopStage;
  title: string;
  startedAt: string;
  updatedAt: string;
  receipts: DevLoopReceipt[];
}

interface SessionsListResponse {
  sessions?: DevLoopSessionSummary[];
  error?: string;
}

/** Mirrors app/api/constitutional/capability-registry/mine/route.ts's MyCapabilitySummary. */
interface MyCapabilitySummary {
  capabilityId: string;
  displayLabel: string;
  description: string | null;
  standing: number;
  standingBand: string;
  lifecycleState: string;
  reuseDisposition: string | null;
  briefUrl: string | null;
  packId: string | null;
  registeredReceiptId: string | null;
  createdAt: string;
}

interface MyCapabilityRegistryResponse {
  capabilities?: MyCapabilitySummary[];
  error?: string;
}

/** Mirrors app/api/artifact/records/mine/route.ts's MySoftwareArtifactSummary. */
interface MySoftwareArtifactSummary {
  artifactId: string;
  profile: string;
  consequenceClass: string;
  title: string;
  brief: string;
  artefactType: string | null;
  runtimeHost: string | null;
  permissions: unknown;
  contentHashPrefix: string;
  receiptId: string | null;
  createdAt: string;
}

interface ArtifactRecordsMineResponse {
  records?: MySoftwareArtifactSummary[];
  error?: string;
}

// ── Phase 3 (SPEC-MMC-002 §6.3) — action wiring types ───────────────────────

/** The delegate agent every "Delegate" proposal names — the system
 *  orchestrator (CLAUDE.md "System Model"), the same ref already used as
 *  `agentsInvoked: ['aigent-z']` throughout capabilityRegistry.ts's receipts. */
const DELEGATE_AGENT_REF = "aigent-z";

/** Deterministic, idempotent agreement id per capability — re-forming with
 *  the same id is a no-op per `formAgreement`'s own idempotency contract. */
function delegationAgreementIdFor(capabilityId: string): string {
  return `agr-cap-${capabilityId}-${DELEGATE_AGENT_REF}`;
}

/** Mirrors constitutionalAgreement.ts's ConstitutionalAgreementRow — only
 *  the fields this tab reads. */
interface AgreementSummary {
  agreementId: string;
  status: string;
  capabilityRef: string | null;
  selectedAgentRef: string | null;
}

interface AgreementListResponse {
  ok?: boolean;
  agreements?: AgreementSummary[];
  error?: string;
}

interface DeployFields {
  packId: string;
  commitRange: string;
  goal: string;
  validationNotes: string;
  touchesProtectedFiles: boolean;
}

/** Per-capability transient UI state for the four Phase 3 actions. Keyed by
 *  capabilityId. Not persisted — Archive/Test/Deploy/Delegate results are
 *  reflected via `note` strings and (for Delegate) the agreement status
 *  loaded from the server, never invented client state. */
interface CapabilityActionState {
  archiveConfirming?: boolean;
  archiveBusy?: boolean;
  archiveNote?: string | null;
  testOpen?: boolean;
  testEvidence?: string;
  testBusy?: boolean;
  testNote?: string | null;
  deployOpen?: boolean;
  deployFields?: DeployFields;
  deployBusy?: boolean;
  deployNote?: string | null;
  delegateBusy?: boolean;
  delegateNote?: string | null;
  delegateStatus?: string | null;
}

function stageTone(stage: DevLoopStage): string {
  if (stage === "complete") return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
  if (stage === "deployment_authorization" || stage === "consequence_validation" || stage === "remediation") {
    return "text-amber-400 border-amber-500/40 bg-amber-500/10";
  }
  return "text-slate-400 border-slate-700 bg-slate-800/40";
}

function receiptClassCounts(receipts: DevLoopReceipt[]): Record<DevReceiptClass, number> {
  const counts: Record<DevReceiptClass, number> = { development: 0, constitutional: 0, deployment: 0 };
  for (const r of receipts) counts[r.class] = (counts[r.class] ?? 0) + 1;
  return counts;
}

/** Best-effort match: a session's generated pack may carry the same packId
 *  as one of the caller's own registered capabilities. No FK exists — this
 *  is a display-only correlation, never a hard join, and never blocks
 *  rendering when it can't be found. */
function findMatchingCapability(
  session: DevLoopSessionSummary,
  capabilities: MyCapabilitySummary[],
): MyCapabilitySummary | null {
  if (capabilities.length === 0) return null;
  const sessionText = JSON.stringify(session);
  return capabilities.find((c) => c.packId && sessionText.includes(c.packId)) ?? null;
}

interface Props {
  personaId?: string;
  isAdmin?: boolean;
}

/** In-cartridge tab switch to aigentZ → Command Center (SPEC-MMC-002 §6.2
 *  bullet 5) — see the module header for why this is a `codex:navigate-tab`
 *  dispatch (no page reload) at the `aigent-z` slug, not a `buildCodexUrl`
 *  href (that's the cross-cartridge mechanism, and pointed at a slug this
 *  codex doesn't have). Mirrors `LockerTab.tsx`'s existing usage. */
function navigateToCommandCenter(e: React.MouseEvent) {
  e.preventDefault();
  window.dispatchEvent(new CustomEvent("codex:navigate-tab", { detail: { tab: "aigent-z" } }));
}

/** Same mechanism, targeting myLedger (`slug: 'my-ledger'` — already correct
 *  on this codex, unlike Command Center's slug). */
function navigateToMyLedger(e: React.MouseEvent) {
  e.preventDefault();
  window.dispatchEvent(new CustomEvent("codex:navigate-tab", { detail: { tab: "my-ledger" } }));
}

export function MySoftwareTab({ personaId, isAdmin }: Props) {
  const [sessions, setSessions] = useState<DevLoopSessionSummary[] | null>(null);
  const [capabilities, setCapabilities] = useState<MyCapabilitySummary[]>([]);
  const [artifactRecords, setArtifactRecords] = useState<MySoftwareArtifactSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Phase 3 (SPEC-MMC-002 §6.3) — per-capability action state, keyed by
  // capabilityId. `patchAction` merges a partial patch for one capability
  // without disturbing the others.
  const [actionState, setActionState] = useState<Record<string, CapabilityActionState>>({});
  const patchAction = useCallback((capabilityId: string, patch: CapabilityActionState) => {
    setActionState((prev) => ({ ...prev, [capabilityId]: { ...prev[capabilityId], ...patch } }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await personaFetch("/api/dev-command-center/sessions?list=true", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      const json = (await res.json()) as SessionsListResponse;
      if (!res.ok || json?.error) {
        setError(json?.error || `request failed (${res.status})`);
        setSessions(null);
      } else {
        setSessions(json.sessions ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load dev-loop sessions");
      setSessions(null);
    } finally {
      setLoading(false);
    }

    // Phase 2 (SPEC-MMC-002 §6.2): the caller's own attributable
    // artifact_records software productions. Best-effort — a failure here
    // (e.g. migration not yet applied, or a transient network error) never
    // blocks the dev-loop session list above from rendering; it just leaves
    // this section empty, exactly as the capability-registry enrichment
    // below already degrades.
    try {
      const recRes = await personaFetch("/api/artifact/records/mine", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      if (recRes.ok) {
        const recJson = (await recRes.json()) as ArtifactRecordsMineResponse;
        setArtifactRecords(recJson.records ?? []);
      }
    } catch {
      /* best-effort only */
    }

    // PRIMARY section (SPEC-MMC-002 §6.2 amendment): the caller's own
    // registered capabilities. No admin gate — persona-scoped. Best-effort:
    // a failure here never blocks the dev-loop session list from rendering.
    try {
      const capRes = await personaFetch("/api/constitutional/capability-registry/mine", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      if (capRes.ok) {
        const capJson = (await capRes.json()) as MyCapabilityRegistryResponse;
        setCapabilities(capJson.capabilities ?? []);
      }
    } catch {
      /* best-effort only */
    }

    // Phase 3 (SPEC-MMC-002 §6.3) — reflect any Delegate agreement already
    // formed/accepted/authorized in a PRIOR visit, so re-opening the tab
    // never loses that state. Best-effort: a failure here only means the
    // Delegate section starts fresh, never blocks anything above.
    try {
      const agrRes = await personaFetch("/api/constitutional/agreement", {
        personaIdHint: personaId,
        cache: "no-store",
      });
      if (agrRes.ok) {
        const agrJson = (await agrRes.json()) as AgreementListResponse;
        const rows = agrJson.agreements ?? [];
        setActionState((prev) => {
          const next = { ...prev };
          for (const row of rows) {
            if (!row.capabilityRef || row.selectedAgentRef !== DELEGATE_AGENT_REF) continue;
            const existing = next[row.capabilityRef];
            // listAgreements() orders newest-first; keep the first (latest) match.
            if (existing?.delegateStatus) continue;
            next[row.capabilityRef] = { ...existing, delegateStatus: row.status };
          }
          return next;
        });
      }
    } catch {
      /* best-effort only */
    }
  }, [personaId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Archive — a pure lifecycle status-flag flip + receipt ────────────────
  const handleArchiveConfirm = useCallback(
    async (capabilityId: string) => {
      patchAction(capabilityId, { archiveBusy: true, archiveNote: null });
      try {
        const res = await personaFetch("/api/constitutional/capability-registry/mine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", capabilityId }),
          personaIdHint: personaId,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          patchAction(capabilityId, {
            archiveBusy: false,
            archiveConfirming: false,
            archiveNote: `archive failed: ${json?.error ?? res.status}`,
          });
          return;
        }
        patchAction(capabilityId, { archiveBusy: false, archiveConfirming: false, archiveNote: "Archived." });
        await load();
      } catch (e) {
        patchAction(capabilityId, {
          archiveBusy: false,
          archiveConfirming: false,
          archiveNote: e instanceof Error ? e.message : "archive failed",
        });
      }
    },
    [personaId, patchAction, load],
  );

  // ── Test — operational validation; the evidence field IS the ceremony ────
  const handleTestSubmit = useCallback(
    async (capabilityId: string) => {
      const evidence = (actionState[capabilityId]?.testEvidence ?? "").trim();
      if (evidence.length < 10) {
        patchAction(capabilityId, { testNote: "evidence must be at least 10 characters — describe what you observed working" });
        return;
      }
      patchAction(capabilityId, { testBusy: true, testNote: null });
      try {
        const res = await personaFetch("/api/constitutional/capability-registry/mine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test", capabilityId, evidence }),
          personaIdHint: personaId,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          patchAction(capabilityId, { testBusy: false, testNote: `test failed: ${json?.error ?? res.status}` });
          return;
        }
        patchAction(capabilityId, {
          testBusy: false,
          testOpen: false,
          testEvidence: "",
          testNote: `Recorded — standing ${Number(json.standingBefore).toFixed(2)} → ${Number(json.standingAfter).toFixed(2)}.`,
        });
        await load();
      } catch (e) {
        patchAction(capabilityId, { testBusy: false, testNote: e instanceof Error ? e.message : "test failed" });
      }
    },
    [personaId, actionState, patchAction, load],
  );

  // ── Deploy — calls the EXISTING D1-safe /api/constitutional/deployment-
  //    proposal ceremony directly; this tab is only a caller, never a second
  //    implementation. Admin-gated server-side (unchanged) — the form is
  //    shown only when `isAdmin` (optimistic; the server re-enforces
  //    regardless, per CLAUDE.md's Inter-Cartridge Navigation rule).
  const handleDeploySubmit = useCallback(
    async (capabilityId: string) => {
      const fields = actionState[capabilityId]?.deployFields;
      if (!fields?.packId?.trim() || !fields?.commitRange?.trim()) {
        patchAction(capabilityId, { deployNote: "packId and commitRange are both required" });
        return;
      }
      patchAction(capabilityId, { deployBusy: true, deployNote: null });
      try {
        const res = await personaFetch("/api/constitutional/deployment-proposal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packId: fields.packId.trim(),
            commitRange: fields.commitRange.trim(),
            goal: fields.goal?.trim() || undefined,
            validationNotes: fields.validationNotes?.trim() || undefined,
            touchesProtectedFiles: fields.touchesProtectedFiles === true,
          }),
          personaIdHint: personaId,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          patchAction(capabilityId, { deployBusy: false, deployNote: `propose failed: ${json?.error ?? res.status}` });
          return;
        }
        patchAction(capabilityId, {
          deployBusy: false,
          deployOpen: false,
          deployNote: `Proposal recorded (ref ${json.deployment?.ref ?? "?"}, state ${json.deployment?.state ?? "proposed"}). ${json.d1Semantics ?? ""}`,
        });
      } catch (e) {
        patchAction(capabilityId, { deployBusy: false, deployNote: e instanceof Error ? e.message : "propose failed" });
      }
    },
    [personaId, actionState, patchAction],
  );

  // ── Delegate — propose-only. "Propose delegation" does form+accept (the
  //    delegate agent's own side) in one click; Authorize is a SEPARATE,
  //    distinctly-labelled button a human must click separately — mirroring
  //    RuntimePanel.tsx's reviewed form/accept/authorize precedent. This
  //    function never invokes the authorize action itself — that call site
  //    lives only in handleAuthorizeDelegation below, fired solely by an
  //    explicit human click.
  const handleProposeDelegation = useCallback(
    async (cap: MyCapabilitySummary) => {
      const capabilityId = cap.capabilityId;
      const agreementId = delegationAgreementIdFor(capabilityId);
      patchAction(capabilityId, { delegateBusy: true, delegateNote: null });
      try {
        const formRes = await personaFetch("/api/constitutional/agreement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "form",
            agreementId,
            displayLabel: `Delegate: ${cap.displayLabel}`,
            capabilityRef: capabilityId,
            selectedAgentRef: DELEGATE_AGENT_REF,
            delegatedAuthority: {
              band: "L2",
              allowedActions: ["knowledge_retrieval", "analysis"],
              forbiddenActions: ["transfer"],
              allowedSurfaces: ["mysoftware"],
              ttlHours: 8,
              maxActions: 5,
              valueCeiling: null,
            },
            governingInvariants: ["SPEC-MMC-002"],
          }),
          personaIdHint: personaId,
        });
        const formJson = await formRes.json().catch(() => null);
        if (!formRes.ok || !formJson?.ok) {
          patchAction(capabilityId, { delegateBusy: false, delegateNote: `propose failed: ${formJson?.error ?? formRes.status}` });
          return;
        }
        const acceptRes = await personaFetch("/api/constitutional/agreement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept", agreementId, acceptorType: "agent", acceptorId: DELEGATE_AGENT_REF }),
          personaIdHint: personaId,
        });
        const acceptJson = await acceptRes.json().catch(() => null);
        if (!acceptRes.ok || !acceptJson?.ok) {
          patchAction(capabilityId, {
            delegateBusy: false,
            delegateNote: `accept failed: ${acceptJson?.error ?? acceptRes.status}`,
          });
          return;
        }
        patchAction(capabilityId, {
          delegateBusy: false,
          delegateStatus: acceptJson.agreement?.status ?? "accepted",
          delegateNote: "Proposed and accepted. A human must separately click Authorize below — nothing here does that automatically.",
        });
      } catch (e) {
        patchAction(capabilityId, { delegateBusy: false, delegateNote: e instanceof Error ? e.message : "propose failed" });
      }
    },
    [personaId, patchAction],
  );

  // The ONLY call site for the agreement route's authorize action in this
  // file — fires exclusively on this explicit human button click, never chained from
  // handleProposeDelegation above.
  const handleAuthorizeDelegation = useCallback(
    async (capabilityId: string) => {
      const agreementId = delegationAgreementIdFor(capabilityId);
      patchAction(capabilityId, { delegateBusy: true });
      try {
        const res = await personaFetch("/api/constitutional/agreement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "authorize", agreementId }),
          personaIdHint: personaId,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          patchAction(capabilityId, { delegateBusy: false, delegateNote: `authorize failed: ${json?.error ?? res.status}` });
          return;
        }
        patchAction(capabilityId, {
          delegateBusy: false,
          delegateStatus: json.agreement?.status ?? "authorized",
          delegateNote: "Authorized — delegated execution may now proceed under this agreement.",
        });
      } catch (e) {
        patchAction(capabilityId, { delegateBusy: false, delegateNote: e instanceof Error ? e.message : "authorize failed" });
      }
    },
    [personaId, patchAction],
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">mySoftware</h2>
          <span className="text-xs text-slate-500">Your Developer-strand builds — aigentZ Command Center</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/40 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* PRIMARY (SPEC-MMC-002 §6.2 amendment): the caller's own registered
         capabilities — full item-model detail where the registry has it.
         Renders above the process-level sections below, since this is the
         actual "software I've built" answer for anything that shipped
         outside the narrow DCC/softwarePilot pipeline. Empty when the
         caller has registered nothing yet — not an error, just nothing to
         show (registration is a real ceremony, see module header). */}
      {capabilities.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] uppercase font-semibold text-slate-500">
            My registered capabilities
          </div>
          {capabilities.map((cap) => (
            <div
              key={cap.capabilityId}
              className="flex flex-col gap-1.5 rounded border border-violet-500/30 bg-violet-500/[0.04] px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">{cap.displayLabel}</span>
                <div className="flex items-center gap-1.5">
                  <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                    {cap.standingBand}
                  </span>
                  <span className="rounded border border-slate-700 bg-slate-800/40 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {cap.lifecycleState}
                  </span>
                </div>
              </div>
              {cap.description && <p className="text-[11px] text-slate-400">{cap.description}</p>}
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Registered {new Date(cap.createdAt).toLocaleDateString()}
                  {cap.reuseDisposition ? ` · ${cap.reuseDisposition}` : ""}
                </span>
                <div className="flex items-center gap-3">
                  {cap.briefUrl && (
                    cap.briefUrl.startsWith("http") ? (
                      <a
                        href={cap.briefUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-400 hover:text-violet-300"
                      >
                        Read the brief
                      </a>
                    ) : (
                      <span className="font-mono text-slate-600" title={cap.briefUrl}>
                        {cap.briefUrl.split("/").pop()}
                      </span>
                    )
                  )}
                  {cap.registeredReceiptId && (
                    <a href="#" onClick={navigateToMyLedger} className="text-slate-400 hover:text-slate-300">
                      Inspect receipt
                    </a>
                  )}
                </div>
              </div>

              {/* Phase 3 (SPEC-MMC-002 §6.3) — Core actions. Archive/Test/
                 Deploy are hidden once a capability is already deprecated
                 (nothing left to archive/test/deploy on a terminal
                 lifecycle); Delegate stays available (a deprecated
                 capability can still be referenced in a bounded-delegation
                 agreement, and the toggle carries no execution risk). */}
              {cap.lifecycleState !== "deprecated" && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-1.5">
                  <button
                    onClick={() => patchAction(cap.capabilityId, { archiveConfirming: true })}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/70"
                  >
                    <Archive className="h-3 w-3" /> Archive
                  </button>
                  <button
                    onClick={() => patchAction(cap.capabilityId, { testOpen: !actionState[cap.capabilityId]?.testOpen })}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/70"
                  >
                    <FlaskConical className="h-3 w-3" /> Test
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() =>
                        patchAction(cap.capabilityId, {
                          deployOpen: !actionState[cap.capabilityId]?.deployOpen,
                          deployFields: actionState[cap.capabilityId]?.deployFields ?? {
                            packId: cap.packId ?? cap.capabilityId,
                            commitRange: "",
                            goal: cap.displayLabel,
                            validationNotes: "",
                            touchesProtectedFiles: false,
                          },
                        })
                      }
                      className="flex items-center gap-1 rounded border border-amber-700/50 bg-amber-900/20 px-2 py-0.5 text-[11px] text-amber-300 hover:bg-amber-900/40"
                    >
                      <Rocket className="h-3 w-3" /> Deploy
                    </button>
                  )}
                  <button
                    onClick={() => void handleProposeDelegation(cap)}
                    disabled={actionState[cap.capabilityId]?.delegateBusy}
                    className="flex items-center gap-1 rounded border border-violet-700/50 bg-violet-900/20 px-2 py-0.5 text-[11px] text-violet-300 hover:bg-violet-900/40 disabled:opacity-50"
                  >
                    <UserCog className="h-3 w-3" /> Delegate
                  </button>
                </div>
              )}

              {/* Archive confirm — canonical ConfirmDialog primitive. */}
              <ConfirmDialog
                open={!!actionState[cap.capabilityId]?.archiveConfirming}
                title="Archive capability"
                description={`Archive "${cap.displayLabel}"? Its lifecycle moves to 'deprecated' — a status flip, not a delete. This is receipted and reversible only by re-registration, never silently.`}
                confirmText={actionState[cap.capabilityId]?.archiveBusy ? "Archiving…" : "Archive"}
                onConfirm={() => void handleArchiveConfirm(cap.capabilityId)}
                onCancel={() => patchAction(cap.capabilityId, { archiveConfirming: false })}
              />
              {actionState[cap.capabilityId]?.archiveNote && (
                <div className="text-[11px] text-slate-400">{actionState[cap.capabilityId]?.archiveNote}</div>
              )}

              {/* Test — inline evidence field; this IS the ceremony (a human
                 typing what they observed working), never a bare click. */}
              {actionState[cap.capabilityId]?.testOpen && (
                <div className="flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-950/40 p-2">
                  <textarea
                    value={actionState[cap.capabilityId]?.testEvidence ?? ""}
                    onChange={(e) => patchAction(cap.capabilityId, { testEvidence: e.target.value })}
                    placeholder="What did you observe working in production? (≥ 10 characters — this is the operational evidence, not a formality)"
                    rows={2}
                    className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleTestSubmit(cap.capabilityId)}
                      disabled={actionState[cap.capabilityId]?.testBusy}
                      className="rounded border border-emerald-700/50 bg-emerald-900/20 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
                    >
                      {actionState[cap.capabilityId]?.testBusy ? "Submitting…" : "Submit test evidence"}
                    </button>
                    <button
                      onClick={() => patchAction(cap.capabilityId, { testOpen: false })}
                      className="text-[11px] text-slate-500 hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {actionState[cap.capabilityId]?.testNote && (
                <div className="text-[11px] text-slate-400">{actionState[cap.capabilityId]?.testNote}</div>
              )}

              {/* Deploy — D1-safe PROPOSAL only. The operator supplies the
                 real packId/commitRange; nothing here fabricates them. */}
              {isAdmin && actionState[cap.capabilityId]?.deployOpen && (
                <div className="flex flex-col gap-1.5 rounded border border-amber-900/40 bg-amber-950/20 p-2">
                  <input
                    value={actionState[cap.capabilityId]?.deployFields?.packId ?? ""}
                    onChange={(e) =>
                      patchAction(cap.capabilityId, {
                        deployFields: { ...(actionState[cap.capabilityId]?.deployFields as DeployFields), packId: e.target.value },
                      })
                    }
                    placeholder="packId (required)"
                    className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                  />
                  <input
                    value={actionState[cap.capabilityId]?.deployFields?.commitRange ?? ""}
                    onChange={(e) =>
                      patchAction(cap.capabilityId, {
                        deployFields: { ...(actionState[cap.capabilityId]?.deployFields as DeployFields), commitRange: e.target.value },
                      })
                    }
                    placeholder="commit range (required, e.g. abc123..def456)"
                    className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                  />
                  <input
                    value={actionState[cap.capabilityId]?.deployFields?.validationNotes ?? ""}
                    onChange={(e) =>
                      patchAction(cap.capabilityId, {
                        deployFields: { ...(actionState[cap.capabilityId]?.deployFields as DeployFields), validationNotes: e.target.value },
                      })
                    }
                    placeholder="validation notes (optional, one per line)"
                    className="rounded border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-200 placeholder:text-slate-600"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={actionState[cap.capabilityId]?.deployFields?.touchesProtectedFiles ?? false}
                      onChange={(e) =>
                        patchAction(cap.capabilityId, {
                          deployFields: {
                            ...(actionState[cap.capabilityId]?.deployFields as DeployFields),
                            touchesProtectedFiles: e.target.checked,
                          },
                        })
                      }
                    />
                    Touches protected files
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleDeploySubmit(cap.capabilityId)}
                      disabled={actionState[cap.capabilityId]?.deployBusy}
                      className="rounded border border-amber-700/50 bg-amber-900/30 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-900/50 disabled:opacity-50"
                    >
                      {actionState[cap.capabilityId]?.deployBusy ? "Proposing…" : "Propose deployment (D1 — proposal only)"}
                    </button>
                    <button
                      onClick={() => patchAction(cap.capabilityId, { deployOpen: false })}
                      className="text-[11px] text-slate-500 hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {actionState[cap.capabilityId]?.deployNote && (
                <div className="text-[11px] text-slate-400">{actionState[cap.capabilityId]?.deployNote}</div>
              )}

              {/* Delegate status + the SEPARATE Authorize button. Authorize
                 only ever fires on this explicit click — see the module
                 header and handleAuthorizeDelegation's own comment. */}
              {(actionState[cap.capabilityId]?.delegateStatus || actionState[cap.capabilityId]?.delegateNote) && (
                <div className="flex flex-col gap-1 rounded border border-violet-900/40 bg-violet-950/10 p-2 text-[11px]">
                  {actionState[cap.capabilityId]?.delegateStatus && (
                    <span className="text-violet-300">
                      Delegation agreement status: <span className="font-mono">{actionState[cap.capabilityId]?.delegateStatus}</span>
                    </span>
                  )}
                  {actionState[cap.capabilityId]?.delegateNote && (
                    <span className="text-slate-400">{actionState[cap.capabilityId]?.delegateNote}</span>
                  )}
                  {actionState[cap.capabilityId]?.delegateStatus === "accepted" && (
                    <div>
                      <button
                        onClick={() => void handleAuthorizeDelegation(cap.capabilityId)}
                        disabled={actionState[cap.capabilityId]?.delegateBusy}
                        className="rounded border border-emerald-700/50 bg-emerald-900/20 px-2 py-0.5 text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-50"
                        title="Only a human should click this — it opens delegated execution under this agreement"
                      >
                        {actionState[cap.capabilityId]?.delegateBusy ? "Authorizing…" : "Authorize (human step)"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && !sessions && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your dev-loop sessions...
        </div>
      )}

      {error && (
        <div className="rounded border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {sessions && (
        <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">In-progress builds</div>
          {sessions.length === 0 && (
            <div className="text-xs text-slate-500">
              No dev-loop sessions yet. Start one in aigentZ → Command Center.
            </div>
          )}
          {sessions.map((session) => {
            const counts = receiptClassCounts(session.receipts);
            const stageIdx = STAGE_ORDER.indexOf(session.stage);
            const capability = findMatchingCapability(session, capabilities);
            return (
              <div
                key={session.sessionId}
                className="flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{session.title}</span>
                    {capability && (
                      <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                        {capability.standingBand}
                      </span>
                    )}
                  </div>
                  <span className={`rounded border px-2 py-0.5 text-[11px] ${stageTone(session.stage)}`}>
                    {getStageLabel(session.stage)}
                    {stageIdx >= 0 ? ` (${stageIdx + 1}/${STAGE_ORDER.length})` : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Started {new Date(session.startedAt).toLocaleDateString()} · Updated{" "}
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </span>
                  <span>
                    {counts.development} development · {counts.constitutional} constitutional ·{" "}
                    {counts.deployment} deployment
                  </span>
                </div>
                <a
                  href="#"
                  onClick={navigateToCommandCenter}
                  className="flex w-fit items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300"
                >
                  Continue in Command Center
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Phase 2 (SPEC-MMC-002 §6.2) — the caller's own artifact_records
         software productions, now attributable via actor_commitment. An
         additional section, not a replacement: dev-loop-session cards above
         are unchanged. Rows produced before the 20260819000000 migration ran
         simply never appear (actor_commitment: null, correctly excluded —
         see the module header). Renders nothing (not even an empty-state
         line) when there are none, so a persona with zero productions today
         sees exactly the Phase 1 experience. */}
      {artifactRecords.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
          <div className="text-[10px] uppercase font-semibold text-slate-500">
            Produced software artifacts
          </div>
          {artifactRecords.map((record) => (
            <div
              key={record.artifactId}
              className="flex flex-col gap-1.5 rounded border border-slate-800 bg-slate-900/40 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-sm font-medium text-slate-200">{record.title}</span>
                  {record.artefactType && (
                    <span className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                      {record.artefactType}
                    </span>
                  )}
                </div>
                <span className="rounded border border-slate-700 bg-slate-800/40 px-2 py-0.5 text-[11px] text-slate-400">
                  {record.consequenceClass}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Created {new Date(record.createdAt).toLocaleDateString()}
                  {record.runtimeHost ? ` · ${record.runtimeHost}` : ""}
                </span>
                <span className="font-mono">{record.contentHashPrefix}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <a
                  href="#"
                  onClick={navigateToCommandCenter}
                  className="flex items-center gap-1 text-violet-400 hover:text-violet-300"
                >
                  Continue in Command Center
                </a>
                {record.receiptId && (
                  <a
                    href="#"
                    onClick={navigateToMyLedger}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-300"
                  >
                    Inspect receipt {record.receiptId.slice(0, 10)}…
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
        <ExternalLink className="h-3 w-3" />
        Build your own software in aigentZ → Command Center. Capabilities appear above once someone
        registers them into the Capability Registry (Constitutional Acceptance, CFS-032 §4) — shipping
        code alone doesn't add it here.
      </div>
    </div>
  );
}

export default MySoftwareTab;
