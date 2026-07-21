/**
 * specialistRecommender — Phase 2 specialist layout (server side).
 *
 * Deterministic "who should I ask?" picker, optionally rerank-enriched
 * by the same Anthropic call shape the NBE reranker uses. Mirrors the
 * "rich KPI / NBA gating" pattern we already use elsewhere: activations
 * drive availability, the recommendation reasons from active cartridge
 * + primary goal + recent activity.
 *
 * Returns:
 *   - rosterStatus: every specialist's availability gating ('active',
 *     'needs-activation' with the source id, or 'always-available')
 *   - topSpecialistId + reason: the headline pick
 *   - alternates: 2 more candidates with shorter reasons
 *
 * Privacy: T0 identifiers never leave the resolver. The output is
 * persona-bound but T1-safe (specialist labels, cartridge slugs, short
 * reason strings only).
 */

import { getExperienceQube } from '@/services/iqube/experienceQube';
import { listRecentIntentsForPersona } from '@/services/iqube/intentQube';
import { getActiveActivationIds } from '@/services/activations/spineActivations';
import { getPersonaPlan } from '@/services/billing/personaPlan';
import { getPlanModelId } from '@/services/billing/planModelTier';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { SpecialistId } from '@/services/agents/specialistRouter';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL =
  process.env.SPECIALIST_RECOMMENDER_MODEL_ANTHROPIC ||
  'claude-haiku-4-5-20251001';

export type RosterAvailability =
  | { status: 'active' }
  | { status: 'always-available' }
  | { status: 'needs-activation'; activationId: string; activationLabel: string };

export interface SpecialistRosterEntry {
  id: SpecialistId;
  label: string;
  description: string;
  /** Activation gating computed against the persona's current state. */
  availability: RosterAvailability;
}

export interface SpecialistRecommendation {
  /** The pick aigentMe surfaces in the recommendation card. */
  topSpecialistId: SpecialistId;
  /** ≤200-char framing — references the actual cartridge / goal driving the pick. */
  reason: string;
  /** Up to 2 alternates, ranked. */
  alternates: Array<{ specialistId: SpecialistId; reason: string }>;
  /** Full roster with per-specialist availability gating. */
  roster: SpecialistRosterEntry[];
  /** Whether an LLM rerank pass shaped the order. False on fallback paths. */
  llmApplied: boolean;
}

const SPECIALIST_LABELS: Record<SpecialistId, string> = {
  marketa: 'Marketa',
  quill: 'Quill',
  kn0w1: 'Kn0w1',
  'aigent-z': 'Aigent Z',
  'aigent-c': 'Aigent C',
  'aigent-nakamoto': 'Nakamoto',
  moneypenny: 'MoneyPenny',
  metaye: 'Metayé',
  researcher: 'Research Copilot',
};

const SPECIALIST_DESCRIPTIONS: Record<SpecialistId, string> = {
  marketa: 'Campaigns, partners, proposals',
  quill: 'Editorial, storytelling, article briefs, issue planning',
  kn0w1: 'KNYT world, PCS, knowledge economics, missions',
  'aigent-z': 'Platform / system guidance',
  'aigent-c': 'Customer journey, AgentiQ OS builder context',
  'aigent-nakamoto': 'Decentralisation, Qripto protocols, ecosystem policy',
  moneypenny: 'Q¢ economics, micro-transactions, payment ops',
  metaye: 'Sovereign Cybernetic Polity, governance, civic primitives',
  researcher: 'Invariant substrate, experiments, protocols, structured discovery',
};

/**
 * Which activation (if any) unlocks the specialist. Specialists without
 * a gate are always available — they're platform/cross-cutting roles
 * that should respond regardless of which cartridges the persona has
 * switched on.
 */
const SPECIALIST_ACTIVATION_GATE: Record<SpecialistId, { id: string; label: string } | null> = {
  marketa: { id: 'marketa', label: 'Marketa' },
  quill: { id: 'qriptopian', label: 'The Qriptopian' },
  kn0w1: { id: 'mycanvas', label: 'myCanvas / KNYT' },
  metaye: { id: 'order-of-metaye', label: 'Order of Metayé' },
  researcher: { id: 'researcher', label: 'Research Copilot' },
  'aigent-z': null,
  'aigent-c': null,
  'aigent-nakamoto': null,
  moneypenny: null,
};

/**
 * Cartridge → most-relevant specialist. Used by the deterministic
 * baseline when the persona has a clear active cartridge but no other
 * signal. Lower priority means "preferred when both match".
 */
const CARTRIDGE_PRIMARY_SPECIALIST: Record<string, SpecialistId> = {
  knyt: 'kn0w1',
  mycanvas: 'kn0w1',
  qriptopian: 'quill',
  marketa: 'marketa',
  'order-of-metaye': 'metaye',
  'agentiq-os': 'aigent-c',
  'venture-lab': 'aigent-z',
  'metame-studio': 'aigent-z',
  metame: 'aigent-z',
  'irl-cartridge': 'researcher',
  'irl-os': 'researcher',
  researcher: 'researcher',
};

function computeRoster(activeActivationIds: Set<string>): SpecialistRosterEntry[] {
  const ids = Object.keys(SPECIALIST_LABELS) as SpecialistId[];
  return ids.map((id) => {
    const gate = SPECIALIST_ACTIVATION_GATE[id];
    let availability: RosterAvailability;
    if (!gate) {
      availability = { status: 'always-available' };
    } else if (activeActivationIds.has(gate.id)) {
      availability = { status: 'active' };
    } else {
      availability = {
        status: 'needs-activation',
        activationId: gate.id,
        activationLabel: gate.label,
      };
    }
    return {
      id,
      label: SPECIALIST_LABELS[id],
      description: SPECIALIST_DESCRIPTIONS[id],
      availability,
    };
  });
}

interface DeterministicPick {
  topSpecialistId: SpecialistId;
  reason: string;
  alternates: Array<{ specialistId: SpecialistId; reason: string }>;
}

function deterministicPick(
  activeCartridges: string[],
  primaryGoal: string | null,
  roster: SpecialistRosterEntry[],
  recentSpecialistsConsulted: SpecialistId[],
  query: string | null,
): DeterministicPick {
  // Lowercased query for the explicit-mention + keyword scan. When the
  // operator types "Draft Marketa partner outreach for Lamina 1" we
  // want Marketa to decisively win over the cartridge-bias default
  // (e.g. Kn0w1 from an active knyt cartridge).
  const q = query ? query.toLowerCase() : '';

  // Score every specialist deterministically. The score is the
  // composition of: cartridge fit, availability, recency penalty
  // (avoid suggesting the one we just consulted unless nothing else
  // fits), and a gentle "always-available" tiebreaker so platform
  // specialists don't dominate when no cartridge is active.
  const scoreById = new Map<SpecialistId, number>();
  let queryDrivenPick: SpecialistId | null = null;
  for (const entry of roster) {
    let score = 0;
    if (entry.availability.status === 'active') score += 50;
    else if (entry.availability.status === 'always-available') score += 20;
    // 'needs-activation' adds 0 but is still considered so we can
    // recommend an upgrade path when nothing else fits.

    // Cartridge fit — heaviest weight, since the persona's active
    // surfaces are the strongest signal about what they want help with.
    for (const cart of activeCartridges) {
      if (CARTRIDGE_PRIMARY_SPECIALIST[cart] === entry.id) score += 60;
    }

    // Primary goal text match — light heuristic. Catches "partner",
    // "editorial", "knowledge", "governance" without needing an LLM.
    if (primaryGoal) {
      const g = primaryGoal.toLowerCase();
      if (entry.id === 'marketa' && /(partner|campaign|sponsor|outreach|deal)/.test(g)) score += 25;
      if (entry.id === 'quill' && /(article|editorial|story|issue|publish)/.test(g)) score += 25;
      if (entry.id === 'kn0w1' && /(knyt|knowledge|mission|pcs|world)/.test(g)) score += 25;
      if (entry.id === 'metaye' && /(govern|policy|civic|sovereign|polity)/.test(g)) score += 25;
      if (entry.id === 'moneypenny' && /(payment|price|q¢|qcent|micro|economics)/.test(g)) score += 25;
      if (entry.id === 'aigent-nakamoto' && /(decentral|protocol|qripto|ecosystem)/.test(g)) score += 25;
    }

    // Query text match — heaviest weight when the operator's typed
    // request names the specialist directly or carries clear domain
    // keywords. Overrides cartridge bias so "Marketa outreach for X"
    // on a KNYT cartridge picks Marketa, not Kn0w1.
    if (q) {
      if (q.includes(entry.label.toLowerCase())) {
        score += 120;
        queryDrivenPick = entry.id;
      }
      if (entry.id === 'marketa' && /(partner|campaign|sponsor|outreach|deal|proposal)/.test(q)) score += 70;
      if (entry.id === 'quill' && /(article|editorial|story|issue|publish|draft)/.test(q)) score += 50;
      if (entry.id === 'kn0w1' && /(knyt|knowledge|mission|pcs|world|character)/.test(q)) score += 50;
      if (entry.id === 'metaye' && /(govern|policy|civic|sovereign|polity)/.test(q)) score += 50;
      if (entry.id === 'moneypenny' && /(payment|price|q¢|qcent|micro)/.test(q)) score += 50;
      if (entry.id === 'aigent-nakamoto' && /(decentral|protocol|qripto|ecosystem)/.test(q)) score += 50;
    }

    // Recency penalty — small nudge away from the one the persona just
    // talked to, so the recommendation feels alive rather than stuck.
    if (recentSpecialistsConsulted[0] === entry.id) score -= 8;

    scoreById.set(entry.id, score);
  }

  const ranked = [...roster]
    .sort((a, b) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0));

  const top = ranked[0];
  const reasonParts: string[] = [];
  // Query-driven picks get a query-first reason so the operator sees
  // why their typed request — not the cartridge — drove the pick.
  if (queryDrivenPick && queryDrivenPick === top.id) {
    reasonParts.push(`your request mentions ${top.label}`);
  }
  const topMatchesCartridge = activeCartridges.find(
    (c) => CARTRIDGE_PRIMARY_SPECIALIST[c] === top.id,
  );
  if (topMatchesCartridge) {
    reasonParts.push(`your active ${topMatchesCartridge} cartridge`);
  }
  if (primaryGoal) {
    reasonParts.push(`primary goal "${primaryGoal.slice(0, 60)}"`);
  }
  if (top.availability.status === 'needs-activation') {
    reasonParts.push(`activate ${top.availability.activationLabel} first`);
  }
  const reason = reasonParts.length > 0
    ? `${top.label} fits ${reasonParts.join(' + ')}.`
    : `${top.label} is the strongest general-purpose pick right now.`;

  const alternates = ranked.slice(1, 3).map((alt) => ({
    specialistId: alt.id,
    reason:
      alt.availability.status === 'needs-activation'
        ? `${alt.label} — activate ${alt.availability.activationLabel} to unlock.`
        : `${alt.label} — ${alt.description.toLowerCase()}.`,
  }));

  return { topSpecialistId: top.id, reason, alternates };
}

interface LlmRerankPayload {
  topSpecialistId: SpecialistId;
  reason: string;
  alternates: Array<{ specialistId: SpecialistId; reason: string }>;
}

const RERANK_SYSTEM = `You pick the best specialist for the user to consult right now from a fixed roster.

Return ONE JSON object exactly:
{
  "topSpecialistId": "<one of the supplied ids>",
  "reason": "<one short sentence — why this specialist for this persona right now>",
  "alternates": [
    { "specialistId": "<id>", "reason": "<short sentence>" },
    { "specialistId": "<id>", "reason": "<short sentence>" }
  ]
}

Rules:
- Use only specialist ids present in the input roster.
- Prefer specialists with availability "active". Only suggest
  "needs-activation" when nothing active fits; if you do, your reason
  must say which activation to switch on.
- Reason refers to the persona's actual primary goal / cartridge / query
  in concrete terms — no marketing copy.
- All strings ≤ 160 chars. No markdown.`;

async function callRerank(prompt: string, modelId?: string | null): Promise<LlmRerankPayload | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  const resolvedModel = modelId || ANTHROPIC_MODEL;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: 400,
        temperature: 0.2,
        system: RERANK_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const block = data?.content?.find((b) => b?.type === 'text');
    const raw = block?.text?.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LlmRerankPayload>;
    if (!parsed?.topSpecialistId || typeof parsed.reason !== 'string') return null;
    return parsed as LlmRerankPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface RecommendSpecialistInput {
  personaId: string;
  /** Optional free-form query the persona just typed (or the cold-open prompt). */
  query?: string | null;
  /**
   * Optional Capability Gateway pre-flight summary, routed into the
   * LLM rerank prompt the same way the NBE reranker uses it. No-op
   * when the LLM pass is off.
   */
  liveContext?: string | null;
  /**
   * Plan-tier model override from `getPlanModelId(personaPlan)`.
   * When set, replaces the env-var default for the LLM rerank call.
   */
  modelOverride?: string | null;
}

export async function recommendSpecialist(
  input: RecommendSpecialistInput,
): Promise<SpecialistRecommendation> {
  const adminClient = getSupabaseServer();
  const [qube, activeActivationIds, recentIntents, personaPlan] = await Promise.all([
    getExperienceQube(input.personaId).catch(() => null),
    getActiveActivationIds(input.personaId).catch(() => new Set<string>()),
    listRecentIntentsForPersona(input.personaId, { limit: 8 }).catch(() => []),
    input.modelOverride != null
      ? Promise.resolve(null)
      : adminClient
        ? getPersonaPlan(adminClient, input.personaId).catch(() => null)
        : Promise.resolve(null),
  ]);
  const modelOverride = input.modelOverride ?? getPlanModelId(personaPlan);

  const activeCartridges = qube?.meta.activeCartridges ?? [];
  const primaryGoal = qube?.meta.primaryGoal ?? null;
  const roster = computeRoster(activeActivationIds);

  // "Specialists I just talked to" — informs the recency nudge in the
  // deterministic pick. We treat the intent's targetAgents as the
  // signal (an ask_specialist intent stores the specialist there).
  // intent.targetAgents is SpecialistAgentId[] (includes 'aigent-me');
  // narrow to the SpecialistId subset that the recommender ranks.
  const recentSpecialists: SpecialistId[] = recentIntents
    .flatMap((i) => i.targetAgents as readonly string[])
    .filter((id): id is SpecialistId => id in SPECIALIST_LABELS);

  const baseline = deterministicPick(
    activeCartridges,
    primaryGoal,
    roster,
    recentSpecialists,
    input.query ?? null,
  );

  // LLM rerank — gated on key + query (no point burning a call when
  // there's nothing for the model to interpret beyond the heuristic).
  const liveContext =
    typeof input.liveContext === 'string' && input.liveContext.trim().length > 0
      ? input.liveContext.trim().slice(0, 600)
      : null;
  if (!ANTHROPIC_API_KEY || (!input.query && !liveContext)) {
    return { ...baseline, roster, llmApplied: false };
  }

  const payload = JSON.stringify(
    {
      persona: {
        activeCartridges,
        primaryGoal,
        currentStage: qube?.meta.currentStage ?? 'setup',
      },
      query: input.query ?? null,
      ...(liveContext ? { liveContext } : {}),
      recentlyConsulted: recentSpecialists.slice(0, 2),
      roster: roster.map((r) => ({
        id: r.id,
        label: r.label,
        description: r.description,
        availability: r.availability,
      })),
      deterministicBaseline: baseline,
    },
    null,
    2,
  );

  const llm = await callRerank(payload, modelOverride);
  if (!llm) {
    return { ...baseline, roster, llmApplied: false };
  }

  // Validate the LLM payload against the roster — never invent ids.
  const validIds = new Set(roster.map((r) => r.id));
  if (!validIds.has(llm.topSpecialistId)) {
    return { ...baseline, roster, llmApplied: false };
  }
  const alternates = (Array.isArray(llm.alternates) ? llm.alternates : [])
    .filter((a) => a && validIds.has(a.specialistId) && a.specialistId !== llm.topSpecialistId)
    .slice(0, 2)
    .map((a) => ({
      specialistId: a.specialistId as SpecialistId,
      reason: typeof a.reason === 'string' ? a.reason.slice(0, 200) : '',
    }));

  return {
    topSpecialistId: llm.topSpecialistId,
    reason: llm.reason.slice(0, 200),
    alternates,
    roster,
    llmApplied: true,
  };
}
