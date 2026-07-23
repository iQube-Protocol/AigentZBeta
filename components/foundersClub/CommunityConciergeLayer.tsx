'use client';

/**
 * CommunityConciergeLayer — the Founders Club's single visible face.
 *
 * PRD-FDC-001 (Founders Club) §0.3/§4.1/§9.1 principle 12
 * (`codexes/packs/agentiq/updates/2026-07-22_prd-fdc-001-founders-club.md`),
 * built as Increment 2 of the implementation plan (`codexes/packs/agentiq/
 * updates/2026-07-22_prd-foi-001-implementation-plan.md`, §2 "Increment 2").
 *
 * This is a Founders-Club-scoped INSTANCE of the existing
 * `SmartTriadCopilotLayer` "one face, many capabilities" pattern
 * (`components/smarttriad/copilot/SmartTriadCopilotLayer.tsx`) — mirrored,
 * not forked, exactly as `DevCommandCenterTab.tsx`'s `agent={{ id: "aigent-z",
 * name: "aigentZ" }}` and `marketa-codex`'s `agent={{ id: 'aigent-marketa',
 * name: 'Marketa' }}` already instantiate the same shared component for
 * their own single-face surfaces. `renderDots` (the R/T scoring dots) and
 * the busy-pulse are inherited for free from the shared component — this
 * file does not reimplement them.
 *
 * ── Scope note (Increment 2 acceptance bar) ─────────────────────────────
 * This is a SHELL: the copilot chrome, the single-face pattern, and a
 * routing scaffold that can name and dispatch toward each of the 8
 * base-roster agents (`services/founders-club/agentRoster.ts`) — not each
 * specialist's full, deep capability build. Concretely, of the 8 roster
 * agents:
 *
 *   - Opportunity Scout  — REAL logic: runs the actual Phase 1 interim
 *     matching heuristic (`services/founders-club/matchingHeuristic.ts`,
 *     `computeFoundersClubMatch` — pure, no server dependency, safe to call
 *     client-side) against the optional `matchCandidates` prop and seeds the
 *     chip's prompt with the real, explainable "matched you because..."
 *     rationale. No LLM call is needed to produce this narration; if the
 *     operator sends it, the Concierge chat can further riff on it.
 *   - Recognition Steward — REAL logic: when the optional `standingScore`
 *     prop is supplied, narrates it deterministically (qualified/bucket) —
 *     no LLM call needed to produce the narration.
 *   - Community Concierge, Network Navigator, Founder Coach, Event Curator,
 *     Circle Facilitator, Introduction Broker — STUB routing only: the chip
 *     seeds a prompt naming the specialist and its function (from the
 *     registry) and sends it to the Concierge chat turn; no dedicated
 *     specialist business logic (event calendars, wellbeing check-in
 *     engines, outreach-execution wiring, etc.) is built in this increment.
 *
 * ── Known follow-up (verify once both increments have merged) ──────────
 * `services/founders-club/matchingHeuristic.ts` imports
 * `ConstitutionalActionMode`-adjacent shape loosely as `string[]` per this
 * session's sibling-agent file-scope constraint on
 * `services/iqube/experienceQube.ts`. At authoring time that file already
 * carried `ConstitutionalActionMode`/`VALID_ACTION_MODES` (the sibling
 * Increment 1 had landed), so no import failure is expected — but this was
 * not re-verified after this session's own final commit merged with any
 * later sibling changes. A future session should confirm the import still
 * resolves cleanly.
 *
 * ── What this file does NOT do (explicitly out of scope) ───────────────
 * - Does not register a `founders-club` tab/slug in `data/codex-configs.ts`
 *   (reserved — see this session's final report for the exact snippet).
 * - Does not extend `FounderOfficeTab.tsx`'s `SubView` union or render a
 *   "Founders Club" primary section — that is the future `FoundersClubTab.tsx`
 *   host component's job (PRD-FDC-001 §2.1); this file is only the copilot
 *   shell such a host would mount.
 * - Does not register an `aigent-community-concierge` persona/system-prompt
 *   in `app/data/personas.ts` or the `/api/codex/chat` persona resolution
 *   path — sending a message through this shell will resolve to whatever
 *   fallback persona the chat route already applies to an unrecognised
 *   `aigent-*` id (see `SmartTriadCopilotLayer`'s own `resolvedPersona`
 *   comment). Flagged in this session's final report as a follow-up.
 */

import React, { useMemo } from 'react';
import {
  SmartTriadCopilotLayer,
  type SuggestedLayoutHint,
} from '@/components/smarttriad/copilot/SmartTriadCopilotLayer';
import {
  FOUNDERS_CLUB_AGENT_ROSTER,
  foundersClubSpecialists,
  type FoundersClubAgentId,
} from '@/services/founders-club/agentRoster';
import {
  computeFoundersClubMatch,
  type FoundersClubMatchCandidate,
} from '@/services/founders-club/matchingHeuristic';

export interface CommunityConciergeLayerProps {
  variant?: 'floating' | 'embedded' | 'panel';
  personaId?: string;
  className?: string;
  /**
   * Optional pair of match candidates (e.g. the current founder + a
   * prospective introduction) — when both are present, the "Find
   * opportunities" chip (Opportunity Scout) runs the REAL Phase 1 interim
   * matching heuristic and seeds its prompt with the actual explainable
   * rationale, rather than a generic stub prompt.
   */
  matchCandidates?: { self: FoundersClubMatchCandidate; other: FoundersClubMatchCandidate } | null;
  /**
   * Optional current founder Standing score (0..100, from
   * `computeStandingScore()`) — when supplied, the "My standing" chip
   * (Recognition Steward) narrates it deterministically instead of a
   * generic stub prompt.
   */
  standingScore?: number | null;
  onSuggestedLayouts?: (hints: SuggestedLayoutHint[]) => void;
  onClose?: () => void;
}

/** Recognition Steward's deterministic narration — no LLM call needed. */
function narrateStanding(score: number): string {
  const bucket =
    score >= 75 ? 'strong' : score >= 50 ? 'solid' : score >= 25 ? 'building' : 'early';
  return (
    `My Standing narration: your current Standing is ${score}/100 (${bucket}). ` +
    `Tell me about a recent verified outcome and I'll help you understand what it does for your Standing.`
  );
}

/** Builds the routing-scaffold seed prompt for one roster agent. Real logic
 *  for Opportunity Scout / Recognition Steward when their optional data
 *  props are supplied; a stub routing prompt otherwise (see file doc). */
function seedPromptFor(
  agentId: FoundersClubAgentId,
  opts: {
    matchCandidates?: CommunityConciergeLayerProps['matchCandidates'];
    standingScore?: number | null;
  },
): string {
  const agent = FOUNDERS_CLUB_AGENT_ROSTER.find((a) => a.id === agentId);
  const name = agent?.name ?? agentId;

  if (agentId === 'opportunity-scout' && opts.matchCandidates) {
    const result = computeFoundersClubMatch(opts.matchCandidates.self, opts.matchCandidates.other);
    return `${name}: ${result.rationale} (match score ${result.score}/100)`;
  }

  if (agentId === 'recognition-steward' && typeof opts.standingScore === 'number') {
    return narrateStanding(opts.standingScore);
  }

  // Stub routing — names the specialist and its function so the Concierge
  // chat turn has real grounding even though the deep capability isn't
  // built yet (this increment's explicit non-goal, per the file doc).
  return `Ask ${name} — ${agent?.function ?? 'a Founders Club specialist'}`;
}

/**
 * The Founders Club's single visible face. A thin configuration wrapper
 * over `SmartTriadCopilotLayer` — no forked chrome, no new chat transport.
 */
export function CommunityConciergeLayer({
  variant = 'panel',
  personaId,
  className,
  matchCandidates,
  standingScore,
  onSuggestedLayouts,
  onClose,
}: CommunityConciergeLayerProps) {
  const quickPrompts = useMemo(
    () =>
      foundersClubSpecialists().map((agentEntry) => ({
        id: agentEntry.id,
        label: agentEntry.chipLabel,
        prompt: agentEntry.name,
        seedPrompt: seedPromptFor(agentEntry.id, { matchCandidates, standingScore }),
      })),
    [matchCandidates, standingScore],
  );

  return (
    <SmartTriadCopilotLayer
      isOpen
      variant={variant}
      className={className}
      quickPrompts={quickPrompts}
      promptPlaceholder="Ask Community Concierge — connections, opportunities, standing, events…"
      agent={{ id: 'aigent-community-concierge', name: 'Community Concierge' }}
      agentSubtitle="Founders Club · Human Domain"
      initialMessage={
        "I'm Community Concierge — your single guide to the Founders Club. Ask me about " +
        'opportunities, introductions, your standing, upcoming events, or peer circles — I ' +
        'route to the right specialist behind the scenes.'
      }
      personaId={personaId}
      onSuggestedLayouts={onSuggestedLayouts}
      onClose={onClose ?? (() => undefined)}
    />
  );
}
