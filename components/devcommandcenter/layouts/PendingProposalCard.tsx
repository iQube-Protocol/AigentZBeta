"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle, ChevronDown } from "lucide-react";
import type { StageProposal, StageProposalKind } from "@/services/devCommandCenter";

const PROPOSAL_KIND_LABEL: Record<StageProposalKind, string> = {
  intent: "Distilled Intent",
  context_pack: "Context Pack",
  gap_analysis: "Gap Report",
  consequence_canvas: "Consequence Canvas",
  implementation_brief: "Implementation Package",
  validation_report: "Validation Report",
  remediation_plan: "Remediation Plan",
  deployment_authorization: "Deployment Authorization",
};

// ─── Tolerant payload getters (mirror applyStageProposal coercion) ──────────

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const objList = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
    : [];
/** First non-empty object array under any candidate key — same field-name
 * tolerance as applyStageProposal (existing vs existingCapabilities, etc.). */
function pickObjList(d: Record<string, unknown>, keys: string[]): Array<Record<string, unknown>> {
  for (const k of keys) {
    const arr = objList(d[k]);
    if (arr.length > 0) return arr;
  }
  return [];
}

function countLine(p: StageProposal): string {
  const d = p.data;
  const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  switch (p.kind) {
    case "intent":
      return `${count(d.users)} user groups · ${count(d.desiredOutcomes)} outcomes · ${count(d.successCriteria)} success criteria · ${count(d.constraints)} constraints`;
    case "context_pack":
      return `${count(d.items)} context items proposed`;
    case "gap_analysis":
      return `${pickObjList(d, ["existing", "existingCapabilities", "existing_capabilities"]).length} existing capabilities (reuse/extend) · ${pickObjList(d, ["missing", "missingCapabilities", "missing_capabilities"]).length} to create`;
    case "consequence_canvas":
      return `${count(d.shouldHappen)} should-happen · ${count(d.shouldNeverHappen)} must-never-happen`;
    case "implementation_brief":
      return `${str(d.brief).length.toLocaleString()} chars of brief markdown`;
    case "validation_report":
      return `${count(d.items)} consequence checks · ${count(d.testingRequirements)} testing requirements`;
    case "remediation_plan":
      return `${count(d.remedies)} remed(ies) · revalidation ${d.revalidationRequired === false ? "not required" : "required"}`;
    case "deployment_authorization":
      return `${d.authorized === true ? "authorized" : "not authorized"} · threshold ${d.constitutionalThresholdMet === true ? "met" : "not met"} · ${count(d.blockingConsequences)} blocking`;
    default:
      return "";
  }
}

// ─── Preview building blocks ────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-amber-300/70 uppercase font-semibold mb-0.5">{title}</div>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <div className="text-[10px] text-slate-500 italic">none</div>;
  return (
    <ul className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} className="text-[11px] text-slate-300 flex gap-1.5">
          <span className="text-slate-500 shrink-0">·</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const cls = {
    emerald: "bg-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/20 text-amber-300",
    rose: "bg-rose-500/20 text-rose-300",
    slate: "bg-slate-600/40 text-slate-300",
  }[tone];
  return <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${cls}`}>{children}</span>;
}

// ─── Per-kind full-content preview (finding 1, 2026-07-06: the operator MUST
// be able to review the actual artifact content BEFORE approving) ────────────

function ProposalPreviewBody({ proposal }: { proposal: StageProposal }) {
  const d = proposal.data;

  switch (proposal.kind) {
    case "intent":
      return (
        <div className="space-y-2">
          {str(d.goal) && <Section title="Goal"><div className="text-[11px] text-slate-200">{str(d.goal)}</div></Section>}
          {str(d.priority) && (
            <Section title="Priority"><Badge tone={str(d.priority) === "critical" || str(d.priority) === "high" ? "rose" : "slate"}>{str(d.priority)}</Badge></Section>
          )}
          <Section title="Users"><BulletList items={strList(d.users)} /></Section>
          <Section title="Desired outcomes"><BulletList items={strList(d.desiredOutcomes)} /></Section>
          <Section title="Success criteria"><BulletList items={strList(d.successCriteria)} /></Section>
          <Section title="Constraints"><BulletList items={strList(d.constraints)} /></Section>
          {strList(d.relatedCartridges).length > 0 && (
            <Section title="Related cartridges"><BulletList items={strList(d.relatedCartridges)} /></Section>
          )}
          {strList(d.relatedVentures).length > 0 && (
            <Section title="Related ventures"><BulletList items={strList(d.relatedVentures)} /></Section>
          )}
        </div>
      );

    case "context_pack": {
      const items = pickObjList(d, ["items", "contextItems"]);
      if (items.length === 0) return <div className="text-[10px] text-slate-500 italic">No items in this proposal.</div>;
      return (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="py-1 border-b border-amber-500/10 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-200 font-semibold truncate">{str(it.title) || str(it.sourcePath)}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge tone={str(it.reuseSignal) === "reuse" ? "emerald" : str(it.reuseSignal) === "extend" ? "amber" : "slate"}>{str(it.reuseSignal) || "reference"}</Badge>
                  {typeof it.relevanceScore === "number" && (
                    <span className="text-[9px] text-slate-400">{Math.round(it.relevanceScore <= 1 ? it.relevanceScore * 100 : it.relevanceScore)}%</span>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">{str(it.sourcePath)}</div>
              {str(it.excerpt) && <div className="text-[10px] text-slate-400 mt-0.5">{str(it.excerpt)}</div>}
            </div>
          ))}
        </div>
      );
    }

    case "gap_analysis": {
      const existing = pickObjList(d, ["existing", "existingCapabilities", "existing_capabilities"]);
      const missing = pickObjList(d, ["missing", "missingCapabilities", "missing_capabilities"]);
      return (
        <div className="space-y-2">
          <Section title={`Existing — reuse/extend (${existing.length})`}>
            {existing.length === 0 ? (
              <div className="text-[10px] text-slate-500 italic">none</div>
            ) : (
              existing.map((c, i) => (
                <div key={i} className="py-1 border-b border-amber-500/10 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-emerald-300 truncate">{str(c.name)}</span>
                    <Badge tone="emerald">{str(c.reuseStrategy) || "extend"}</Badge>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{str(c.location)}</div>
                  {str(c.description) && <div className="text-[10px] text-slate-400">{str(c.description)}</div>}
                </div>
              ))
            )}
          </Section>
          <Section title={`Missing — build new (${missing.length})`}>
            {missing.length === 0 ? (
              <div className="text-[10px] text-slate-500 italic">none</div>
            ) : (
              missing.map((c, i) => (
                <div key={i} className="py-1 border-b border-amber-500/10 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-300 truncate">{str(c.name)}</span>
                    <Badge tone="amber">{str(c.estimatedComplexity) || "medium"}</Badge>
                  </div>
                  {str(c.description) && <div className="text-[10px] text-slate-400">{str(c.description)}</div>}
                  {str(c.suggestedLocation) && <div className="text-[10px] text-slate-500 font-mono truncate">{str(c.suggestedLocation)}</div>}
                  {strList(c.dependencies).length > 0 && (
                    <div className="text-[10px] text-slate-500">Deps: {strList(c.dependencies).join(", ")}</div>
                  )}
                </div>
              ))
            )}
          </Section>
        </div>
      );
    }

    case "consequence_canvas": {
      const should = objList(d.shouldHappen);
      const never = objList(d.shouldNeverHappen);
      const conseqRow = (c: Record<string, unknown>, i: number, tone: "emerald" | "rose") => (
        <div key={i} className="flex items-start justify-between gap-2 py-0.5">
          <span className="text-[11px] text-slate-300">{str(c.description)}</span>
          <div className="flex items-center gap-1 shrink-0">
            {str(c.category) && <Badge tone="slate">{str(c.category)}</Badge>}
            {str(c.severity) && <Badge tone={tone}>{str(c.severity)}</Badge>}
          </div>
        </div>
      );
      return (
        <div className="space-y-2">
          <Section title={`Should happen (${should.length})`}>
            {should.length === 0 ? <div className="text-[10px] text-slate-500 italic">none</div> : should.map((c, i) => conseqRow(c, i, "emerald"))}
          </Section>
          <Section title={`Must never happen (${never.length})`}>
            {never.length === 0 ? <div className="text-[10px] text-slate-500 italic">none</div> : never.map((c, i) => conseqRow(c, i, "rose"))}
          </Section>
          {strList(d.workflowsActivated).length > 0 && <Section title="Workflows activated"><BulletList items={strList(d.workflowsActivated)} /></Section>}
          {strList(d.systemsAffected).length > 0 && <Section title="Systems affected"><BulletList items={strList(d.systemsAffected)} /></Section>}
          {strList(d.permissionsRequired).length > 0 && <Section title="Permissions required"><BulletList items={strList(d.permissionsRequired)} /></Section>}
          {str(d.successState) && <Section title="Success state"><div className="text-[11px] text-slate-200">{str(d.successState)}</div></Section>}
        </div>
      );
    }

    case "implementation_brief":
      return (
        <pre className="text-[10px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
          {str(d.brief) || "(empty brief)"}
        </pre>
      );

    case "validation_report": {
      const items = objList(d.items);
      const verdictTone = (v: string): "emerald" | "amber" | "rose" | "slate" =>
        v === "satisfied" ? "emerald" : v === "partial" ? "amber" : v === "unresolved" || v === "unintended" ? "rose" : "slate";
      return (
        <div className="space-y-2">
          <Section title={`Consequence checks (${items.length})`}>
            {items.length === 0 ? (
              <div className="text-[10px] text-slate-500 italic">none</div>
            ) : (
              items.map((it, i) => (
                <div key={i} className="py-1 border-b border-amber-500/10 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-200">{str(it.description)}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge tone={verdictTone(str(it.verdict))}>{str(it.verdict) || "unresolved"}</Badge>
                      {str(it.severity) && <Badge tone="slate">{str(it.severity)}</Badge>}
                    </div>
                  </div>
                  {str(it.evidence) && <div className="text-[10px] text-slate-400 mt-0.5">Evidence: {str(it.evidence)}</div>}
                </div>
              ))
            )}
          </Section>
          {strList(d.workflowImpacts).length > 0 && <Section title="Workflow impacts"><BulletList items={strList(d.workflowImpacts)} /></Section>}
          {strList(d.governanceImpacts).length > 0 && <Section title="Governance impacts"><BulletList items={strList(d.governanceImpacts)} /></Section>}
          {strList(d.testingRequirements).length > 0 && <Section title="Testing requirements"><BulletList items={strList(d.testingRequirements)} /></Section>}
        </div>
      );
    }

    case "remediation_plan": {
      const remedies = objList(d.remedies);
      return (
        <div className="space-y-2">
          <Section title={`Remedies (${remedies.length})`}>
            {remedies.length === 0 ? (
              <div className="text-[10px] text-slate-500 italic">none</div>
            ) : (
              remedies.map((r, i) => (
                <div key={i} className="py-1 border-b border-amber-500/10 last:border-0 space-y-0.5">
                  <div className="text-[11px] text-slate-200">{str(r.description)}</div>
                  {str(r.remedy) && <div className="text-[10px] text-emerald-300">Remedy: {str(r.remedy)}</div>}
                  {str(r.learningNote) && <div className="text-[10px] text-cyan-300/80">Lesson: {str(r.learningNote)}</div>}
                </div>
              ))
            )}
          </Section>
          {str(d.residualRisk) && <Section title="Residual risk"><div className="text-[11px] text-slate-200">{str(d.residualRisk)}</div></Section>}
          <Section title="Re-validation">
            <Badge tone={d.revalidationRequired === false ? "amber" : "emerald"}>
              {d.revalidationRequired === false ? "residual risk accepted — proceed" : "required — re-check"}
            </Badge>
          </Section>
        </div>
      );
    }

    case "deployment_authorization":
      return (
        <div className="space-y-2">
          <Section title="Decision">
            <div className="flex items-center gap-1.5">
              <Badge tone={d.authorized === true ? "emerald" : "rose"}>{d.authorized === true ? "authorized" : "not authorized"}</Badge>
              <Badge tone={d.constitutionalThresholdMet === true ? "emerald" : "rose"}>
                threshold {d.constitutionalThresholdMet === true ? "met" : "not met"}
              </Badge>
            </div>
          </Section>
          {str(d.rationale) && <Section title="Rationale"><div className="text-[11px] text-slate-200">{str(d.rationale)}</div></Section>}
          {strList(d.blockingConsequences).length > 0 && (
            <Section title="Blocking consequences"><BulletList items={strList(d.blockingConsequences)} /></Section>
          )}
        </div>
      );

    default:
      return null;
  }
}

export function PendingProposalCard({ proposal, onApprove, onDismiss }: {
  proposal: StageProposal;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[10px] uppercase tracking-wide text-amber-300 font-semibold">
          Proposed by aigentZ — review, then approve
        </span>
      </div>
      <div className="text-xs font-semibold text-white">
        {PROPOSAL_KIND_LABEL[proposal.kind]}: {proposal.summary}
      </div>
      <div className="text-[11px] text-slate-300">{countLine(proposal)}</div>

      {/* Full content preview — review-then-approve is the flow (finding 1).
          Scrollable at either height; expand widens the window. */}
      <div className={`rounded border border-amber-500/20 bg-slate-900/40 p-2 overflow-y-auto ${expanded ? "max-h-[60vh]" : "max-h-56"}`}>
        <ProposalPreviewBody proposal={proposal} />
      </div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1 text-[10px] text-amber-300/80 hover:text-amber-200 transition-colors"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        {expanded ? "Collapse preview" : "Expand preview"}
      </button>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onApprove}
          className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-semibold"
        >
          <CheckCircle className="w-3 h-3" />
          Approve
        </button>
        <button
          onClick={onDismiss}
          className="text-[10px] px-2.5 py-1 rounded bg-slate-700/40 text-slate-300 border border-slate-600/40 hover:bg-slate-700/70 transition-colors"
        >
          Dismiss
        </button>
        <span className="text-[10px] text-slate-500 ml-1">
          or ask aigentZ to refine it — a fresh card replaces this one
        </span>
      </div>
    </div>
  );
}
