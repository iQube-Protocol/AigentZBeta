"use client";

/**
 * WorkspaceCapabilitiesPanel — the Workspace Overview's role-projected
 * capability cards (2026-09-08, IRL OS Workspace consolidation).
 *
 * GENERALISED AROUND THE CANONICAL WORKSPACE, never a hardcoded EXP-P1/OCSGA
 * exception (operator instruction: "Austin/EXP-P1 and Ian/OCSGA are the
 * acceptance cases, not hardcoded exceptions" — restated, second pass:
 * "experimentId [is] one possible binding rather than a prerequisite").
 * Every section below renders per `GET /api/participation/workspace-
 * capabilities`'s own capability flags — never a per-workspace/per-experiment
 * `if` branch in this file. Two kinds of section:
 *   - EXPERIMENT-BOUND (Experimental Readiness, Reviewer Kit & Protocol,
 *     Review & Countersignature) — only when the workspace names a
 *     registered `EXPERIMENT_REGISTRY` entry AND the caller separately holds
 *     a grant scoped to it. Today only EXP-P1 qualifies for all three — a
 *     fact about what exists, not a special case in this component.
 *   - WORKSPACE-BOUND (Reciprocal Artifact Exchange) — keyed directly off
 *     `workspaceId`, no `experimentId` required at all. OCSGA qualifies for
 *     this one, and only this one, today.
 *
 * COMPOSITION, NOT A NEW VIEWER: "Experimental Readiness" mounts the
 * existing `ExpP1ReadinessTab` (now reachable to a scoped reviewer, not just
 * admin — see the loosened gate on `/api/research/readiness/[experimentId]`).
 * "Reviewer Kit & Protocol" reads the SAME already-authorized
 * `/api/codex/packs/irl/file` route the Phase 2 scoped-reviewer restoration
 * (2026-09-08) opened up, rendered inline (never a browser-tab download) so
 * the reviewer never has to leave the cartridge. "Review & Countersignature"
 * mounts the existing `ReviewerAgreementPanel`. "Reciprocal Artifact
 * Exchange" mounts the existing, already-generic `IRLExchangeTab`.
 *
 * Fail-closed by composition: every fetch here goes through `personaFetch`
 * to routes that independently re-verify the caller's grant server-side —
 * this component renders nothing it cannot actually back with a real,
 * server-checked read (Security invariant: "an experiment/artifact must
 * never be advertised unless the same principal can dereference it").
 */

import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, ChevronDown, ChevronRight, FileText, FlaskConical, Gauge, Loader2, Microscope, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { personaFetch } from "@/utils/personaSpine";
import { ReviewerAgreementPanel } from "@/components/research/ReviewerAgreementPanel";
import { Track2StateSummary } from "@/components/research/Track2StateSummary";
import { EXPERIMENT_REGISTRY } from "@/types/research";

const ExpP1ReadinessTab = dynamic(() => import("@/components/composer/ExpP1ReadinessTab"), {
  ssr: false,
  loading: () => <span className="text-[10px] text-slate-400">Loading readiness…</span>,
});

// Instrument Validation (IRV-001 / IPV-001) — the SAME component the
// Laboratory mounts (InvariantExperimentLab.tsx), which is already inherently
// review-safe: it only ever reads the published, spine-gated
// `/api/experiments/results` record — it has no run/rerun control at all
// (reruns happen via the CLI harness, by design; see the component's own
// header). No reviewerMode/capability prop is needed here for that reason.
const InstrumentValidationPanel = dynamic(() => import("@/components/composer/InstrumentValidationPanel"), {
  ssr: false,
  loading: () => <span className="text-[10px] text-slate-400">Loading instrument validation…</span>,
});

// Crystal + Independent Review — the canonical reviewer-facing projection
// already built for the Validation Programme journey's `crystal-review`
// stage (composes `IndependentReviewPanel reviewerMode` + the self-service
// Observer Review decision submission). Reused as-is, never forked.
const CrystalObserverReviewPanel = dynamic(() => import("@/components/composer/CrystalObserverReviewPanel"), {
  ssr: false,
  loading: () => <span className="text-[10px] text-slate-400">Loading Crystal &amp; Independent Review…</span>,
});

// Reciprocal Artifact Exchange (PRD-IRL-AX-001) — the WORKSPACE-BOUND
// capability (2026-09-08, generalization pass): keyed directly off
// workspaceId via `parentExperimentId`, never requires an `experimentId`
// binding. Reuses the SAME generic tab every other exchange entrance mounts
// (IRLExchangeTab.tsx's own header: "not architecture- or OCSGA-specific") —
// no fork, just scoped via its existing `workspaceScopeId` prop.
const IRLExchangeTab = dynamic(
  () => import("@/app/triad/components/codex/tabs/IRLExchangeTab").then((m) => ({ default: m.IRLExchangeTab })),
  { ssr: false, loading: () => <span className="text-[10px] text-slate-400">Loading exchange…</span> },
);

export interface WorkspaceDocument {
  path: string;
  url: string;
}

interface CapabilitiesPayload {
  experimentId: string | null;
  documents: WorkspaceDocument[];
  readinessAvailable: boolean;
  reviewAgreementAvailable: boolean;
  instrumentValidationAvailable: boolean;
  track2Available: boolean;
  crystalAvailable: boolean;
  independentReviewAvailable: boolean;
  /** The ordinary-ladder rung this caller holds at this experiment
   *  (`resolveEffectiveExperimentCapability`) — 'admin' for a platform
   *  admin, otherwise the highest of run/write/review this persona's
   *  capability rows grant, or 'read' with none. Never inferred from which
   *  sections happen to be visible — it is returned by the server so the
   *  badge below can never say something the gate itself would refuse. */
  effectiveCapability: "read" | "review" | "write" | "run" | "admin";
  exchangeAvailable: boolean;
}

const CAPABILITY_BADGE: Record<CapabilitiesPayload["effectiveCapability"], { label: string; className: string }> = {
  read: { label: "Read access", className: "border-slate-700 bg-slate-800/60 text-slate-300" },
  review: { label: "Review access", className: "border-violet-500/40 bg-violet-500/10 text-violet-200" },
  write: { label: "Write access", className: "border-amber-500/40 bg-amber-500/10 text-amber-200" },
  run: { label: "Run access", className: "border-blue-500/40 bg-blue-500/10 text-blue-200" },
  admin: { label: "Administrator", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" },
};

type CapabilitiesState =
  | { kind: "loading" }
  | { kind: "ready"; data: CapabilitiesPayload }
  | { kind: "denied" }
  | { kind: "error" };

export interface WorkspaceCapabilitiesPanelProps {
  workspaceId: string;
  personaId?: string;
}

const PANEL = "rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm";

export function DocumentRow({
  doc,
  autoOpen,
  highlighted,
}: {
  doc: WorkspaceDocument;
  /** Auto-expand on mount — the navigation contract's `selectedArtifactId`
   *  (message 3 item 9) landed here: the caller navigated to THIS document
   *  specifically, so it opens without a second click. */
  autoOpen?: boolean;
  /** Visual marker for the same navigated-to document — distinct from
   *  `autoOpen` because a caller could highlight without forcing content to
   *  load, though every current use passes both together. */
  highlighted?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    setOpen((prev) => !prev);
    if (!open && content === null && !loading) {
      setLoading(true);
      try {
        const res = await personaFetch(doc.url, { cache: "no-store" });
        setContent(res.ok ? await res.text() : `Could not load this document (HTTP ${res.status}).`);
      } catch (e) {
        setContent(e instanceof Error ? e.message : "Could not load this document.");
      } finally {
        setLoading(false);
      }
    }
  }, [open, content, loading, doc.url]);

  // Load content immediately when auto-opened — `toggle`'s own lazy-load
  // only fires from a click, so a navigated-to document would otherwise
  // render expanded but empty until the caller clicked it again.
  useEffect(() => {
    if (autoOpen) void toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`rounded-lg border bg-slate-900/40 ${highlighted ? "border-violet-500/50 ring-1 ring-violet-500/30" : "border-slate-800"}`}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-800/40"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        <FileText className="h-3.5 w-3.5 shrink-0 text-violet-300" />
        <span className="truncate">{doc.path}</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto border-t border-slate-800 px-3 py-2">
          {loading ? (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </span>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-300">{content}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkspaceCapabilitiesPanel({ workspaceId, personaId }: WorkspaceCapabilitiesPanelProps) {
  const [state, setState] = useState<CapabilitiesState>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    (async () => {
      try {
        const res = await personaFetch(
          `/api/participation/workspace-capabilities?workspaceId=${encodeURIComponent(workspaceId)}`,
          { cache: "no-store" },
        );
        if (!alive) return;
        if (res.status === 403) {
          setState({ kind: "denied" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        const data = (await res.json()) as CapabilitiesPayload & { ok: boolean };
        setState({ kind: "ready", data });
      } catch {
        if (alive) setState({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  if (state.kind === "loading") {
    return (
      <div className={`${PANEL} p-4 text-xs text-slate-500`}>
        <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" /> Checking experiment capabilities…
      </div>
    );
  }
  if (state.kind === "denied" || state.kind === "error") {
    // Honest absence, never a broken-looking card — a workspace this caller
    // cannot open should simply show nothing extra here (the workspace
    // itself is already entitlement-filtered upstream in "My Experiments").
    return null;
  }
  const { data } = state;
  if (
    !data.exchangeAvailable &&
    data.documents.length === 0 &&
    !data.readinessAvailable &&
    !data.reviewAgreementAvailable &&
    !data.instrumentValidationAvailable &&
    !data.track2Available &&
    !data.crystalAvailable &&
    !data.independentReviewAvailable
  ) {
    return null;
  }
  const badge = CAPABILITY_BADGE[data.effectiveCapability];

  return (
    <div className="space-y-3">
      {data.experimentId && (
        <div className="flex items-center justify-end">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>
      )}
      {data.exchangeAvailable && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ArrowLeftRight className="h-4 w-4 text-violet-300" /> Reciprocal Artifact Exchange
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Frozen/exchanged architecture artifacts for this workspace — the same canonical exchange surface,
            scoped to exchanges you are a party to or that anyone with access to this workspace may view.
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
            <IRLExchangeTab workspaceScopeId={workspaceId} />
          </div>
        </div>
      )}
      {data.readinessAvailable && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Gauge className="h-4 w-4 text-violet-300" /> Experimental Readiness
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            PRD-EPI-001 §10 — the same readiness sections the Laboratory dashboard shows an admin, scoped to your
            own reviewer grant for {data.experimentId}.
          </p>
          <div className="mt-3">
            <ExpP1ReadinessTab personaId={personaId} />
          </div>
        </div>
      )}
      {data.documents.length > 0 && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FileText className="h-4 w-4 text-violet-300" /> Reviewer Kit &amp; Protocol
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            The registered protocol and reviewer documentation for {data.experimentId} — read inline, never a
            browser-tab download.
          </p>
          <div className="mt-3 space-y-1.5">
            {data.documents.map((doc) => (
              <DocumentRow key={doc.path} doc={doc} />
            ))}
          </div>
        </div>
      )}
      {data.reviewAgreementAvailable && data.experimentId && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> Review &amp; Countersignature
          </h3>
          <div className="mt-3">
            <ReviewerAgreementPanel experimentId={data.experimentId} />
          </div>
        </div>
      )}
      {data.instrumentValidationAvailable && data.experimentId && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FlaskConical className="h-4 w-4 text-emerald-300" /> Instrument Validation
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            IRV-001 Resolution Validation and IPV-001 Projection Validation — the same completed, published
            record-run evidence the Laboratory shows, read from the canonical published results.
          </p>
          <div className="mt-3 space-y-4">
            {(["IRV-001", "IPV-001"] as const).map((expId) => {
              const reg = EXPERIMENT_REGISTRY.find((e) => e.id === expId);
              return (
                <InstrumentValidationPanel
                  key={expId}
                  experimentId={expId}
                  family={reg?.family ?? expId}
                  hypothesis={reg?.hypothesis ?? ""}
                  protocolRef={reg?.protocolRef}
                />
              );
            })}
          </div>
        </div>
      )}
      {data.track2Available && data.experimentId && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Gauge className="h-4 w-4 text-violet-300" /> Track 2 Programme
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Read-only projection of the same Track 2 state the Laboratory tracks. Grooming, promotion and
            reconciliation remain Laboratory/steward operations.
          </p>
          <div className="mt-3">
            <Track2StateSummary experimentId={data.experimentId} />
          </div>
        </div>
      )}
      {data.crystalAvailable && data.independentReviewAvailable && data.experimentId && (
        <div className={`${PANEL} p-4`}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Microscope className="h-4 w-4 text-violet-300" /> Crystal &amp; Independent Review
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            The frozen Crystal — readiness, statistics, freeze recommendation, provenance and receipts — plus
            the Autonomi Independent Review Programme's Observer Review round for {data.experimentId}. You may
            inspect the frozen substrate and submit your own review decision; the Crystal itself is immutable
            here, as everywhere.
          </p>
          <div className="mt-3">
            <CrystalObserverReviewPanel experimentId={data.experimentId} />
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceCapabilitiesPanel;
