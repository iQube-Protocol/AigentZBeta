/**
 * Specialist Router — Aigent Me Phase 5.
 *
 * Aigent Me coordinates with specialists (Marketa, Quill, Kn0w1, Aigent Z,
 * Aigent C) on behalf of the user. This module is the canonical
 * server-side entry point for invoking a specialist with a bounded,
 * scoped context packet and parsing a structured response.
 *
 * Per PRD v0.2 §5.4 (alpha multi-agent coordination), §11 (SpecialistAgent
 * Request / Response shapes), and the locked decisions doc:
 *   - Kn0w1 is the primary KNYT specialist label (also "KNYT Guide").
 *   - Quill is Qriptopian's resident editorial copilot.
 *   - Marketa is cross-cartridge for campaigns and partner work.
 *
 * Privacy contract:
 *   - The router only sees the SCOPED context the caller assembled. It
 *     never reads BlakQube values directly. The caller is responsible for
 *     redacting confidential strategy notes / private investor data /
 *     unreleased IP before invoking the router (per the iQube boundary
 *     rule in the locked decisions doc).
 *   - T0 identifiers (personaId, authProfileId, rootDid) MUST NOT appear
 *     in the prompt. The router defends against this with a redaction pass.
 *
 * LLM fallback strategy:
 *   1. OpenAI (OPENAI_API_KEY) if present
 *   2. Templated deterministic response otherwise (alpha demo path)
 *
 * Phase 5.b will add Anthropic + Venice fallback paths and the Phase 5
 * receipt emission. Today the IntentQube row carries enough for Phase 6
 * to attach a receipt when it lands.
 */

import { personas } from '@/app/data/personas';
import type { PreflightContext } from '@/services/capabilities/preflight';
import { GROUNDING_MANDATE, INVARIANT_GROUNDING_CLAUSE } from '@/services/orchestration/groundingContract';

// ─────────────────────────────────────────────────────────────────────────
// Types — public surface.
// ─────────────────────────────────────────────────────────────────────────

export type SpecialistId =
  | 'marketa'
  | 'quill'
  | 'kn0w1'
  | 'aigent-z'
  | 'aigent-c'
  | 'aigent-nakamoto'
  | 'moneypenny'
  | 'metaye'
  | 'researcher';

export type SpecialistRequestType =
  | 'proposal'
  | 'editorial_angle'
  | 'mission_recommendation'
  | 'system_guidance'
  | 'customer_journey'
  | 'partner_brief'
  | 'campaign_brief'
  | 'article_brief'
  | 'decentralisation_brief'
  | 'policy_brief'
  | 'micro_economics_brief'
  | 'sovereignty_brief'
  | 'research_brief';

export interface SpecialistContext {
  /** Cartridge the specialist should treat as primary. */
  activeCartridge: string;
  /** Bounded summary of the user's ExperienceModel meta slice. */
  experienceName: string | null;
  experienceType: string;
  primaryGoal: string | null;
  currentStage: string;
  activeCartridges: string[];
  /** What the user wants. */
  intentName: string;
  intentRationale: string | null;
  /**
   * Optional freeform prompt the user attached when asking the specialist.
   */
  userPrompt?: string;
  /**
   * Invariant slice (CFS-006 §2) — the context-filtered, standing-ranked
   * validated invariants applicable to this intent. Statement-level meta only
   * (T1-safe); assembled by the Invariant Service's buildInvariantSlice at the
   * call site. When present, the specialist is bound to ground on and cite
   * these (INVARIANT_GROUNDING_CLAUSE).
   */
  invariantSlice?: { seedId: string | null; statement: string; namespace: string }[];
}

export interface SpecialistResponse {
  specialistId: SpecialistId;
  specialistLabel: string;
  requestType: SpecialistRequestType;
  /** Headline-style title for the response. */
  title: string;
  /** Short summary (1-3 sentences) framing the recommendation. */
  summary: string;
  /** Bulleted recommendations. */
  recommendations: string[];
  /** Suggested artifact types the user could ask Aigent Me to produce. */
  suggestedArtifacts: string[];
  /** Whether the response implies a consequential action requiring approval. */
  requiresApproval: boolean;
  /** Specialist's confidence in the recommendation. */
  confidence: 'low' | 'medium' | 'high';
  /** Source of the response — 'llm' (live) or 'template' (deterministic fallback). */
  source: 'llm' | 'template';
  /** When the response was generated. */
  generatedAt: string;
  /**
   * Capability Gateway pre-flight result. Present only when
   * CAPABILITY_GATEWAY_PREFLIGHT covers the specialist and the gather
   * succeeded. The aigentMe response surface today also prepends the
   * summary into the rationale; this field lets the UI render it as a
   * dedicated byline going forward.
   */
  preflightContext?: PreflightContext;
  /**
   * Set by the ask-agent route when the consultation was a hand-off
   * from another specialist. The SpecialistsLayout renders a "← from X"
   * pill on the response card and threads the prior title into the
   * specialist's framing so the back-and-forth reads as a conversation
   * rather than a fresh ask.
   */
  handoffFrom?: { specialistId: SpecialistId; priorTitle: string };
}

// ─────────────────────────────────────────────────────────────────────────
// Specialist personality map.
// ─────────────────────────────────────────────────────────────────────────

const SPECIALIST_PERSONA_KEY: Record<SpecialistId, keyof typeof personas | null> = {
  marketa: 'aigent-marketa',
  quill: 'aigent-q', // Phase 5.b — Quill persona now registered as 'aigent-q'.
  kn0w1: 'aigent-kn0w1',
  'aigent-z': 'aigent-z',
  'aigent-c': 'aigent-c',
  'aigent-nakamoto': 'aigent-nakamoto',
  moneypenny: 'aigent-moneypenny',
  metaye: 'aigent-metaye',
  researcher: 'aigent-researcher',
};

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

// Map specialist + cartridge → default request type so the prompt knows
// what the user expects shape-wise.
function inferRequestType(specialistId: SpecialistId, cartridge: string): SpecialistRequestType {
  if (specialistId === 'marketa') return 'proposal';
  if (specialistId === 'quill') return 'editorial_angle';
  if (specialistId === 'kn0w1') return 'mission_recommendation';
  if (specialistId === 'aigent-z') return 'system_guidance';
  if (specialistId === 'aigent-c') return 'customer_journey';
  if (specialistId === 'aigent-nakamoto') return 'decentralisation_brief';
  if (specialistId === 'moneypenny') return 'micro_economics_brief';
  if (specialistId === 'metaye') return 'sovereignty_brief';
  if (specialistId === 'researcher') return 'research_brief';
  // Cartridge hint:
  if (cartridge === 'qriptopian') return 'editorial_angle';
  if (cartridge === 'knyt') return 'mission_recommendation';
  if (cartridge === 'marketa') return 'proposal';
  return 'system_guidance';
}

// ─────────────────────────────────────────────────────────────────────────
// T0 redaction pass — defends against accidental leakage.
// ─────────────────────────────────────────────────────────────────────────

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const FIO_RE = /\b[a-z0-9_-]+@[a-z0-9_-]+\b/gi; // catches handle@domain

function redact(text: string): string {
  return text.replace(UUID_RE, '[redacted]').replace(FIO_RE, (m) =>
    m.includes('.') ? m : '[redacted-handle]',
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt assembly.
// ─────────────────────────────────────────────────────────────────────────

function systemPromptFor(specialistId: SpecialistId, hasInvariantSlice = false): string {
  const key = SPECIALIST_PERSONA_KEY[specialistId];
  const base =
    key && personas[key]?.systemPrompt
      ? personas[key].systemPrompt
      : specialistId === 'quill'
        ? [
            'You are Quill, editor of The Qriptopian, powered by Aigent Q.',
            'You frame the metaMe ecosystem\'s active work as editorial moments — angles,',
            'article briefs, issue placements. You speak with editorial clarity and never',
            'overpromise. You return structured recommendations only.',
          ].join(' ')
        : 'You are an Aigent Me specialist.';
  // Every specialist is bound by the no-hallucination mandate: recommendations
  // must be grounded in the supplied context, never in invented metrics or
  // fabricated names/incidents. When the packet carries a validated invariant
  // slice (CFS-006 §2), the specialist is additionally bound to ground on and
  // cite those invariants as canonical memory.
  const clause = hasInvariantSlice ? `\n\n${INVARIANT_GROUNDING_CLAUSE}` : '';
  return `${base}\n\n${GROUNDING_MANDATE}${clause}`;
}

function userPromptFor(ctx: SpecialistContext, requestType: SpecialistRequestType): string {
  const lines = [
    `Aigent Me is coordinating with you on behalf of the user.`,
    `Active cartridge: ${ctx.activeCartridge}`,
    `Experience: ${ctx.experienceName ?? 'unnamed'} (type: ${ctx.experienceType}, stage: ${ctx.currentStage})`,
    `Primary goal: ${ctx.primaryGoal ?? '(not set)'}`,
    `Active cartridges: ${ctx.activeCartridges.join(', ')}`,
    `Intent: ${ctx.intentName}`,
  ];
  if (ctx.intentRationale) lines.push(`Rationale: ${ctx.intentRationale}`);
  if (ctx.userPrompt) lines.push(`User asked: ${ctx.userPrompt}`);
  if (ctx.invariantSlice && ctx.invariantSlice.length > 0) {
    lines.push('');
    lines.push('Validated invariants applicable to this intent (canonical memory — reason from these, cite the markers you use):');
    for (const inv of ctx.invariantSlice) {
      // Cite by seedId (e.g. inv.constitutional.001) — a stable, human-legible
      // marker that survives the UUID-stripping redaction pass below, unlike
      // the raw invariant UUID.
      const marker = inv.seedId ? `[${inv.seedId}] ` : '';
      lines.push(`- ${marker}(${inv.namespace}) ${inv.statement}`);
    }
  }
  lines.push('');
  lines.push(
    `Return a JSON object matching this exact shape (no prose outside the JSON):`,
  );
  lines.push(
    JSON.stringify(
      {
        title: 'string — 6-12 word headline',
        summary: 'string — 1-3 sentence framing',
        recommendations: ['string — 3-6 actionable bullets'],
        suggestedArtifacts: [
          'string — 0-4 artifact types from this set: article, brief, google-doc, gmail-draft, calendar-block, post-set, image-prompt, video-script, slide-outline, venture-report, partner-brief, marketa-campaign, mycanvas-remix, myworkbench-draft. Pick artifacts the persona can immediately progress on the aigentMe welcome surface. Routing: gmail-draft / partner-brief / brief / article / google-doc / slide-outline / venture-report -> composer modal; image-prompt / video-script / post-set -> metaMe Studio; mycanvas-remix -> myCanvas remix dialog; myworkbench-draft -> myWorkbench (private internal artifacts); marketa-campaign -> Marketa composer.',
        ],
        requiresApproval: 'boolean — true if implementing this requires send/share/publish',
        confidence: '"low" | "medium" | "high"',
      },
      null,
      2,
    ),
  );
  lines.push('');
  lines.push(`Request type: ${requestType}.`);
  lines.push(
    `Do not include any persona identifiers, raw user ids, or tokens in your response.`,
  );
  return redact(lines.join('\n'));
}

// ─────────────────────────────────────────────────────────────────────────
// LLM call — OpenAI only in Phase 5. Anthropic + Venice fallback in 5.b.
// ─────────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.SPECIALIST_LLM_MODEL || 'gpt-4o-mini';

async function callOpenAi(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[specialistRouter] OpenAI returned ${res.status}; falling back to template`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[specialistRouter] OpenAI call failed: ${msg}; falling back to template`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Phase 5.b — Anthropic + Venice fallbacks. Each fires only if its key is
// set. Both prepend a "Return JSON only" reminder to the system prompt
// since neither exposes OpenAI's response_format=json_object guarantee;
// we then strip ```json fences before handing back to the parser.
// ─────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.SPECIALIST_LLM_MODEL_ANTHROPIC || 'claude-3-5-haiku-latest';

const VENICE_API_KEY = process.env.VENICE_API_KEY;
const VENICE_MODEL = process.env.SPECIALIST_LLM_MODEL_VENICE || 'llama-3.3-70b';
const VENICE_BASE_URL = process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1';

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

async function callAnthropic(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        temperature: 0.5,
        system: `${systemPrompt}\nReturn a single valid JSON object only. No prose, no Markdown fences.`,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[specialistRouter] Anthropic returned ${res.status}; falling through`);
      return null;
    }
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const block = data?.content?.find((b) => b?.type === 'text');
    return block?.text ? stripJsonFences(block.text) : null;
  } catch (err) {
    console.warn(`[specialistRouter] Anthropic call failed: ${err instanceof Error ? err.message : err}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callVenice(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!VENICE_API_KEY) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);
  try {
    // Venice exposes an OpenAI-compatible /chat/completions endpoint.
    const res = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VENICE_MODEL,
        messages: [
          { role: 'system', content: `${systemPrompt}\nReturn a single valid JSON object only.` },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[specialistRouter] Venice returned ${res.status}; falling through`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text ? stripJsonFences(text) : null;
  } catch (err) {
    console.warn(`[specialistRouter] Venice call failed: ${err instanceof Error ? err.message : err}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Try LLMs in order — OpenAI → Anthropic → Venice — returning the first
 * non-null JSON-shaped response. Callers parse + validate the JSON
 * themselves and fall back to the template if every provider fails.
 */
async function callLlmChain(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const openai = await callOpenAi(systemPrompt, userPrompt);
  if (openai) return openai;
  const anthropic = await callAnthropic(systemPrompt, userPrompt);
  if (anthropic) return anthropic;
  const venice = await callVenice(systemPrompt, userPrompt);
  return venice;
}

// ─────────────────────────────────────────────────────────────────────────
// Template fallback — deterministic responses keyed on specialist + cartridge.
// Keeps the demo flow alive when no LLM key is present.
// ─────────────────────────────────────────────────────────────────────────

function templateResponse(
  specialistId: SpecialistId,
  ctx: SpecialistContext,
  requestType: SpecialistRequestType,
): Omit<SpecialistResponse, 'specialistId' | 'specialistLabel' | 'generatedAt' | 'source'> {
  const intent = ctx.intentName || 'this opportunity';
  const goal = ctx.primaryGoal ?? 'your primary goal';

  if (specialistId === 'marketa') {
    return {
      requestType,
      title: `Partner activation around "${intent}"`,
      summary:
        `Marketa recommends framing ${intent} as a partner-led activation aligned with ${goal}. Lead with a clear value statement and a single first action.`,
      recommendations: [
        `Open with the value statement: "what does this unlock for the partner?"`,
        `Identify one priority partner (Metayé Media is a strong default) and tailor the pitch to their cohort.`,
        `Stage the offer in three tiers (light / standard / deep) to give the partner a clear lane.`,
        `Close with an activation action — "claim your slot" or "book a 15-minute alignment."`,
      ],
      // Marketa's natural progressions: partner pitch (private brief), the
      // outbound email itself, a campaign in Marketa proper, and a deck
      // for the pitch meeting. All four are "act on the recommendation".
      suggestedArtifacts: ['partner-brief', 'gmail-draft', 'marketa-campaign', 'slide-outline'],
      requiresApproval: true,
      confidence: 'medium',
    };
  }
  if (specialistId === 'quill') {
    return {
      requestType,
      title: `The Qriptopian angle for "${intent}"`,
      summary:
        `Quill frames ${intent} as an editorial moment that bridges the active cartridge to the broader Qriptopian narrative.`,
      recommendations: [
        `Lead headline: "${intent}: the bridge moment".`,
        `Open with the user-side significance, not the system-side mechanics.`,
        `Anchor the piece with a single quote or scene; avoid feature-list narration.`,
        `Close with the next reader move — a deeper article, a participation moment, or a collector path.`,
      ],
      // Quill's editorial responses default to surfaceable artifacts the
      // user can immediately progress to. 'article' opens the doc
      // composer pre-seeded with Quill's framing; 'mycanvas-remix'
      // routes into the RemixDialog so the angle can be staged onto
      // the persona's myCanvas. Both are picked up by the welcome
      // surface's artifact-router (composeKindForSuggestedArtifact).
      suggestedArtifacts: ['article', 'mycanvas-remix', 'brief'],
      requiresApproval: false,
      confidence: 'medium',
    };
  }
  if (specialistId === 'kn0w1') {
    return {
      requestType,
      title: `KNYT-side path for "${intent}"`,
      summary:
        `Kn0w1 reads ${intent} as a participation opportunity in the KNYT world. The first move should be small, signal-generating, and PCS-relevant.`,
      recommendations: [
        `Frame the participation in lore-appropriate language; explanation-first.`,
        `Surface a single concrete KNYT-side action (vote / like / spark / remix) tied to the intent.`,
        `Acknowledge what's provisional vs finalised in the reward layer.`,
        `Offer one deeper path (correspondent contribution) only if the user is already participant-stage.`,
      ],
      // Kn0w1's natural progressions: a social post-set for the KNYT
      // community, hero art for the moment, a remix onto myCanvas
      // (publishable to KNYT Pulse), and the article itself.
      suggestedArtifacts: ['post-set', 'image-prompt', 'mycanvas-remix', 'article'],
      requiresApproval: false,
      confidence: 'medium',
    };
  }
  if (specialistId === 'aigent-z') {
    return {
      requestType,
      title: `Platform guidance for "${intent}"`,
      summary:
        `Aigent Z surfaces the platform-side primitives relevant to ${intent} so Aigent Me can route the user to the right canonical surface.`,
      recommendations: [
        `Confirm the canonical service or route for the intent.`,
        `Cite the file path or PR brief the user can read for grounding.`,
        `Flag any spine constraints (T0/T1 boundaries) that apply.`,
        `Hand back to Aigent Me with a precise next step.`,
      ],
      // Aigent Z's progressions are internal: spec/plan doc, brief, and a
      // workbench draft (private) so the user can iterate before sharing.
      suggestedArtifacts: ['google-doc', 'brief', 'myworkbench-draft'],
      requiresApproval: false,
      confidence: 'high',
    };
  }
  if (specialistId === 'aigent-c') {
    return {
      requestType,
      title: `Customer-journey framing for "${intent}"`,
      summary:
        `Aigent C frames ${intent} from the user's current journey stage. The next step should fit their depth band and surface a single forward motion.`,
      recommendations: [
        `Confirm the user's current depth (pill / capsule / mini-runtime / codex).`,
        `Offer one next-depth experience tied to the intent.`,
        `Translate platform vocabulary into ordinary language.`,
        `Route to the specialist whose territory the next step lands in.`,
      ],
      // Aigent C is the customer-journey lens: a brief, a journey-stage
      // post-set, an outreach email, and a slide if it's a partner pitch.
      suggestedArtifacts: ['brief', 'post-set', 'gmail-draft', 'slide-outline'],
      requiresApproval: false,
      confidence: 'medium',
    };
  }
  if (specialistId === 'aigent-nakamoto') {
    return {
      requestType,
      title: `Decentralisation & policy framing for "${intent}"`,
      summary:
        `Nakamoto frames ${intent} through the lens of self-custody, censorship-resistance, and Qripto-protocol policy. Surface the protocol primitives at stake and any policy trade-offs before acting.`,
      recommendations: [
        `Name the Qripto primitives this action touches (DiD/DiDQube, blakQube, metaQube, tokenQube, cohort attestation).`,
        `Identify which policy tier owns enforcement: platform (Aigent Z) / customer (Aigent C) / ecosystem (Qripto Protocol).`,
        `If the action settles on-chain, name the settlement assurance you want (provenance, finality, censorship-resistance).`,
        `Spell out the key-management implication for the persona — what they hold, what they delegate, what they should never expose.`,
      ],
      // Nakamoto-side artifacts are policy memos, articles framing the
      // sovereignty implications, and private working drafts.
      suggestedArtifacts: ['brief', 'article', 'myworkbench-draft'],
      requiresApproval: false,
      confidence: 'high',
    };
  }
  if (specialistId === 'moneypenny') {
    return {
      requestType,
      title: `Q¢ economics framing for "${intent}"`,
      summary:
        `MoneyPenny frames ${intent} around Q¢ pricing, micro-transaction flows, and payment-ops integrity. The recommendation focuses on how value moves, where it settles, and how the user retains custody.`,
      recommendations: [
        `Spell out the Q¢ price (and USD parity) for any unit the user is metering.`,
        `Identify the settlement rail — Q¢, KNYT, USDC, PayPal — and the receipt that will be emitted.`,
        `Surface any approval thresholds and the second-tier approval flow that applies.`,
        `Suggest one micro-billing improvement (batch, prepay, streaming) if traffic is high enough to warrant it.`,
      ],
      // MoneyPenny artifacts are pricing memos (doc), a spreadsheet with
      // the unit-economics math, and an outreach email if pricing needs
      // counterparty alignment.
      suggestedArtifacts: ['google-doc', 'sheet', 'gmail-draft', 'myworkbench-draft'],
      requiresApproval: true,
      confidence: 'medium',
    };
  }
  if (specialistId === 'researcher') {
    return {
      requestType,
      title: `Research framing for "${intent}"`,
      summary:
        `The Research Copilot frames ${intent} as a question in structured discovery: what does the invariant substrate already say, what hypothesis would test the open part, and what would falsify it. Design before data; ratification is a human step.`,
      recommendations: [
        `Surface the validated invariants applicable to ${intent}, ranked by standing; mark validated vs experimental vs canonical.`,
        `Sharpen the open question into a pre-registered, falsifiable hypothesis with agreed thresholds.`,
        `Separate the structural question (does invariant organization beat raw experience at matched tokens?) from the execution question (does the runtime add within-call value?).`,
        `Name the next research move — reproduce, run a held-out task, or contribute evidence — and what result would change the corpus.`,
      ],
      // Research artifacts are protocol/design docs, the brief that frames
      // the experiment, and a private working draft to iterate before
      // proposing (authoring is a proposal — a human ratifies).
      suggestedArtifacts: ['google-doc', 'brief', 'myworkbench-draft'],
      requiresApproval: false,
      confidence: 'high',
    };
  }
  // metaye — Sovereign Cybernetic Polity / governance steward.
  return {
    requestType,
    title: `Sovereignty framing for "${intent}"`,
    summary:
      `Metayé frames ${intent} through the Sovereign Cybernetic Polity lens: governance primitives, civic surfaces, and what it means for the user's sovereignty over identity, data, and value.`,
    recommendations: [
      `Name the civic primitive at stake (cohort, council, registry, attestation, mandate).`,
      `Identify the governance event this generates (proposal, vote, ratification, repair).`,
      `Surface the sovereignty implication — what the user retains, delegates, or risks exposing.`,
      `Recommend one civic next step that strengthens the polity rather than narrows it.`,
    ],
    // Metayé's natural artifacts are governance proposals (doc), public
    // sovereignty articles, and the brief that triggers the civic event.
    suggestedArtifacts: ['google-doc', 'article', 'brief'],
    requiresApproval: false,
    confidence: 'medium',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Public API.
// ─────────────────────────────────────────────────────────────────────────

export interface AskSpecialistInput {
  specialistId: SpecialistId;
  context: SpecialistContext;
}

export async function askSpecialist(
  input: AskSpecialistInput,
): Promise<SpecialistResponse> {
  const { specialistId, context } = input;
  const requestType = inferRequestType(specialistId, context.activeCartridge);
  const specialistLabel = SPECIALIST_LABELS[specialistId];
  const generatedAt = new Date().toISOString();

  // Try live LLM first.
  const system = systemPromptFor(specialistId, (context.invariantSlice?.length ?? 0) > 0);
  const user = userPromptFor(context, requestType);
  const raw = await callLlmChain(system, user);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<SpecialistResponse>;
      // Basic validation; fall through to template on bad shape.
      if (
        typeof parsed.title === 'string' &&
        typeof parsed.summary === 'string' &&
        Array.isArray(parsed.recommendations) &&
        parsed.recommendations.every((r) => typeof r === 'string')
      ) {
        return {
          specialistId,
          specialistLabel,
          requestType,
          title: parsed.title,
          summary: parsed.summary,
          recommendations: parsed.recommendations,
          suggestedArtifacts: Array.isArray(parsed.suggestedArtifacts)
            ? (parsed.suggestedArtifacts.filter((a) => typeof a === 'string') as string[])
            : [],
          requiresApproval: typeof parsed.requiresApproval === 'boolean'
            ? parsed.requiresApproval
            : true,
          confidence:
            parsed.confidence === 'low' || parsed.confidence === 'high'
              ? parsed.confidence
              : 'medium',
          source: 'llm',
          generatedAt,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[specialistRouter] failed to parse LLM JSON: ${msg}; falling back to template`);
    }
  }

  const tpl = templateResponse(specialistId, context, requestType);
  return {
    specialistId,
    specialistLabel,
    ...tpl,
    source: 'template',
    generatedAt,
  };
}
