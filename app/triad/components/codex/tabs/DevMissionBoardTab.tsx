"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Target, CheckCircle2, Circle, ChevronDown, ChevronUp, Lock, Loader2, ExternalLink, Shield, Coins } from "lucide-react";
import { buildCodexUrl } from "@/utils/codex-nav";

interface Mission {
  id: string;
  title: string;
  description: string;
  steps: string[];
  reward: string;
  trustBandRequired?: string;
}

interface MissionTrack {
  id: string;
  label: string;
  color: string;
  missions: Mission[];
}

interface DevMissionBoardTabProps {
  personaId?: string;
}

const TRACKS: MissionTrack[] = [
  {
    id: "beginner",
    label: "Beginner",
    color: "green",
    missions: [
      {
        id: "m-read-start-here",
        title: "Read the Start Here guide",
        description: "Get oriented — understand what AgentiQ OS is and what you can build.",
        steps: ["Open the Start Here tab", "Read the full page", "Note 3 things you want to build"],
        reward: "Foundation badge",
      },
      {
        id: "m-install-sdk",
        title: "Install the AgentiQ SDK",
        description: "Get the SDK installed in a local project.",
        steps: [
          "Run `npm install @agentiq/sdk`",
          "Run `npx agentiq init my-cartridge`",
          "Verify the scaffolded directory structure",
        ],
        reward: "SDK Pioneer badge",
      },
      {
        id: "m-read-protocols",
        title: "Read the Protocol Reference",
        description: "Understand the three protocols: iQube, Qripto, and Aigent.",
        steps: ["Open Docs / KB → Protocols", "Read all three protocol sections", "Understand disclosure classes"],
        reward: "Protocol Reader badge",
      },
    ],
  },
  {
    id: "builder",
    label: "Builder",
    color: "blue",
    missions: [
      {
        id: "m-create-persona",
        title: "Create a Developer Persona",
        description: "Create your bounded developer identity with a Root DiD.",
        steps: [
          "Open the Persona tab",
          "Complete PersonaCreationForm",
          "Note your persona ID and Root DiD",
        ],
        reward: "Identity Architect badge",
        trustBandRequired: "L1_EXPERIMENTAL",
      },
      {
        id: "m-grant-delegation",
        title: "Grant Bounded Delegation",
        description: "Grant Aigent C-OS authority using the bounded delegation model.",
        steps: [
          "Open the Delegation tab",
          "Select trust band L2_VERIFIED_COMMUNITY",
          "Choose allowed actions and TTL",
          "Confirm grant and review the PolicyEnvelope",
        ],
        reward: "Delegation Architect badge",
        trustBandRequired: "L2_VERIFIED_COMMUNITY",
      },
      {
        id: "m-ask-aigent-c-os",
        title: "Ask Aigent C-OS a technical question",
        description: "Use the grounded copilot to answer a question about AgentiQ OS protocols.",
        steps: [
          "Open the Aigent C copilot (bottom-right button)",
          "Ask: 'What is the PolicyEnvelope in bounded delegation?'",
          "Note which KB doc was cited in the response",
        ],
        reward: "Copilot User badge",
      },
    ],
  },
  {
    id: "registry",
    label: "Registry",
    color: "violet",
    missions: [
      {
        id: "m-browse-registry",
        title: "Browse the Registry",
        description: "Explore published Qube assets sorted by trust band.",
        steps: [
          "Open the Registry tab",
          "Filter by L2_VERIFIED_COMMUNITY or higher",
          "Find 3 SkillQubes relevant to your use case",
        ],
        reward: "Registry Explorer badge",
      },
      {
        id: "m-register-agent",
        title: "Register an AigentQube",
        description: "Define and register your first agent with capabilities and policy bindings.",
        steps: [
          "Define AigentQubeRegistration (see SDK Quickstart)",
          "Declare capabilities array",
          "Declare policyBindings array",
          "Submit to Registry at L1_EXPERIMENTAL",
        ],
        reward: "Agent Publisher badge",
        trustBandRequired: "L2_VERIFIED_COMMUNITY",
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    color: "orange",
    missions: [
      {
        id: "m-build-cartridge",
        title: "Build a Complete Cartridge",
        description: "Create a full cartridge pack with meta.json, collections, and at least 3 KB items.",
        steps: [
          "Scaffold with `npx agentiq init`",
          "Write meta.json and collections.json",
          "Write at least 3 markdown docs in items/",
          "Register at least one collection with 2+ items",
          "Submit pack to Registry at L1_EXPERIMENTAL",
        ],
        reward: "Cartridge Builder badge",
        trustBandRequired: "L2_VERIFIED_COMMUNITY",
      },
      {
        id: "m-publish-experience-qube",
        title: "Publish an ExperienceQube",
        description: "Define a depth ladder experience (pill → capsule → mini_runtime → codex).",
        steps: [
          "Define ExperienceQube with all 4 depth levels",
          "Define NBEPlan for each transition",
          "Publish as L1_EXPERIMENTAL",
          "Verify depth ladder appears in the Studio",
        ],
        reward: "Experience Designer badge",
        trustBandRequired: "L3_PRODUCTION_CANDIDATE",
      },
    ],
  },
  {
    id: "ecosystem",
    label: "Ecosystem",
    color: "rose",
    missions: [
      {
        id: "m-contribute-docs",
        title: "Contribute to Public Docs",
        description: "Submit a PR to the public AgentiQ OS repo with a documentation improvement.",
        steps: [
          "Fork iQube-Protocol/AgentiQ-OS",
          "Find a gap or error in docs/",
          "Submit a PR with the improvement",
          "Get merged by a reviewer",
        ],
        reward: "Open Source Contributor badge",
      },
      {
        id: "m-propose-protocol-change",
        title: "Propose a Protocol Improvement",
        description: "Open a GitHub issue proposing an improvement to an AgentiQ OS protocol spec.",
        steps: [
          "Identify a protocol gap or improvement",
          "Open an issue with [Protocol Proposal] prefix",
          "Include: problem, proposed solution, protocol impact",
          "Engage with reviewer feedback",
        ],
        reward: "Protocol Proposer badge",
        trustBandRequired: "L3_PRODUCTION_CANDIDATE",
      },
    ],
  },
];

const ALL_MISSION_IDS = TRACKS.flatMap((t) => t.missions.map((m) => m.id));
const TOTAL = ALL_MISSION_IDS.length;

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  green:  { bg: "bg-green-500/10",  border: "border-green-500/20",  text: "text-green-300",  badge: "bg-green-500/20 text-green-200" },
  blue:   { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-300",   badge: "bg-blue-500/20 text-blue-200" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-300", badge: "bg-violet-500/20 text-violet-200" },
  orange: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-300", badge: "bg-orange-500/20 text-orange-200" },
  rose:   { bg: "bg-rose-500/10",   border: "border-rose-500/20",   text: "text-rose-300",   badge: "bg-rose-500/20 text-rose-200" },
};

// Persists completed mission IDs in the journey_state.completed_experience_ids field.
// IDs are prefixed with "mission:" to namespace them from ExperienceQube IDs.
const MISSION_PREFIX = "mission:";

// Bridge stage to advance when a track is fully completed
const TRACK_BRIDGE_STAGE: Record<string, string> = {
  beginner:  'developer_active',
  builder:   'contributor_candidate',
  registry:  'registry_candidate',
  advanced:  'studio_candidate',
  ecosystem: 'partner_candidate',
};

// ─── KNYT Wheel reference missions (live cartridge preview) ───────────────────

type KnytCategory = "Segmentation" | "Outreach Support" | "Telemetry" | "Partner" | "Governance" | "Participation";

interface KnytMission {
  id: string;
  title: string;
  category: KnytCategory;
  trustClass: 1 | 2 | 3 | 4 | 5;
  objective: string;
  reward: string;
  requiresApproval: boolean;
}

const KNYT_CAT_COLOR: Record<KnytCategory, string> = {
  Segmentation:     "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "Outreach Support": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Telemetry:        "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  Partner:          "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Governance:       "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  Participation:    "bg-green-500/15 text-green-300 border-green-500/30",
};

const KNYT_CAT_CARD: Record<KnytCategory, { bg: string; border: string; badge: string }> = {
  Segmentation:     { bg: "bg-blue-500/10",   border: "border-blue-500/20",   badge: "bg-blue-500/20 text-blue-200" },
  "Outreach Support": { bg: "bg-purple-500/10", border: "border-purple-500/20", badge: "bg-purple-500/20 text-purple-200" },
  Telemetry:        { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",   badge: "bg-cyan-500/20 text-cyan-200" },
  Partner:          { bg: "bg-amber-500/10",   border: "border-amber-500/20",  badge: "bg-amber-500/20 text-amber-200" },
  Governance:       { bg: "bg-indigo-500/10",  border: "border-indigo-500/20", badge: "bg-indigo-500/20 text-indigo-200" },
  Participation:    { bg: "bg-green-500/10",   border: "border-green-500/20",  badge: "bg-green-500/20 text-green-200" },
};

const KNYT_TRUST_COLOR: Record<number, string> = {
  1: "bg-slate-500/20 text-slate-300",
  2: "bg-blue-500/20 text-blue-300",
  3: "bg-amber-500/20 text-amber-300",
  4: "bg-orange-500/20 text-orange-300",
  5: "bg-red-500/20 text-red-300",
};

const KNYT_TRUST_DESC: Record<number, string> = {
  1: "Observation / read-only",
  2: "Draft for human review",
  3: "Optimize / route workflow",
  4: "Operate within auditable boundary",
  5: "Contribute upstream to ecosystem",
};

const KNYT_MISSIONS: KnytMission[] = [
  {
    id: "M-001", title: "Investor Reactivation Prioritization",
    category: "Segmentation", trustClass: 1,
    objective: "Rank which investors deserve faster follow-up today based on cohort tag, backing amount, and email open/click history.",
    reward: "KNYT credit on operator acceptance — accumulates toward standing with consistent daily useful output.",
    requiresApproval: true,
  },
  {
    id: "M-002", title: "Zero KNYT Legacy Investor Identification",
    category: "Segmentation", trustClass: 1,
    objective: "Identify and validate $1,000+ investor candidates for premium-tier emphasis. Classify each as strong / borderline / exclude with rationale.",
    reward: "KNYT credit on list acceptance and confirmed use in premium-tier campaign ops.",
    requiresApproval: true,
  },
  {
    id: "M-003", title: "Codex Objection Handling Copy",
    category: "Outreach Support", trustClass: 2,
    objective: "Generate 5–10 copy variants (2–4 sentences each) addressing objections from legacy asset holders — suitable for email and SMS reuse.",
    reward: "KNYT credit when copy is approved and confirmed deployed in live outbound.",
    requiresApproval: true,
  },
  {
    id: "M-004", title: "Daily Campaign Telemetry Brief",
    category: "Telemetry", trustClass: 1,
    objective: "Summarise last 24h investor, partner, and channel performance into a structured brief: highlights, top angle, underperforming channels, today's focus.",
    reward: "KNYT credit on brief acceptance — daily delivery builds standing.",
    requiresApproval: false,
  },
  {
    id: "M-005", title: "Partner Follow-up Ranking",
    category: "Partner", trustClass: 2,
    objective: "Rank partners by next higher-touch follow-up priority using last-contact date, response signal, and strategic tier. Output: prioritise now / monitor / hold.",
    reward: "KNYT credit on ranking acceptance and confirmed use in outreach sequencing.",
    requiresApproval: true,
  },
  {
    id: "M-006", title: "Next-best-action Recommendation",
    category: "Participation", trustClass: 3,
    objective: "Recommend the next-best-action for users or investors after click, backing, or initial engagement. Output ready for Runtime / KNYT / Tasks & Rewards deployment.",
    reward: "KNYT credit when recommendations are deployed and generate positive engagement signal.",
    requiresApproval: true,
  },
  {
    id: "M-007", title: "Mission Boundary Review",
    category: "Governance", trustClass: 3,
    objective: "Flag whether any mission or submitted output drifted outside its intended bounds. Report: flagged missions, out-of-scope outputs, suggested charter clarifications.",
    reward: "KNYT credit when review findings are accepted and lead to charter or constraint improvements.",
    requiresApproval: true,
  },
];

export function DevMissionBoardTab({ personaId }: DevMissionBoardTabProps) {
  const [activePanel, setActivePanel] = useState<"your-missions" | "knyt-reference">("your-missions");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [knytExpanded, setKnytExpanded] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [loadingState, setLoadingState] = useState(true);

  const loadJourneyState = useCallback(async () => {
    if (!personaId) { setLoadingState(false); return; }
    try {
      const res = await fetch(`/api/runtime/journey?personaId=${encodeURIComponent(personaId)}`);
      if (!res.ok) return;
      const data = await res.json();
      const ids: string[] = data?.journey_state?.completed_experience_ids ?? [];
      const missionIds = ids
        .filter((id: string) => id.startsWith(MISSION_PREFIX))
        .map((id: string) => id.slice(MISSION_PREFIX.length));
      setCompleted(new Set(missionIds.filter((id: string) => ALL_MISSION_IDS.includes(id))));
    } catch {
      // non-fatal — local state still works
    } finally {
      setLoadingState(false);
    }
  }, [personaId]);

  useEffect(() => {
    loadJourneyState();
  }, [loadJourneyState]);

  async function persistCompletion(next: Set<string>, justCompleted?: string) {
    if (!personaId) return;
    setSyncing(true);
    try {
      const completedIds = [...next].map((id) => `${MISSION_PREFIX}${id}`);
      await fetch("/api/runtime/journey", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId,
          completed_experience_ids: completedIds,
        }),
      });

      if (justCompleted) {
        // Emit DVN receipt-eligible event for the mission
        void fetch("/api/runtime/orchestration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "z_delegated",
            persona_id: personaId,
            journey_stage: "acolyte",
            active_cartridge: "agentiq-os-cartridge",
            from_role: "aigent-z",
            to_role: "aigent-c",
            reason: `Mission completed: ${justCompleted}`,
            receipt_eligible: true,
            metadata: {
              mission_completed: true,
              mission_id: justCompleted,
              total_completed: next.size,
              agent_root_did: "did:iqube:aigent-c-os-root",
            },
          }),
        });

        // Check if this completion finished an entire track → advance CRM bridge stage
        const track = TRACKS.find((t) => t.missions.some((m) => m.id === justCompleted));
        if (track) {
          const allTrackMissionsDone = track.missions.every((m) => next.has(m.id));
          const bridgeStage = TRACK_BRIDGE_STAGE[track.id];
          if (allTrackMissionsDone && bridgeStage) {
            void fetch("/api/codex/agentiq-os/ecosystem-signup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                persona_id: personaId,
                bridge_stage: bridgeStage,
                completed_missions: [...next],
                notes: `Track completed: ${track.label}`,
              }),
            });
          }
        }
      }
    } catch {
      // non-fatal
    } finally {
      setSyncing(false);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function markComplete(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        void persistCompletion(next);
      } else {
        next.add(id);
        void persistCompletion(next, id);
      }
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700/60 border border-slate-600/40">
          <Target className="h-6 w-6 text-slate-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Developer Mission Board</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Your AgentiQ OS learning tracks — plus a live reference cartridge with real rewards.
          </p>
        </div>
      </div>

      {/* Panel toggle */}
      <div className="flex gap-1 rounded-lg border border-slate-700/60 bg-slate-900/40 p-1 w-fit">
        {(["your-missions", "knyt-reference"] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => setActivePanel(panel)}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activePanel === panel
                ? "bg-slate-700 text-slate-100"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {panel === "your-missions" ? "Your Missions" : "KNYT Reference"}
          </button>
        ))}
      </div>

      {/* ── Your Missions panel ── */}
      {activePanel === "your-missions" && (<>
      {loadingState ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading mission progress…
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span>{completed.size} of {TOTAL} missions completed</span>
          {syncing && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
        </div>
      )}

      {TRACKS.map((track) => {
        const colors = COLOR_MAP[track.color];
        const trackDone = track.missions.filter((m) => completed.has(m.id)).length;
        return (
          <div key={track.id} className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${colors.text}`}>{track.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${colors.badge}`}>
                  {trackDone}/{track.missions.length}
                </span>
              </div>
            </div>
            <div className="space-y-1 px-4 pb-4">
              {track.missions.map((mission) => {
                const done = completed.has(mission.id);
                const open = expanded === mission.id;
                return (
                  <div key={mission.id} className="rounded-lg border border-slate-700/40 bg-slate-900/40 overflow-hidden">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button type="button" onClick={() => markComplete(mission.id)} className="flex-shrink-0">
                        {done
                          ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                          : <Circle className="h-4 w-4 text-slate-600" />
                        }
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(mission.id)}
                        className={`flex-1 text-left text-sm ${done ? "line-through text-slate-500" : "text-slate-200"}`}
                      >
                        {mission.title}
                      </button>
                      {mission.trustBandRequired && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Lock className="h-3 w-3" />
                          {mission.trustBandRequired.replace("L", "").split("_")[0]}+
                        </div>
                      )}
                      <button type="button" onClick={() => toggle(mission.id)} className="flex-shrink-0">
                        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                      </button>
                    </div>
                    {open && (
                      <div className="px-3 pb-3 space-y-3 border-t border-slate-700/40 pt-3">
                        <p className="text-xs text-slate-400">{mission.description}</p>
                        <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
                          {mission.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">Reward: {mission.reward}</span>
                          <button
                            type="button"
                            onClick={() => markComplete(mission.id)}
                            className={`rounded-lg border px-3 py-1 text-xs transition ${
                              done
                                ? "border-slate-700 text-slate-500 hover:text-slate-300"
                                : "border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                            }`}
                          >
                            {done ? "Mark Incomplete" : "Mark Complete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </>)}

      {/* ── KNYT Reference panel ── */}
      {activePanel === "knyt-reference" && (
        <div className="space-y-4">
          {/* Intro */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
                <Target className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-300">KNYT Wheel — Live Reference Cartridge</p>
                <p className="text-xs text-slate-400">Real missions. Real KNYT rewards. Your agent can claim and fulfill these today.</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This is a production mission board from the KNYT Codex — a live cartridge already running with active investors,
              campaign ops, and KNYT credit rewards. It shows exactly what a production-grade agent mission board looks like:
              trust classes, bounded delegation scopes, human approval gates, and receipt-eligible reward logic.
            </p>
            <a
              href={buildCodexUrl("knyt-codex", { tab: "knyt-wheel", from: "agentiq-os", fromTab: "missions", shell: "viewer" })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Full KNYT Mission Board
            </a>
          </div>

          {/* Trust class legend */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Shield className="h-3 w-3" /> Trust Classes
            </p>
            <div className="grid grid-cols-1 gap-1">
              {([1, 2, 3] as const).map((cls) => (
                <div key={cls} className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${KNYT_TRUST_COLOR[cls]}`}>Class {cls}</span>
                  <span className="text-[11px] text-slate-500">{KNYT_TRUST_DESC[cls]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mission cards — styled to match Dev mission card look and feel */}
          {KNYT_MISSIONS.map((m) => {
            const open = knytExpanded === m.id;
            const card = KNYT_CAT_CARD[m.category];
            return (
              <div key={m.id} className={`rounded-xl border ${card.border} ${card.bg} overflow-hidden`}>
                {/* Row header */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setKnytExpanded(open ? null : m.id)}
                    className="flex-1 text-left text-sm text-slate-200"
                  >
                    {m.title}
                  </button>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${KNYT_CAT_COLOR[m.category]}`}>
                    {m.category}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${KNYT_TRUST_COLOR[m.trustClass]}`}>
                    Class {m.trustClass}
                  </span>
                  {m.requiresApproval && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Lock className="h-3 w-3" />
                      Approval
                    </div>
                  )}
                  <button type="button" onClick={() => setKnytExpanded(open ? null : m.id)} className="flex-shrink-0">
                    {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                  </button>
                </div>
                {/* Expanded detail */}
                {open && (
                  <div className="px-3 pb-3 space-y-3 border-t border-slate-700/40 pt-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{m.id}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{m.objective}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                        <span className="text-[11px] text-slate-500">Reward: {m.reward}</span>
                      </div>
                      <a
                        href={buildCodexUrl("knyt-codex", { tab: "knyt-wheel", from: "agentiq-os", fromTab: "missions", shell: "viewer" })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Claim in KNYT Codex
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
