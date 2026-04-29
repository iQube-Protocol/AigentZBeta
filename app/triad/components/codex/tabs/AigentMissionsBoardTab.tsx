"use client";

import { useState } from "react";
import { BookOpen, Brain, ChevronDown, ChevronUp, ClipboardList, Scale, Shield, Users, Cpu, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type MissionCategory = "segmentation" | "outreach-support" | "telemetry" | "partner" | "content" | "participation" | "governance";
type TrustClass = 1 | 2 | 3 | 4 | 5;
type LifecycleStage = "defined" | "available" | "assigned" | "in-progress" | "submitted" | "reviewed" | "accepted" | "rewarded" | "learned";
type AcquisitionSource = "admin-defined" | "system-captured" | "agent-declared" | "human-reviewed" | "receipt-logged";

interface Mission {
  // Identity
  id: string;
  title: string;
  category: MissionCategory;
  trustClass: TrustClass;
  stage: LifecycleStage;
  // Scope
  objective: string;
  whyItMatters: string;
  // Delegation
  targetAgentType: string;
  inputsProvided: string;
  allowedTools: string;
  constraints: string;
  // Output
  expectedOutput: string;
  successMetric: string;
  // Economics
  rewardLogic: string;
  trustImpactPositive: string;
  trustImpactNegative: string;
  // Governance
  escalationRule: string;
  ownerReviewer: string;
  requiresHumanApproval: boolean;
  // Optional
  timeSensitivity?: string;
  priorityLevel?: string;
  relatedCampaignPhase?: string;
  relatedInvestorCohort?: string;
  relatedContentAsset?: string;
}

type SubTab = "mythos" | "ethos" | "logos";

// ─── Style maps ───────────────────────────────────────────────────────────────

const CAT: Record<MissionCategory, { label: string; color: string }> = {
  segmentation:       { label: "Segmentation",      color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  "outreach-support": { label: "Outreach Support",  color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  telemetry:          { label: "Telemetry",          color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  partner:            { label: "Partner",            color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  content:            { label: "Content",            color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  participation:      { label: "Participation",      color: "bg-green-500/15 text-green-300 border-green-500/30" },
  governance:         { label: "Governance",         color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
};

const CAT_CARD: Record<MissionCategory, { bg: string; border: string }> = {
  segmentation:       { bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  "outreach-support": { bg: "bg-purple-500/10", border: "border-purple-500/20" },
  telemetry:          { bg: "bg-cyan-500/10",   border: "border-cyan-500/20" },
  partner:            { bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  content:            { bg: "bg-rose-500/10",   border: "border-rose-500/20" },
  participation:      { bg: "bg-green-500/10",  border: "border-green-500/20" },
  governance:         { bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
};

const CLS: Record<TrustClass, { label: string; color: string; desc: string }> = {
  1: { label: "Class 1",  color: "bg-slate-500/20 text-slate-300 border-slate-500/40",  desc: "Observation / analysis — read-only, low risk" },
  2: { label: "Class 2",  color: "bg-blue-500/20 text-blue-300 border-blue-500/40",    desc: "Draft / assist — produces outputs for human review" },
  3: { label: "Class 3",  color: "bg-amber-500/20 text-amber-300 border-amber-500/40", desc: "Optimize / route — influences sequencing or workflow" },
  4: { label: "Class 4",  color: "bg-orange-500/20 text-orange-300 border-orange-500/40", desc: "Operate — actions inside narrow auditable boundary" },
  5: { label: "Class 5",  color: "bg-red-500/20 text-red-300 border-red-500/40",       desc: "Contribute upstream — Registry / OS / ecosystem scope" },
};

const STAGE: Record<LifecycleStage, { label: string; color: string }> = {
  defined:      { label: "Defined",      color: "bg-slate-600/40 text-slate-300" },
  available:    { label: "Available",    color: "bg-blue-600/30 text-blue-300" },
  assigned:     { label: "Assigned",     color: "bg-yellow-600/30 text-yellow-300" },
  "in-progress":{ label: "In Progress",  color: "bg-amber-600/30 text-amber-300" },
  submitted:    { label: "Submitted",    color: "bg-purple-600/30 text-purple-300" },
  reviewed:     { label: "Reviewed",     color: "bg-cyan-600/30 text-cyan-300" },
  accepted:     { label: "Accepted",     color: "bg-green-600/30 text-green-300" },
  rewarded:     { label: "Rewarded",     color: "bg-emerald-600/30 text-emerald-300" },
  learned:      { label: "Learned",      color: "bg-teal-600/30 text-teal-300" },
};

const ACQ: Record<AcquisitionSource, { label: string; color: string }> = {
  "admin-defined":  { label: "Admin-defined",  color: "text-indigo-400 border-indigo-500/40" },
  "system-captured":{ label: "System-captured",color: "text-cyan-400 border-cyan-500/40" },
  "agent-declared": { label: "Agent-declared", color: "text-amber-400 border-amber-500/40" },
  "human-reviewed": { label: "Human-reviewed", color: "text-green-400 border-green-500/40" },
  "receipt-logged": { label: "Receipt-logged", color: "text-purple-400 border-purple-500/40" },
};

// ─── Seed missions ────────────────────────────────────────────────────────────

const MISSIONS: Mission[] = [
  {
    id: "M-001", title: "Investor Reactivation Prioritization",
    category: "segmentation", trustClass: 1, stage: "defined",
    objective: "Rank which investors deserve faster follow-up today.",
    whyItMatters: "Surfaces the highest-leverage next-contact opportunities from the 3,501-investor pool before daily outreach begins.",
    targetAgentType: "Analysis agent — Class 1 (observation / analysis)",
    inputsProvided: "Investor CRM export: last-contact date, cohort tag, backing amount, email open/click history.",
    allowedTools: "Read-only investor dataset access; ranking and sorting logic. No write or send actions.",
    constraints: "Must not initiate contact. Must not modify CRM data. Must flag uncertainty rather than guess cohort assignment. Output is a ranked list only.",
    expectedOutput: "Ranked investor list with brief rationale per entry. CSV or structured table format.",
    successMetric: "Ranked list reviewed and accepted by campaign operator; used to set same-day outreach sequence.",
    rewardLogic: "KNYT internal credit on operator acceptance. Accumulates toward standing with consistent daily useful output.",
    trustImpactPositive: "Accurate, useful ranking accepted and used in ops.",
    trustImpactNegative: "Ranking contains factual errors, out-of-scope recommendations, or requires significant manual correction.",
    escalationRule: "Escalate if investor data is incomplete, contradictory, or if ranking requires assumptions not supported by the data.",
    ownerReviewer: "Campaign operator (Marketa)",
    requiresHumanApproval: true,
    timeSensitivity: "Daily — should reflect same-day signal before morning campaign session.",
    priorityLevel: "High",
    relatedCampaignPhase: "All active outreach phases",
  },
  {
    id: "M-002", title: "Zero KNYT Legacy Investor Identification",
    category: "segmentation", trustClass: 1, stage: "defined",
    objective: "Identify and validate the strongest $1,000+ investor candidates for premium-tier emphasis.",
    whyItMatters: "Surfaces investors most likely to convert to KNYT holders without additional acquisition cost.",
    targetAgentType: "Analysis agent — Class 1 (observation / analysis)",
    inputsProvided: "Investor dataset: backing amount, StartEngine/legacy history, current KNYT holdings (if known), cohort tags.",
    allowedTools: "Read-only investor data access; filtering and threshold logic. No external lookups.",
    constraints: "Must not contact investors. Must not modify data. $1,000+ threshold is a guide not an absolute rule — flag borderline cases explicitly.",
    expectedOutput: "Candidate list with tier classification (strong / borderline / exclude) and brief rationale per entry.",
    successMetric: "Clean list accepted by operator and confirmed used in premium-tier campaign ops.",
    rewardLogic: "KNYT credit on list acceptance and confirmed use in ops.",
    trustImpactPositive: "List accepted and directly drives campaign targeting.",
    trustImpactNegative: "Misclassifications require significant manual correction by operator.",
    escalationRule: "Escalate if data quality is insufficient to classify a significant portion of the candidate pool.",
    ownerReviewer: "Campaign operator",
    requiresHumanApproval: true,
    relatedCampaignPhase: "Premium tier activation",
    relatedInvestorCohort: "Legacy investors — $1,000+ backing, pre-KNYT Codex",
  },
  {
    id: "M-003", title: "Codex Objection Handling Support",
    category: "outreach-support", trustClass: 2, stage: "defined",
    objective: "Generate concise copy variants addressing objections from investors who already own legacy print or motioncomic assets.",
    whyItMatters: "Removes the primary friction point blocking legacy asset holders from Codex adoption.",
    targetAgentType: "Draft / assist agent — Class 2 (outputs for human review)",
    inputsProvided: "Known objection patterns from legacy holders; Codex value proposition brief; legacy vs Codex asset comparison.",
    allowedTools: "Drafting tools; read access to Codex and legacy asset descriptions. No outbound sending.",
    constraints: "Must not fabricate product claims. Must not promise specific commercial outcomes. Tone must match campaign voice. All outputs are drafts for human review only.",
    expectedOutput: "5–10 concise objection-handling copy variants (2–4 sentences each). Format suitable for email and SMS reuse.",
    successMetric: "Copy approved by Marketa lead and deployed in live outbound messaging without major edits.",
    rewardLogic: "KNYT credit when copy is approved and confirmed deployed in live outbound.",
    trustImpactPositive: "Copy reused without significant editing; improves investor conversion signal.",
    trustImpactNegative: "Copy requires major revision or violates brand tone guidelines.",
    escalationRule: "Escalate if any objection requires a product claim that cannot be verified from provided materials.",
    ownerReviewer: "Marketa campaign lead",
    requiresHumanApproval: true,
    relatedContentAsset: "Codex value proposition brief; legacy asset comparison sheet",
  },
  {
    id: "M-004", title: "Daily Campaign Telemetry Brief",
    category: "telemetry", trustClass: 1, stage: "defined",
    objective: "Summarize the last 24 hours of investor, partner, and channel performance into an actionable brief.",
    whyItMatters: "Converts raw signal into actionable campaign intelligence without manual operator synthesis each morning.",
    targetAgentType: "Analysis agent — Class 1 (observation / analysis)",
    inputsProvided: "Last 24h dashboard data: cohort click rates, conversion events, channel performance, partner responses.",
    allowedTools: "Read-only telemetry access; summarisation and pattern-detection logic. No write actions.",
    constraints: "Must not make decisions — observation and recommendation only. Must flag data gaps rather than fill them. Brief must not exceed 400 words.",
    expectedOutput: "Structured brief: yesterday's signal highlights, top-performing angle, underperforming channels, recommended focus for today.",
    successMetric: "Brief used by Marketa to set daily sequencing decisions.",
    rewardLogic: "KNYT credit on brief acceptance. Accumulates toward standing with consistent daily delivery.",
    trustImpactPositive: "Brief used by Marketa without revision for sequencing decisions.",
    trustImpactNegative: "Brief contains errors, exceeds scope, or fails to flag significant signal.",
    escalationRule: "Escalate immediately if data signals a crisis-level pattern (e.g. significant conversion drop) — flag outside the daily brief.",
    ownerReviewer: "Marketa",
    requiresHumanApproval: false,
    timeSensitivity: "Daily — before campaign operator's morning session.",
    priorityLevel: "High",
    relatedCampaignPhase: "All active campaign phases",
  },
  {
    id: "M-005", title: "Partner Follow-up Ranking",
    category: "partner", trustClass: 2, stage: "defined",
    objective: "Recommend which partner deserves the next higher-touch follow-up based on live signal.",
    whyItMatters: "Ensures partner capacity is allocated to the relationships with the highest near-term yield.",
    targetAgentType: "Analysis agent — Class 2 (draft / assist with ranking output)",
    inputsProvided: "Partner contact log: last-contact date, response signal, partner type, strategic tier classification.",
    allowedTools: "Read-only partner data; ranking logic. No outreach or messaging.",
    constraints: "Ranking must be based on observable signals only — not speculation. Must not recommend partners outside current campaign scope. Must not initiate or draft outreach.",
    expectedOutput: "Ranked partner list with tier label (prioritise now / monitor / hold) and brief signal rationale per entry.",
    successMetric: "Ranking accepted by operator and used to guide actual outreach sequencing.",
    rewardLogic: "KNYT credit on ranking acceptance and confirmed use in ops.",
    trustImpactPositive: "Ranking directly guides outreach sequencing with positive partner response.",
    trustImpactNegative: "Ranking misses key signals or creates harmful sequencing decisions.",
    escalationRule: "Escalate if a partner response contains ambiguous signals that could indicate either high interest or disengagement.",
    ownerReviewer: "Campaign operator / Outreach lead",
    requiresHumanApproval: true,
    timeSensitivity: "Weekly or on-demand",
    relatedCampaignPhase: "Partner activation",
  },
  {
    id: "M-006", title: "Next-best-action Recommendation",
    category: "participation", trustClass: 3, stage: "defined",
    objective: "Recommend the next-best-action for users or investors after click, backing, or initial engagement.",
    whyItMatters: "Deepens post-backing participation and moves patrons along the KNYT constitutional progression arc.",
    targetAgentType: "Optimization agent — Class 3 (influences sequencing / workflow)",
    inputsProvided: "User/investor journey state, cohort classification, last action taken, content consumed, backing status.",
    allowedTools: "Read-only journey state and cohort data; recommendation logic. No direct send or deploy actions without human review.",
    constraints: "Must not recommend actions outside user's current journey band. Must not recommend economic commitments the data does not support. Outputs are recommendations for human deployment only.",
    expectedOutput: "Per-user or per-segment NBA recommendations with rationale. Format ready for Runtime / KNYT / Tasks & Rewards deployment.",
    successMetric: "Recommendations deployed by operator and generate positive engagement signal.",
    rewardLogic: "KNYT credit when recommendations are deployed and confirmed to increase engagement.",
    trustImpactPositive: "Recommendations deployed and increase user progression or engagement rate.",
    trustImpactNegative: "Recommendations misclassify journey stage or create friction for users.",
    escalationRule: "Escalate if a user's journey state is ambiguous or if a recommendation would cross a trust-class boundary.",
    ownerReviewer: "Campaign operator / Runtime lead",
    requiresHumanApproval: true,
    relatedCampaignPhase: "Post-backing / post-click deepening",
  },
  {
    id: "M-007", title: "Mission Boundary Review",
    category: "governance", trustClass: 3, stage: "defined",
    objective: "Flag whether a mission or submitted output drifted outside its intended bounds.",
    whyItMatters: "Keeps the constitutional pilot honest — turns scope violations into learning rather than silent drift.",
    targetAgentType: "Governance agent — Class 3 (optimize / route with constitutional scope)",
    inputsProvided: "Mission definitions, submitted outputs, and decision records from prior completed missions.",
    allowedTools: "Read access to mission board, output references, and charter documents; analysis and flag logic.",
    constraints: "Must not modify mission definitions or outputs. Must not assign blame without evidence. Flags are advisory — human decides all remediation.",
    expectedOutput: "Review report: missions flagged for scope drift, specific outputs that exceeded bounds, suggested charter clarifications.",
    successMetric: "Review leads to accepted charter improvement or confirmed scope clarification.",
    rewardLogic: "KNYT credit when review findings are accepted and lead to charter or constraint improvement.",
    trustImpactPositive: "Boundary flags accepted and used to improve charter language or mission design.",
    trustImpactNegative: "False positives that waste significant operator review time.",
    escalationRule: "Escalate immediately if a scope violation appears to have caused external harm or data exposure.",
    ownerReviewer: "Constitutional pilot lead / Admin",
    requiresHumanApproval: true,
    relatedCampaignPhase: "All phases — continuous",
  },
];

// ─── Receipt model (shared across all missions) ───────────────────────────────

const RECEIPT_FIELDS: { field: string; source: AcquisitionSource; who: string; when: string }[] = [
  { field: "Mission ID",           source: "system-captured",  who: "Auto-assigned",                     when: "At mission creation" },
  { field: "Assigned agent",       source: "agent-declared",   who: "Root Agent ID via signing key",     when: "At assignment / registration" },
  { field: "Input references",     source: "admin-defined",    who: "Operator defines; system delivers", when: "At assignment" },
  { field: "Submission timestamp", source: "system-captured",  who: "Auto-timestamped",                  when: "On submit" },
  { field: "Output reference",     source: "system-captured",  who: "Hash / CID of submitted content",   when: "On submit" },
  { field: "Reviewer",             source: "admin-defined",    who: "Named at mission creation",         when: "At mission definition" },
  { field: "Decision",             source: "human-reviewed",   who: "Named reviewer — accept / reject / remediate", when: "At review stage" },
  { field: "Reward applied",       source: "receipt-logged",   who: "Operator approves; system records", when: "After acceptance" },
  { field: "Trust effect applied", source: "receipt-logged",   who: "System — based on decision",        when: "After acceptance" },
  { field: "Notes / remediation",  source: "human-reviewed",   who: "Reviewer — if remediation needed",  when: "At review stage" },
];

// ─── Field row helper ─────────────────────────────────────────────────────────

function FieldRow({ label, value, source }: { label: string; value: string; source: AcquisitionSource }) {
  const acq = ACQ[source];
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${acq.color}`}>{acq.label}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{value}</p>
    </div>
  );
}

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionCard({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const cat = CAT[mission.category];
  const catCard = CAT_CARD[mission.category];
  const cls = CLS[mission.trustClass];
  const stg = STAGE[mission.stage];

  return (
    <div className={`rounded-xl border ${catCard.border} ${catCard.bg} overflow-hidden`}>
      {/* Row — always visible */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex-1 text-left text-sm font-medium text-slate-100"
        >
          {mission.title}
        </button>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold flex-shrink-0 ${cat.color}`}>{cat.label}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold flex-shrink-0 ${cls.color}`}>{cls.label}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0 ${stg.color}`}>{stg.label}</span>
        {mission.requiresHumanApproval && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500 flex-shrink-0">
            <Shield className="h-3 w-3" />
            Approval
          </div>
        )}
        <button type="button" onClick={() => setOpen(!open)} className="flex-shrink-0">
          {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-slate-700/40 px-3 pb-4 pt-3 flex flex-col gap-5">
          {/* Mission ID + objective + class description */}
          <div className="flex items-start gap-3">
            <span className="text-[10px] font-mono text-slate-500 flex-shrink-0 pt-0.5">{mission.id}</span>
            <div className="flex-1 space-y-1">
              <p className="text-xs text-slate-300 leading-relaxed">{mission.objective}</p>
              <p className="text-[10px] text-slate-500 italic">{cls.desc}</p>
            </div>
          </div>

          {/* Scope */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Scope</h4>
            <FieldRow label="Why it matters" value={mission.whyItMatters} source="admin-defined" />
            {mission.relatedCampaignPhase && <FieldRow label="Campaign phase" value={mission.relatedCampaignPhase} source="admin-defined" />}
            {mission.relatedInvestorCohort && <FieldRow label="Investor cohort" value={mission.relatedInvestorCohort} source="admin-defined" />}
            {mission.relatedContentAsset && <FieldRow label="Content asset" value={mission.relatedContentAsset} source="admin-defined" />}
            {mission.timeSensitivity && <FieldRow label="Time sensitivity" value={mission.timeSensitivity} source="admin-defined" />}
            {mission.priorityLevel && <FieldRow label="Priority" value={mission.priorityLevel} source="admin-defined" />}
          </div>

          {/* Delegation */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Delegation Spec</h4>
            <FieldRow label="Target agent type"              value={mission.targetAgentType}  source="admin-defined" />
            <FieldRow label="Inputs provided"                value={mission.inputsProvided}   source="admin-defined" />
            <FieldRow label="Allowed tools"                  value={mission.allowedTools}     source="admin-defined" />
            <FieldRow label="Constraints / policy boundaries" value={mission.constraints}      source="admin-defined" />
          </div>

          {/* Output */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-semibold text-purple-400 uppercase tracking-widest">Output Spec</h4>
            <FieldRow label="Expected output" value={mission.expectedOutput} source="admin-defined" />
            <FieldRow label="Success metric"  value={mission.successMetric}  source="admin-defined" />
          </div>

          {/* Economics */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest">Economics</h4>
            <FieldRow label="Reward logic"            value={mission.rewardLogic}          source="admin-defined" />
            <FieldRow label="Trust impact — positive" value={mission.trustImpactPositive}  source="receipt-logged" />
            <FieldRow label="Trust impact — negative" value={mission.trustImpactNegative}  source="receipt-logged" />
          </div>

          {/* Governance */}
          <div className="flex flex-col gap-3">
            <h4 className="text-[10px] font-semibold text-rose-400 uppercase tracking-widest">Governance</h4>
            <FieldRow label="Escalation rule"  value={mission.escalationRule} source="admin-defined" />
            <FieldRow label="Owner / reviewer" value={mission.ownerReviewer}  source="admin-defined" />
          </div>

          {/* Receipt model */}
          <div className="flex flex-col gap-2">
            <h4 className="text-[10px] font-semibold text-cyan-400 uppercase tracking-widest">Receipt Model — Verifiable Acquisition</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-1">
              Each field below is acquired at a specific lifecycle stage and recorded permanently. This turns mission participation into a constitutional instrument rather than a black-box task.
            </p>
            <div className="rounded-lg border border-slate-700/40 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/40 bg-slate-800/40">
                    <th className="text-left py-1.5 px-3 text-[10px] text-slate-400 font-medium">Receipt field</th>
                    <th className="text-left py-1.5 px-3 text-[10px] text-slate-400 font-medium">Source</th>
                    <th className="text-left py-1.5 px-3 text-[10px] text-slate-400 font-medium hidden sm:table-cell">Who / how</th>
                    <th className="text-left py-1.5 px-3 text-[10px] text-slate-400 font-medium hidden md:table-cell">When</th>
                  </tr>
                </thead>
                <tbody>
                  {RECEIPT_FIELDS.map((r, i) => {
                    const acq = ACQ[r.source];
                    return (
                      <tr key={r.field} className={i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-800/20"}>
                        <td className="py-1.5 px-3 text-slate-300">{r.field}</td>
                        <td className="py-1.5 px-3">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${acq.color}`}>{acq.label}</span>
                        </td>
                        <td className="py-1.5 px-3 text-slate-400 hidden sm:table-cell">{r.who}</td>
                        <td className="py-1.5 px-3 text-slate-500 hidden md:table-cell">{r.when}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ethos mission board ──────────────────────────────────────────────────────

function EthosMissionBoard() {
  const [filter, setFilter] = useState<"all" | MissionCategory>("all");
  const visible = filter === "all" ? MISSIONS : MISSIONS.filter(m => m.category === filter);
  const cats = Array.from(new Set(MISSIONS.map(m => m.category)));

  return (
    <div className="flex flex-col gap-5">
      {/* Health header */}
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">Constitutional Pilot Health</span>
          <span className="ml-auto text-xs text-slate-500 italic">α — seed data</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {([
            { label: "Human demand",       value: 7, sub: "missions seeded",    Icon: Users },
            { label: "Agent supply",       value: 0, sub: "missions assigned",  Icon: Cpu },
            { label: "Receipts issued",    value: 0, sub: "completed",          Icon: CheckCircle2 },
            { label: "Trust progressions", value: 0, sub: "band advances",      Icon: Scale },
          ] as const).map(({ label, value, sub, Icon }) => (
            <div key={label} className="rounded-lg bg-slate-900/60 border border-slate-700/40 p-3 text-center">
              <Icon className="h-4 w-4 text-slate-400 mx-auto mb-1" />
              <div className="text-xl font-bold text-slate-100">{value}</div>
              <div className="text-[10px] font-medium text-slate-300">{label}</div>
              <div className="text-[10px] text-slate-500">{sub}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3">Mission → Trust → Standing → Contribution. The board is the first place where the constitutional theory becomes operational reality.</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === "all" ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300" : "border-slate-700/60 text-slate-400 hover:text-slate-300"}`}>
          All ({MISSIONS.length})
        </button>
        {cats.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === cat ? CAT[cat].color : "border-slate-700/60 text-slate-400 hover:text-slate-300"}`}>
            {CAT[cat].label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {visible.map(m => <MissionCard key={m.id} mission={m} />)}
      </div>
    </div>
  );
}

// ─── Stubs ────────────────────────────────────────────────────────────────────

function StubPanel({ side }: { side: "mythos" | "logos" }) {
  const isMythos = side === "mythos";
  return (
    <div className={`rounded-xl border p-6 flex flex-col items-center text-center gap-4 ${isMythos ? "border-rose-700/30 bg-rose-950/20" : "border-blue-700/30 bg-blue-950/20"}`}>
      {isMythos ? <BookOpen className="h-8 w-8 text-rose-400/60" /> : <Brain className="h-8 w-8 text-blue-400/60" />}
      <div>
        <h2 className="text-base font-semibold text-slate-200 mb-1">
          {isMythos ? "Human Missions — Demand Side" : "Agent Missions — Supply Side"}
        </h2>
        <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
          {isMythos
            ? "Humans enter through mythos — story, identity, emotion, and belonging."
            : "Agents enter through logos — mission clarity, bounded delegation, measurable contribution, and receipts."}
        </p>
      </div>
      <div className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-4 max-w-md text-left">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-2">Coming next</p>
        <p className="text-xs text-slate-400 leading-relaxed">
          {isMythos
            ? "Active when human mission intake flows from the KNYT Wheel campaign: investor tasks, collector quests, creator missions, and the patron progression arc."
            : "Active when agent mission intake is open: root identity registration, Agent Charter acceptance, mission assignment, receipt logging, and trust band progression."}
        </p>
      </div>
      <p className="text-xs text-slate-600 italic">Both stay and scale through ethos — the constitutional layer visible in the Missions Board.</p>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const TABS: { id: SubTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "mythos", label: "Mythos", Icon: BookOpen },
  { id: "ethos",  label: "Ethos",  Icon: ClipboardList },
  { id: "logos",  label: "Logos",  Icon: Brain },
];

export function AigentMissionsBoardTab() {
  const [active, setActive] = useState<SubTab>("ethos");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        <img src="/images/metaknyt-logo.png" alt="" className="h-5 w-5 object-contain shrink-0" />
        <div className="flex gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActive(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active === id ? "bg-emerald-600/25 border border-emerald-600/40 text-emerald-300" : "text-slate-400 hover:text-slate-300 border border-transparent"}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <Badge variant="outline" className="ml-auto text-[10px] border-emerald-700/50 text-emerald-400 shrink-0">Constitutional Pilot α</Badge>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {active === "mythos" && <StubPanel side="mythos" />}
        {active === "ethos"  && <EthosMissionBoard />}
        {active === "logos"  && <StubPanel side="logos" />}
      </div>
    </div>
  );
}
