"use client";

/**
 * IRLExchangeTab — Reciprocal Artifact Exchange (PRD-IRL-AX-001).
 *
 * A GENERIC surface for the reciprocal-exchange primitive — not
 * architecture- or OCSGA-specific. Renders: the caller's own exchanges,
 * and (once one is selected) Purpose / Parties / Your Artifact /
 * Counterparty Artifact [LOCKED/AVAILABLE] / Freeze Declaration / Exchange
 * Instrument / Crossing / Receipt / Comparison / Lineage — the full
 * workflow named in PRD §14, so a participant can understand it from the
 * UI alone.
 *
 * All reads/writes go through /api/research/exchanges via `personaFetch`
 * (spine-aware — never raw `fetch`, per CLAUDE.md's Identity & Access
 * Spine rule) and are re-enforced server-side in every case; nothing here
 * is a client-side-only gate.
 *
 * GAP THIS TAB STANDS IN FOR: CFS-044's Research Spaces (a personal
 * container of engagements per participant) are PROPOSED, not built — see
 * the forensic audit in the session report. This tab is therefore a
 * first-class cartridge tab rather than a card inside a not-yet-existing
 * personal Space; the exchange record itself is the engagement surface.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
  Unlock,
  Users,
  ClipboardCheck,
  GitBranch,
  MessageSquare,
} from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";

/**
 * Reciprocal Artifact Exchange focus contract (semantic repair, 2026-08-25).
 *
 * OCSGA's five Journey stages (create-deposit, freeze-attestation-ready,
 * freeze-attestation, exchange-ready, exchange-complete) all mount this SAME
 * component/API/actions — never five separate workflow components. Each
 * stage passes a distinct `?focus=` value (services/journey/
 * ianBoundaryResearchJourney.ts's per-stage `surfaces[].props.focus`,
 * threaded through JourneyRunSurface -> buildEmbedSurfaceSrc ->
 * CodexNavOptions.focus) naming which section of THIS canonical surface is
 * most relevant right now.
 *
 * PRESENTATION ONLY: `focus` scrolls to and visually foregrounds the
 * relevant panel(s) and de-emphasizes the rest — it never disables a
 * button, hides an action, or changes what is authorized. A visitor who
 * opens this tab directly (no `focus` param) sees every panel at full
 * emphasis, exactly as before this contract existed.
 */
type ExchangeFocus = "artifact" | "review" | "freeze" | "instrument" | "crossing";

const FOCUS_PANEL_TITLES: Record<ExchangeFocus, string[]> = {
  artifact: ["Parties", "Deposit your artifact"],
  review: ["Freeze Declaration"],
  freeze: ["Freeze Declaration"],
  instrument: ["Exchange Instrument"],
  crossing: ["Crossing", "Exchange Receipt"],
};

function isExchangeFocus(value: string | null): value is ExchangeFocus {
  return value === "artifact" || value === "review" || value === "freeze" || value === "instrument" || value === "crossing";
}

// ─── Types (mirror types/reciprocalExchange.ts's wire shape) ────────────────

interface ExchangeSummary {
  id: string;
  title: string;
  purpose: string;
  status: string;
  disclosurePolicy: string;
  createdAt: string;
}

interface ArtifactView {
  id: string | null;
  title: string | null;
  artifactClass: string | null;
  version: number | null;
  contentHash: string | null;
  sourceReference: string | null;
  storageReference: string | null;
  repositoryCommit: string | null;
  depositedAt: string | null;
  frozen: boolean;
  signed: boolean;
  locked: boolean;
  lockedReason: string | null;
  /**
   * OCSGA Bridge projection fix (2026-08-29) — true while this artifact was
   * registered operator-assisted and the bound principal has not yet
   * confirmed it (confirmOperatorAssistedArtifact,
   * services/research/reciprocalExchange.ts). Mirrors
   * ExchangeArtifactView.pendingPrincipalAttestation server-side exactly —
   * never re-derived client-side. Deliberately omits WHO registered it
   * (registeringOperatorPersonaId is a T0 identifier, CLAUDE.md's Identity &
   * Access Spine — server-internal only, never serialised to the client).
   */
  pendingPrincipalAttestation: boolean;
}

interface ExchangeReceiptView {
  humanReadableSummary: string;
  crossedAt: string;
  partyAFingerprint: string | null;
  partyBFingerprint: string | null;
}

interface ComparisonView {
  id: string;
  status: string;
}

interface DerivativeView {
  id: string;
  title: string;
  description: string;
  classification: string | null;
  compatibilityKind: string | null;
}

interface ExchangeViewPayload {
  exchange: {
    id: string;
    title: string;
    purpose: string;
    permittedPurpose: string;
    status: string;
    disclosurePolicy: string;
    confidentialityClass: string;
    ownershipDeclaration: string;
    initiatorRef: string;
    counterpartyRef: string | null;
    createdAt: string;
  };
  viewerParty: "A" | "B";
  yourArtifact: ArtifactView | null;
  counterpartyArtifact: ArtifactView | null;
  receipt: ExchangeReceiptView | null;
  comparison: ComparisonView | null;
  derivatives: DerivativeView[];
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  A_DEPOSITED: "Awaiting invitation",
  INVITED: "Invitation open",
  B_JOINED: "Counterparty joined",
  B_DEPOSITED: "Both deposited",
  READY_TO_SIGN: "Ready to sign",
  A_SIGNED: "One signature recorded",
  B_SIGNED: "One signature recorded",
  EXCHANGED: "Exchanged — disclosed",
  RECEIPT_ACKNOWLEDGED: "Receipt acknowledged",
  COMPARISON_OPEN: "Comparison open",
  COMPLETED: "Completed",
  DECLINED: "Declined",
  WITHDRAWN_PRE_EXCHANGE: "Withdrawn",
  ARTIFACT_REPLACEMENT_REQUIRED: "Artifact replacement required",
  SIGNATURE_EXPIRED: "Signature expired",
  DISPUTED: "Disputed",
  REVOKED_ACCESS_POST_EXCHANGE: "Access revoked",
};

function Panel({
  title,
  icon: Icon,
  children,
  emphasize = false,
  dim = false,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  /** Journey-focus foregrounding (2026-08-25) — presentational only, see the focus contract note above. */
  emphasize?: boolean;
  /** Journey-focus de-emphasis — opacity only, never removes or disables anything. */
  dim?: boolean;
}) {
  return (
    <div
      data-panel-title={title}
      className={`rounded-2xl border p-5 transition-opacity ${
        emphasize ? "border-violet-500/60 bg-violet-950/20 ring-1 ring-violet-500/30" : "border-slate-800 bg-slate-900/40"
      } ${dim ? "opacity-60" : ""}`}
      style={{ backdropFilter: "blur(16px) saturate(140%)" }}
    >
      <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5 text-violet-400" /> {title}
      </h3>
      <div className="mt-3 text-sm text-slate-200">{children}</div>
    </div>
  );
}

function ArtifactCard({ label, artifact }: { label: string; artifact: ArtifactView | null }) {
  if (!artifact) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-4 text-[13px] text-slate-500">
        {label}: not yet deposited.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-200">{label}</span>
        {artifact.locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            <Lock className="h-3 w-3" /> LOCKED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            <Unlock className="h-3 w-3" /> AVAILABLE
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-100">{artifact.title}</p>
      <p className="text-[11px] text-slate-500">
        {artifact.artifactClass} · v{artifact.version} · {artifact.frozen ? "frozen" : "not yet frozen"} ·{" "}
        {artifact.signed ? "signed" : "not yet signed"}
      </p>
      {artifact.pendingPrincipalAttestation ? (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
          Registered on your behalf by an operator, on your authorization — awaiting your confirmation below before
          it can be frozen or signed.
        </p>
      ) : null}
      {artifact.locked ? (
        <p className="mt-2 text-[11px] text-amber-300/90">{artifact.lockedReason}</p>
      ) : (
        <div className="mt-2 space-y-1 text-[11px] text-slate-400">
          {artifact.contentHash ? <p>fingerprint: {artifact.contentHash.slice(0, 24)}…</p> : null}
          {artifact.sourceReference ? <p className="truncate">source: {artifact.sourceReference}</p> : null}
          {artifact.repositoryCommit ? <p>commit: {artifact.repositoryCommit.slice(0, 12)}</p> : null}
        </div>
      )}
    </div>
  );
}

export function IRLExchangeTab() {
  const [list, setList] = useState<ExchangeSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<ExchangeViewPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawInviteCode, setRawInviteCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  // Reciprocal Artifact Exchange focus contract (2026-08-25) — see the
  // module-level doc comment. `null` (no param, or an unrecognized value)
  // means "no focus" — every panel renders at full emphasis, unchanged from
  // before this contract existed.
  const searchParams = useSearchParams();
  const rawFocus = searchParams.get("focus");
  const focus = isExchangeFocus(rawFocus) ? rawFocus : null;
  const relevantTitles = useMemo(() => new Set(focus ? FOCUS_PANEL_TITLES[focus] : []), [focus]);
  const scrolledForFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focus || !view) return;
    const key = `${selectedId ?? ""}:${focus}`;
    if (scrolledForFocusRef.current === key) return;
    scrolledForFocusRef.current = key;
    const titles = FOCUS_PANEL_TITLES[focus];
    for (const title of titles) {
      const el = document.querySelector(`[data-panel-title="${CSS.escape(title)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }, [focus, view, selectedId]);

  // Per-panel focus props — no focus active means no dimming at all (byte-
  // for-byte the pre-focus-contract look for a visitor who opens this tab
  // directly, e.g. from the Records & Findings tab, with no `focus` param).
  const panelFocusProps = useCallback(
    (title: string) => (focus ? { emphasize: relevantTitles.has(title), dim: !relevantTitles.has(title) } : {}),
    [focus, relevantTitles],
  );

  const loadList = useCallback(async () => {
    try {
      const res = await personaFetch("/api/research/exchanges", { cache: "no-store" });
      const data = await res.json();
      setList(data?.exchanges ?? []);
    } catch {
      setList([]);
    }
  }, []);

  const loadView = useCallback(async (id: string) => {
    try {
      const res = await personaFetch(`/api/research/exchanges/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setView(data.view);
      else setError(data?.error ?? "Could not load this exchange.");
    } catch {
      setError("Could not load this exchange.");
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadView(selectedId);
  }, [selectedId, loadView]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await personaFetch(`/api/research/exchanges/${selectedId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? `Action "${action}" failed.`);
      } else if (action === "invite" && data.rawCode) {
        setRawInviteCode(data.rawCode);
      }
      await loadView(selectedId);
      await loadList();
    } finally {
      setBusy(false);
    }
  }

  async function joinByCode() {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await personaFetch("/api/research/exchanges/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const data = await res.json();
      if (!data?.ok) {
        setError(data?.error ?? "Could not join with that code.");
      } else {
        setJoinCode("");
        await loadList();
        if (data?.view?.exchange?.id) setSelectedId(data.view.exchange.id);
      }
    } finally {
      setBusy(false);
    }
  }

  if (selectedId && view) {
    const { exchange, viewerParty, yourArtifact, counterpartyArtifact, receipt, comparison, derivatives } = view;
    const yourLabel = viewerParty === "A" ? "Your artifact (Party A)" : "Your artifact (Party B)";
    const cpLabel = viewerParty === "A" ? "Counterparty artifact (Party B)" : "Counterparty artifact (Party A)";
    const crossed = ["EXCHANGED", "RECEIPT_ACKNOWLEDGED", "COMPARISON_OPEN", "COMPLETED", "REVOKED_ACCESS_POST_EXCHANGE"].includes(
      exchange.status,
    );

    return (
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        <button
          onClick={() => {
            setSelectedId(null);
            setView(null);
            setRawInviteCode(null);
          }}
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All exchanges
        </button>

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-violet-400">Reciprocal Artifact Exchange</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">{exchange.title}</h1>
          <span className="mt-2 inline-block rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-0.5 text-[11px] text-violet-200">
            {STATUS_LABEL[exchange.status] ?? exchange.status}
          </span>
        </div>

        {error ? <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">{error}</p> : null}

        <Panel title="Purpose" icon={FileText} {...panelFocusProps("Purpose")}>
          <p>{exchange.purpose}</p>
          <p className="mt-1 text-[11px] text-slate-500">Permitted purpose: {exchange.permittedPurpose}</p>
        </Panel>

        <Panel title="Parties" icon={Users} {...panelFocusProps("Parties")}>
          <p className="text-[13px]">
            Party A: <span className="text-slate-100">{exchange.initiatorRef}</span>
            {viewerParty === "A" ? " (you)" : ""}
          </p>
          <p className="text-[13px]">
            Party B:{" "}
            <span className="text-slate-100">{exchange.counterpartyRef ?? "not yet joined"}</span>
            {viewerParty === "B" ? " (you)" : ""}
          </p>
          {!exchange.counterpartyRef && viewerParty === "A" ? (
            <div className="mt-3 space-y-2">
              <button
                disabled={busy}
                onClick={() => act("invite")}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
              >
                Invite counterparty
              </button>
              {rawInviteCode ? (
                <p className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-[11px] text-slate-300">
                  Invitation code (shown once — share it privately, never in an unrelated channel):{" "}
                  <code className="text-emerald-300">{rawInviteCode}</code>
                </p>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2">
          <ArtifactCard label={yourLabel} artifact={yourArtifact} />
          <ArtifactCard label={cpLabel} artifact={counterpartyArtifact} />
        </div>

        {!yourArtifact ? (
          <Panel title="Deposit your artifact" icon={FileText} {...panelFocusProps("Deposit your artifact")}>
            <DepositForm onSubmit={(fields) => act("deposit", fields)} busy={busy} />
          </Panel>
        ) : null}

        <Panel title="Freeze Declaration" icon={ShieldCheck} {...panelFocusProps("Freeze Declaration")}>
          {yourArtifact?.pendingPrincipalAttestation ? (
            <>
              <p className="text-[12px] text-slate-300">
                This artifact was registered on your behalf by an operator, on your authorization. Confirm it is the
                artifact you intended before it can be frozen or signed — this does not change its content or
                fingerprint, only your own acknowledgment of it.
              </p>
              <button
                disabled={busy}
                onClick={() => act("confirm")}
                className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40"
              >
                Confirm this artifact
              </button>
            </>
          ) : (
            <>
              <p className="text-[12px] text-slate-400">
                &ldquo;I declare that this artifact represents the version independently frozen by my party for this
                exchange…&rdquo;
              </p>
              <button
                disabled={busy || !yourArtifact || yourArtifact.frozen}
                onClick={() => act("freeze")}
                className="mt-3 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
              >
                {yourArtifact?.frozen ? "Freeze declared" : "Declare freeze"}
              </button>
            </>
          )}
        </Panel>

        <Panel title="Exchange Instrument" icon={ClipboardCheck} {...panelFocusProps("Exchange Instrument")}>
          <p className="text-[12px] text-slate-400">
            Signing acknowledges your identity, your deposited artifact and its frozen version, the agreed purpose,
            confidentiality terms, that receipt does not transfer ownership, and that later normalization is
            derivative work — never evidence of native compatibility.
          </p>
          <button
            disabled={busy || !yourArtifact?.frozen || yourArtifact?.signed || crossed}
            onClick={() => act("sign")}
            className="mt-3 rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
          >
            {yourArtifact?.signed ? "Instrument signed" : "Sign Exchange Instrument"}
          </button>
        </Panel>

        <Panel title="Crossing" icon={Unlock} {...panelFocusProps("Crossing")}>
          <p className="text-[12px] text-slate-400">
            {crossed
              ? "The exchange has crossed — the frozen artifacts were disclosed reciprocally."
              : "Crossing occurs automatically once both parties have deposited, frozen and signed. No fixed order is required."}
          </p>
        </Panel>

        {receipt ? (
          <Panel title="Exchange Receipt" icon={ShieldCheck} {...panelFocusProps("Exchange Receipt")}>
            <p className="text-[13px] leading-relaxed text-slate-200">{receipt.humanReadableSummary}</p>
            <p className="mt-2 text-[11px] text-slate-500">Crossed at {new Date(receipt.crossedAt).toLocaleString()}</p>
            <button
              disabled={busy}
              onClick={() => act("acknowledge")}
              className="mt-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[12px] font-medium text-slate-200 hover:bg-slate-800"
            >
              Acknowledge receipt
            </button>
          </Panel>
        ) : null}

        <Panel title="QubeTalk" icon={MessageSquare} {...panelFocusProps("QubeTalk")}>
          <p className="text-[12px] text-slate-400">
            The collaboration thread opens automatically once your counterparty joins. Find it in your QubeTalk peer
            channels.
          </p>
        </Panel>

        {crossed ? (
          <Panel title="Comparison" icon={GitBranch} {...panelFocusProps("Comparison")}>
            {comparison ? (
              <p className="text-[12px] text-slate-400">Comparison workspace open — read-only against both frozen artifacts.</p>
            ) : (
              <button
                disabled={busy}
                onClick={() => act("open-comparison")}
                className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/25"
              >
                Open comparison workspace
              </button>
            )}
          </Panel>
        ) : null}

        {comparison ? (
          <Panel title="Lineage" icon={GitBranch} {...panelFocusProps("Lineage")}>
            {derivatives.length === 0 ? (
              <p className="text-[12px] text-slate-500">No derivative artifacts yet. Discovering compatibility is evidence about the systems as they are; creating compatibility is evidence about what they can become together.</p>
            ) : (
              <ul className="space-y-2">
                {derivatives.map((d) => (
                  <li key={d.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <p className="text-[13px] text-slate-100">{d.title}</p>
                    <p className="text-[11px] text-slate-500">{d.description}</p>
                    {d.classification ? (
                      <span className="mt-1 inline-block rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {d.classification} · {d.compatibilityKind ?? "unspecified"}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        {exchange.status !== "WITHDRAWN_PRE_EXCHANGE" && exchange.status !== "DECLINED" ? (
          <div className="pt-2 text-right">
            {!crossed ? (
              <button
                disabled={busy}
                onClick={() => act("withdraw", { reason: "withdrawn from the exchange UI" })}
                className="text-[11px] text-slate-500 hover:text-rose-300"
              >
                Withdraw before exchange
              </button>
            ) : exchange.status !== "REVOKED_ACCESS_POST_EXCHANGE" ? (
              <button
                disabled={busy}
                onClick={() => act("revoke", { reason: "access revoked from the exchange UI" })}
                className="text-[11px] text-slate-500 hover:text-rose-300"
              >
                Revoke my future access
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-[11px] uppercase tracking-[0.2em] text-violet-400">Invariant Research Lab</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-100">Reciprocal Artifact Exchange</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        A bilateral, receipted exchange of independently frozen research artifacts. Each party deposits and freezes
        their own artifact, both sign the Exchange Instrument, and the frozen artifacts are disclosed reciprocally
        only once both sides are ready — never before.
      </p>

      {error ? <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">{error}</p> : null}

      {/* OCSGA early invitation entry (2026-08-25) — an invitation may already
          be associated (e.g. entered at Orient, via IanOrientationPanel,
          which calls this SAME /api/research/exchanges/join route). Once
          `list` affirmatively shows at least one exchange, this box never
          demands a code again — the exchange is simply listed below. Never
          shown while `list === null` (not yet known) to avoid a flash. */}
      {list && list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Join with an invitation code</h3>
          <div className="mt-2 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="rax-…"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100 outline-none focus:border-violet-500"
            />
            <button
              disabled={busy || !joinCode.trim()}
              onClick={joinByCode}
              className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[12px] font-medium text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
            >
              Join
            </button>
          </div>
        </div>
      ) : list && list.length > 0 ? (
        <p className="mt-6 text-[12px] text-slate-500">
          You&apos;re already associated with a collaboration exchange — select it below.
        </p>
      ) : null}

      <h2 className="mt-8 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your exchanges</h2>
      {list === null ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No exchanges yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setSelectedId(e.id)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-left hover:border-violet-500/40"
              >
                <p className="text-sm font-medium text-slate-100">{e.title}</p>
                <p className="text-[11px] text-slate-500">{STATUS_LABEL[e.status] ?? e.status}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DepositForm({ onSubmit, busy }: { onSubmit: (fields: Record<string, unknown>) => void; busy: boolean }) {
  const [title, setTitle] = useState("");
  const [artifactClass, setArtifactClass] = useState("architecture-map");
  const [sourceType, setSourceType] = useState("repository-commit");
  const [sourceReference, setSourceReference] = useState("");
  const [contentHash, setContentHash] = useState("");
  const [repositoryCommit, setRepositoryCommit] = useState("");
  const [ownershipDeclaration, setOwnershipDeclaration] = useState("");
  const [rightsForExchange, setRightsForExchange] = useState("Reciprocal comparison within this exchange only.");

  return (
    <div className="space-y-2">
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100" />
      <input placeholder="Artifact class (e.g. architecture-map)" value={artifactClass} onChange={(e) => setArtifactClass(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100" />
      <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100">
        <option value="repository-commit">Repository commit (never a mutable branch URL)</option>
        <option value="upload">Upload</option>
        <option value="immutable-reference">Immutable reference (CID, etc.)</option>
        <option value="manifest">Manifest</option>
      </select>
      <input placeholder="Source reference (repo-relative path, CID, or storage path)" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100" />
      {sourceType === "repository-commit" ? (
        <input placeholder="Pinned commit SHA" value={repositoryCommit} onChange={(e) => setRepositoryCommit(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100" />
      ) : null}
      <input placeholder="SHA-256 content hash (computed by you — never fabricated here)" value={contentHash} onChange={(e) => setContentHash(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100" />
      <input placeholder="Ownership declaration" value={ownershipDeclaration} onChange={(e) => setOwnershipDeclaration(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100" />
      <input placeholder="Rights for this exchange" value={rightsForExchange} onChange={(e) => setRightsForExchange(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-[13px] text-slate-100" />
      <button
        disabled={busy || !title.trim() || !sourceReference.trim() || !contentHash.trim() || !ownershipDeclaration.trim()}
        onClick={() =>
          onSubmit({
            title,
            artifactClass,
            sourceType,
            sourceReference,
            contentHash,
            repositoryCommit: sourceType === "repository-commit" ? repositoryCommit : undefined,
            ownershipDeclaration,
            rightsForExchange,
          })
        }
        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[12px] font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-40"
      >
        Deposit artifact
      </button>
    </div>
  );
}
