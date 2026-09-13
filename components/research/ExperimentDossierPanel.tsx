"use client";

/**
 * ExperimentDossierPanel — the human rendering of `research.dossier.v1`
 * (2026-09-11, IRL Workspace Experiment Dossier Completion Pass).
 *
 * ONE FETCH, ONE OBJECT, TWO PROJECTIONS. This component calls
 * `/api/participation/workspace-dossier` and renders exactly the fields that
 * route returns from `resolveExperimentDossier` — the SAME object a
 * delegated agent reads as JSON from that same route. There is no
 * independently-assembled "UI version" of the dossier; every section below
 * is a direct rendering of one field on the fetched object. If a field is
 * `{available:false, reason}` (an `UnmodeledDossierField`), that reason is
 * shown verbatim — never inferred, never silently hidden.
 *
 * Sections: Protocol · Crystal · Apparatus · Readiness · Runs · Review ·
 * Constitutional Records · Receipts · Exchange (OCSGA workspaces only — the
 * same resolver, no experiment-specific branching in THIS component either;
 * a section simply doesn't render when its field is null/absent).
 *
 * "Render, don't redirect": every artifact this panel names is either shown
 * inline (hashes, snapshot rows, receipt cards) or offered as an in-Workspace
 * forward action (Working Materials via `onOpenDocument`) — never a raw
 * `target="_blank"` link or a redirect out of IRL OS.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { ActivityReceiptCard } from "@/components/metame/cards/ActivityReceiptCard";
import type { ExperimentDossier, UnmodeledDossierField } from "@/services/research/experimentDossier";

interface ExperimentDossierPanelProps {
  workspaceId: string;
  personaId?: string;
  /** Forward action into Working Materials for a given document path — the
   *  same named-flow pattern the Experiments/Pipeline/Review surfaces already
   *  use (navigateToSurface + selectedArtifactId). Optional: when absent the
   *  document row still names the path, just without a jump affordance. */
  onOpenDocument?: (path: string) => void;
}

type PanelState =
  | { kind: "loading" }
  | { kind: "ready"; dossier: ExperimentDossier }
  | { kind: "denied" }
  | { kind: "not-found" }
  | { kind: "error" };

const SECTION_IDS = [
  "protocol",
  "crystal",
  "apparatus",
  "readiness",
  "runs",
  "review",
  "records",
  "receipts",
  "exchange",
] as const;
type SectionId = (typeof SECTION_IDS)[number];

function isUnmodeled(v: unknown): v is UnmodeledDossierField {
  return Boolean(v) && typeof v === "object" && (v as { available?: unknown }).available === false;
}

function Section({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
          <span className="text-xs font-semibold text-slate-100">{title}</span>
        </span>
        {subtitle && <span className="text-[10px] text-slate-500">{subtitle}</span>}
      </button>
      {open && <div className="border-t border-slate-800 px-3 py-3 text-xs text-slate-300">{children}</div>}
    </div>
  );
}

function Unmodeled({ field }: { field: UnmodeledDossierField }) {
  return <p className="italic text-slate-500">{field.reason}</p>;
}

function Hash({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="font-mono text-[10px] text-slate-400">
      {label}: {value ?? <span className="italic text-slate-600">not yet set</span>}
    </p>
  );
}

export function ExperimentDossierPanel({ workspaceId, personaId, onOpenDocument }: ExperimentDossierPanelProps) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    protocol: true,
    crystal: false,
    apparatus: false,
    readiness: false,
    runs: false,
    review: false,
    records: false,
    receipts: false,
    exchange: true,
  });

  useEffect(() => {
    let alive = true;
    setState({ kind: "loading" });
    (async () => {
      try {
        const res = await personaFetch(`/api/participation/workspace-dossier?workspaceId=${encodeURIComponent(workspaceId)}`, {
          cache: "no-store",
          personaIdHint: personaId,
        });
        if (!alive) return;
        if (res.status === 403) {
          setState({ kind: "denied" });
          return;
        }
        if (res.status === 404) {
          setState({ kind: "not-found" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        const data = await res.json();
        if (data?.ok) setState({ kind: "ready", dossier: data.dossier as ExperimentDossier });
        else setState({ kind: "error" });
      } catch {
        if (alive) setState({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId, personaId]);

  if (state.kind === "loading") return <p className="text-xs text-slate-500">Loading dossier…</p>;
  if (state.kind === "denied") {
    return <p className="text-xs text-rose-300">You are not authorized to view this workspace&apos;s dossier.</p>;
  }
  if (state.kind === "not-found") return <p className="text-xs text-slate-500">Unknown workspace.</p>;
  if (state.kind === "error") return <p className="text-xs text-slate-500">Dossier unavailable right now.</p>;

  const d = state.dossier;
  const toggle = (id: SectionId) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">
            {d.experiment?.title ?? d.workspaceLabel}
            {d.experimentId && <span className="ml-2 text-[11px] font-normal text-slate-500">{d.experimentId}</span>}
          </h3>
          <span className="text-[10px] text-slate-500">{d.schemaVersion}</span>
        </div>
        {d.experiment?.hypothesis && <p className="mt-1 text-[11px] text-slate-400">{d.experiment.hypothesis}</p>}
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span>Viewer role: {d.viewer.role ?? "—"}</span>
          <span>Access basis: {d.viewer.accessBasis}</span>
          <span>Phase: {d.lifecycle?.phase ?? "—"}</span>
          <span>Stage: {d.currentStage ?? "—"}</span>
          {d.experiment?.protocolRef && <span>Protocol: {d.experiment.protocolRef}</span>}
        </div>
      </div>

      {d.blockers.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">Blockers</h4>
          {d.blockers.map((b, i) => (
            <p key={i} className="mt-1 text-xs text-amber-200">
              {b.title}
              {b.detail && <span className="text-amber-200/70"> — {b.detail}</span>}
            </p>
          ))}
        </div>
      )}

      {d.nextActions.length > 0 && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Next governed action</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-emerald-200">
            {d.nextActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {d.protocol && (
        <Section id="protocol" title="Protocol" subtitle={d.protocol.ready ? "ready" : "incomplete"} open={open.protocol} onToggle={toggle}>
          <p className="text-slate-400">
            Present: {d.protocol.present.length > 0 ? d.protocol.present.join(", ") : "none"}
            <br />
            Missing: {d.protocol.missing.length > 0 ? d.protocol.missing.join(", ") : "none"}
          </p>
          {d.protocol.documents.length > 0 && (
            <div className="mt-2 space-y-1">
              {d.protocol.documents.map((doc) => (
                <div key={doc.path} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1">
                  <span className="truncate text-[11px] text-slate-300">{doc.path}</span>
                  {onOpenDocument && (
                    <button
                      type="button"
                      onClick={() => onOpenDocument(doc.path)}
                      className="shrink-0 rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-200 hover:bg-violet-500/20"
                    >
                      Open in Working Materials →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {d.experiment && d.experiment.governingInvariants.length > 0 && (
            <p className="mt-2 text-[10px] text-slate-500">Governing invariants: {d.experiment.governingInvariants.join(", ")}</p>
          )}
        </Section>
      )}

      <Section id="crystal" title="Crystal / Substrate" open={open.crystal} onToggle={toggle}>
        {isUnmodeled(d.crystal) ? (
          <Unmodeled field={d.crystal} />
        ) : d.crystal ? (
          <div className="space-y-1.5">
            <Hash label="Content hash" value={d.crystal.contentHash} />
            <Hash label="Commitment hash" value={d.crystal.commitmentHash} />
            <p className="text-[10px] text-slate-500">
              Frozen: {d.crystal.frozenAt ?? "not yet"} · Designation: {d.crystal.executionDesignation ?? "confirmatory (default)"}
            </p>
            {d.crystal.freezeRationale && <p className="text-[11px] text-slate-400">Freeze rationale: {d.crystal.freezeRationale}</p>}
            {d.crystal.scientificDeviations && d.crystal.scientificDeviations.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deviations</p>
                {d.crystal.scientificDeviations.map((dev, i) => (
                  <p key={i} className="text-[11px] text-slate-400">
                    {dev.checkName}: {dev.measuredDetail} — {dev.rationale}
                  </p>
                ))}
              </div>
            )}
            {d.crystal.memberSnapshot && d.crystal.memberSnapshot.length > 0 && (
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Frozen member snapshot ({d.crystal.memberSnapshot.length})
                </p>
                {d.crystal.memberSnapshot.map((m) => (
                  <p key={m.id} className="text-[11px] text-slate-400">
                    <span className="font-mono text-slate-500">{m.id}</span> — {m.statement}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="italic text-slate-500">No crystal is bound to this workspace.</p>
        )}
      </Section>

      <Section id="apparatus" title="Apparatus / Arms" open={open.apparatus} onToggle={toggle}>
        {isUnmodeled(d.apparatus) ? (
          <Unmodeled field={d.apparatus} />
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500">Selector version: {d.apparatus.selectorVersion}</p>
            {d.apparatus.arms.map((arm) => (
              <p key={arm.id} className="text-[11px] text-slate-300">
                Arm {arm.id} — {arm.label}
              </p>
            ))}
          </div>
        )}
      </Section>

      <Section id="readiness" title="Readiness" open={open.readiness} onToggle={toggle}>
        {isUnmodeled(d.readiness) ? (
          <Unmodeled field={d.readiness} />
        ) : (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500">
              Protocol-ratified ready: {d.readiness.protocolRatifiedReady ? "yes" : "no"}
            </p>
            {d.readiness.sections.map((s) => (
              <div key={s.section} className="flex items-center justify-between border-b border-slate-800/60 py-1 last:border-0">
                <span className="text-[11px] text-slate-300">{s.section}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    s.status === "green"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : s.status === "amber"
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="runs" title="Execution Runs" subtitle={Array.isArray(d.runs) ? String(d.runs.length) : undefined} open={open.runs} onToggle={toggle}>
        {isUnmodeled(d.runs) ? (
          <Unmodeled field={d.runs} />
        ) : d.runs.length === 0 ? (
          <p className="italic text-slate-500">No execution runs recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {d.runs.map((run) => (
              <div key={run.id} className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
                <p className="font-mono text-[10px] text-slate-500">{run.id}</p>
                <p className="text-[11px] text-slate-300">
                  {run.runExecutionDesignation} · arms: {run.armIds.join(", ")} · {run.providerModel}
                  {run.confirmatoryEligible ? " · confirmatory-eligible" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="review" title="Review" open={open.review} onToggle={toggle}>
        {d.review ? (
          <div className="space-y-1 text-[11px] text-slate-300">
            <p>Reviewer agreement: {d.review.agreement.authorizationStatus}</p>
            <p>
              Caller observer:{" "}
              {d.review.callerObserverStatus
                ? `${d.review.callerObserverStatus.callerAssigned ? "assigned" : "not assigned"} — ${d.review.callerObserverStatus.callerDecisionStatus}`
                : "—"}
            </p>
          </div>
        ) : (
          <p className="italic text-slate-500">No review state applies to this workspace.</p>
        )}
      </Section>

      <Section id="records" title="Constitutional Records" open={open.records} onToggle={toggle}>
        {isUnmodeled(d.constitutionalRecords) ? (
          <Unmodeled field={d.constitutionalRecords} />
        ) : d.constitutionalRecords.length === 0 ? (
          <p className="italic text-slate-500">No constitutional records tagged for this experiment yet.</p>
        ) : (
          <div className="space-y-1">
            {d.constitutionalRecords.map((r) => (
              <p key={r.itemId} className="text-[11px] text-slate-300">
                {r.displayName} <span className="text-slate-500">({r.contentType}, {r.createdAt})</span>
              </p>
            ))}
          </div>
        )}
      </Section>

      <Section
        id="receipts"
        title="Receipts"
        subtitle={Array.isArray(d.receipts.activity) ? String(d.receipts.activity.length) : undefined}
        open={open.receipts}
        onToggle={toggle}
      >
        {isUnmodeled(d.receipts.activity) ? (
          <Unmodeled field={d.receipts.activity} />
        ) : d.receipts.activity.length === 0 ? (
          <p className="italic text-slate-500">No activity recorded yet for this experiment.</p>
        ) : (
          <div className="space-y-2">
            {d.receipts.activity.map((entry) => {
              const card = entry.receiptId ? d.receipts.receiptCards[entry.receiptId] : undefined;
              return card ? (
                <ActivityReceiptCard key={entry.objectId} data={card} theme="dark" />
              ) : (
                <p key={entry.objectId} className="text-[11px] text-slate-400">
                  {entry.objectKind} — {entry.lifecycleState} — {entry.createdAt}
                </p>
              );
            })}
          </div>
        )}
      </Section>

      {d.exchange && (
        <Section id="exchange" title="Reciprocal Exchange (OCSGA)" subtitle={d.exchange.exchange.status} open={open.exchange} onToggle={toggle}>
          <div className="space-y-2 text-[11px] text-slate-300">
            <p>Exchange: {d.exchange.exchange.id} · your party: {d.exchange.viewerParty}</p>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Your architecture</p>
              {d.exchange.yourArtifact ? (
                <>
                  <Hash label="Content hash" value={d.exchange.yourArtifact.contentHash ?? null} />
                  <p className="text-[10px] text-slate-500">
                    Frozen: {d.exchange.yourArtifact.frozen ? "yes" : "no"} · Signed: {d.exchange.yourArtifact.signed ? "yes" : "no"}
                  </p>
                </>
              ) : (
                <p className="italic text-slate-500">Not yet deposited.</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Counterparty architecture</p>
              {d.exchange.counterpartyArtifact ? (
                !d.exchange.counterpartyArtifact.locked ? (
                  <>
                    <Hash label="Content hash" value={d.exchange.counterpartyArtifact.contentHash} />
                    <p className="text-[10px] text-slate-500">
                      Frozen: {d.exchange.counterpartyArtifact.frozen ? "yes" : "no"} · Signed: {d.exchange.counterpartyArtifact.signed ? "yes" : "no"}
                    </p>
                  </>
                ) : (
                  <p className="italic text-slate-500">{d.exchange.counterpartyArtifact.lockedReason ?? "Not yet disclosed."}</p>
                )
              ) : (
                <p className="italic text-slate-500">Not yet deposited.</p>
              )}
            </div>
            {d.exchange.receipt && <Hash label="Exchange receipt" value={d.exchange.receipt.id ?? null} />}
          </div>
        </Section>
      )}
    </div>
  );
}

export default ExperimentDossierPanel;
