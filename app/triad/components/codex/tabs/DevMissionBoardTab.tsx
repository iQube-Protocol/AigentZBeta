"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Target, CheckCircle2, Circle, ChevronDown, ChevronUp, Lock, Loader2 } from "lucide-react";

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

export function DevMissionBoardTab({ personaId }: DevMissionBoardTabProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
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
      // Emit DVN receipt-eligible event for newly completed missions
      if (justCompleted) {
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
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      void persistCompletion(next);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-700/60 border border-slate-600/40">
          <Target className="h-6 w-6 text-slate-300" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Developer Mission Board</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Guided tracks from first install to ecosystem contributor.
          </p>
        </div>
      </div>

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
    </div>
  );
}
