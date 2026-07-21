/**
 * articleDraftService — the ONE home for article drafting (dogfood run of the
 * Constitutional Capability Pipeline, 2026-07-13; CS-001 remediation).
 *
 * Constitutional Decision for this capability: mechanism `code` — EXTRACT the
 * route-inlined generator (`/api/composer/article-draft`, previously
 * OpenAI-direct) into this composable service and CONVERGE the video-article
 * skill's drafter onto it. One drafting seam, two artifact presentations:
 *
 *   • `draftArticleArtifact` — the structured editorial artifact (title, deck,
 *     opening, sections, takeaways, glossary, nextAction) rendered as
 *     `article_draft` blocks in experience bundles. The route becomes a thin
 *     wrapper; its response shape is UNCHANGED (`{ ok, articleDraft, provider }`).
 *   • `draftCompanionMarkdown` — the brief-grounded markdown companion the
 *     video-article skill uses. The CALLER supplies the system mandate + user
 *     prompt verbatim, so the skill's correspondence contract (article drafted
 *     ONLY from the shared brief) is preserved untouched.
 *
 * Sovereignty: both presentations route through `callSovereign('draft', …)` —
 * this migrates the article call site off the OpenAI-direct client (the
 * callSovereign migration backlog, one site at a time). Degradation is honest:
 * LLM failure → the deterministic fallback artifact (structured mode) or null
 * (companion mode; the skill applies its own template fallback).
 *
 * The pure builders (`buildFallbackArticleDraftArtifact`, artifact validation)
 * moved here VERBATIM from the route — extraction, not rewrite.
 */

import { callSovereign } from '@/services/constitutional/modelRouter';

export type ArticleDraftArtifact = {
  title: string;
  deck: string;
  opening: string;
  sections: Array<{ heading: string; body: string }>;
  takeaways: string[];
  glossary: Array<{ term: string; definition: string }>;
  nextAction: string | null;
};

export interface ArticleDraftInput {
  experienceName?: string;
  title?: string;
  prompt?: string;
  outputs?: string[];
  takeawaysCount?: number;
  mediaMode?: 'image' | 'video';
  contextHints?: string[];
}

// ---------------------------------------------------------------------------
// Pure helpers — moved verbatim from the route (extraction, not rewrite)
// ---------------------------------------------------------------------------

function firstNonEmptyString(values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function trimTrailingPunctuation(value: string) {
  return value.trim().replace(/[.?!]+$/g, '');
}

function sentence(value: string, fallback: string) {
  const normalized = trimTrailingPunctuation(value || '');
  if (!normalized) return fallback;
  return `${normalized}.`;
}

/** Deterministic fallback artifact — the honest no-LLM path. Pure. */
export function buildFallbackArticleDraftArtifact(params: {
  experienceName?: string | null;
  title?: string | null;
  prompt?: string | null;
  outputs?: string[];
  takeawaysCount?: number;
  mediaMode?: 'image' | 'video';
}): ArticleDraftArtifact | null {
  const title = firstNonEmptyString([params.title, params.experienceName, 'Editorial draft']);
  const prompt = firstNonEmptyString([params.prompt]);
  if (!title && !prompt) return null;

  const outputs = normalizeStringArray(params.outputs);
  const takeawaysCount = Math.min(Math.max(params.takeawaysCount || 3, 1), 5);
  const mediaNoun = params.mediaMode === 'video' ? 'video experience' : 'visual experience';
  const promptSentence = sentence(
    prompt || '',
    `Frame the current ${mediaNoun} with a supporting editorial narrative`,
  );
  const deck = `${title || 'Editorial draft'} pairs the current ${mediaNoun} with copy that explains why it matters and what the audience should do next.`;
  const opening = `${promptSentence} This draft is structured to help the audience understand the core idea quickly, then move into the supporting details with confidence.`;
  const sections = [
    {
      heading: 'Why this matters',
      body: `Use this section to establish the editorial thesis behind ${title || 'the experience'} and explain why the audience should care right now.`,
    },
    {
      heading: params.mediaMode === 'video' ? 'How to watch this' : 'How to read the visual',
      body: `Anchor the audience in the primary ${mediaNoun}, call out the important cues to notice, and connect those cues back to the editorial prompt.`,
    },
    {
      heading: 'What to do next',
      body: 'Close with the strongest practical takeaway, the intended action, and any reward, quest, or follow-on experience the audience should open next.',
    },
  ];

  const takeaways = Array.from({ length: takeawaysCount }, (_, index) => {
    if (index === 0) return `Lead with the core thesis behind ${title || 'this experience'}.`;
    if (index === 1) return `Tie the ${mediaNoun} directly to the supporting editorial explanation.`;
    if (index === 2) return "Make the audience's next action explicit and easy to follow.";
    if (index === 3) return 'Use the supporting copy to reinforce trust, provenance, and reward context.';
    return 'Keep the closing summary concise enough to work as a launch or share-ready capsule.';
  });

  return {
    title: title || 'Editorial draft',
    deck,
    opening,
    sections,
    takeaways: outputs.includes('takeaways') ? takeaways : [],
    glossary: outputs.includes('glossary')
      ? [
          {
            term: 'Editorial frame',
            definition: 'The short narrative layer that explains what the audience is seeing and why it matters.',
          },
          {
            term: 'Supporting context',
            definition: 'Companion copy that turns a media asset into a guided experience rather than a standalone artifact.',
          },
        ]
      : [],
    nextAction: outputs.includes('next_action')
      ? 'Prompt the user to continue into the linked experience, unlock the next capsule, or share the strongest takeaway.'
      : null,
  };
}

/** Lenient artifact validation — moved verbatim from the route. Pure. */
export function asArticleDraftArtifact(value: unknown): ArticleDraftArtifact | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const title = firstNonEmptyString([record.title]) || 'Editorial draft';
  const deck = firstNonEmptyString([record.deck]) || '';
  const opening = firstNonEmptyString([record.opening]) || '';
  const sections = Array.isArray(record.sections)
    ? record.sections
        .filter(
          (item): item is { heading: string; body: string } =>
            Boolean(
              item &&
                typeof item === 'object' &&
                !Array.isArray(item) &&
                typeof (item as { heading?: unknown }).heading === 'string' &&
                typeof (item as { body?: unknown }).body === 'string',
            ),
        )
        .map((item) => ({
          heading: item.heading.trim(),
          body: item.body.trim(),
        }))
        .filter((item) => item.heading && item.body)
    : [];
  const takeaways = normalizeStringArray(record.takeaways);
  const glossary = Array.isArray(record.glossary)
    ? record.glossary
        .filter(
          (item): item is { term: string; definition: string } =>
            Boolean(
              item &&
                typeof item === 'object' &&
                !Array.isArray(item) &&
                typeof (item as { term?: unknown }).term === 'string' &&
                typeof (item as { definition?: unknown }).definition === 'string',
            ),
        )
        .map((item) => ({
          term: item.term.trim(),
          definition: item.definition.trim(),
        }))
        .filter((item) => item.term && item.definition)
    : [];
  const nextAction =
    typeof record.nextAction === 'string' && record.nextAction.trim() ? record.nextAction.trim() : null;

  if (!deck && !opening && sections.length === 0) return null;

  return { title, deck, opening, sections, takeaways, glossary, nextAction };
}

// ---------------------------------------------------------------------------
// The drafting seam — ONE LLM path (callSovereign), two presentations
// ---------------------------------------------------------------------------

const STRUCTURED_SYSTEM =
  'You are an editorial experience writer. Return strict JSON only with keys: title, deck, opening, sections, takeaways, glossary, nextAction. ' +
  'Write concrete consumer-facing copy for a bundled media + article experience. Do not use placeholders or meta commentary. ' +
  'Each section body should be substantive, specific to the prompt and context, and read like part of one coherent article rather than isolated notes.';

/**
 * Structured editorial artifact — the route's presentation. Sovereign-routed;
 * degrades to the deterministic fallback (never throws).
 */
export async function draftArticleArtifact(
  input: ArticleDraftInput,
): Promise<{ articleDraft: ArticleDraftArtifact | null; provider: string }> {
  const experienceName = firstNonEmptyString([input.experienceName]) || '';
  const title = firstNonEmptyString([input.title, experienceName]) || 'Editorial draft';
  const prompt = firstNonEmptyString([input.prompt]) || '';
  const outputs = normalizeStringArray(input.outputs);
  const takeawaysCount =
    typeof input.takeawaysCount === 'number' && Number.isFinite(input.takeawaysCount)
      ? Math.min(Math.max(input.takeawaysCount, 1), 5)
      : 3;
  const mediaMode = input.mediaMode === 'video' ? 'video' : 'image';
  const contextHints = normalizeStringArray(input.contextHints);
  const fallback = buildFallbackArticleDraftArtifact({
    experienceName,
    title,
    prompt,
    outputs,
    takeawaysCount,
    mediaMode,
  });

  try {
    const user = JSON.stringify({
      task: 'Generate a polished supporting article draft for a media bundle.',
      experienceName,
      title,
      prompt,
      outputs,
      takeawaysCount,
      mediaMode,
      contextHints,
      requirements: {
        deck: '1-2 sentences',
        opening: '1 substantive opening paragraph',
        sections: '3 or 4 sections, each with a heading and 4-6 sentences',
        takeaways: outputs.includes('takeaways') ? `${takeawaysCount} concise takeaways` : 'omit if not requested',
        glossary: outputs.includes('glossary') ? '2-4 glossary terms' : 'omit if not requested',
        nextAction: outputs.includes('next_action') ? '1 concise CTA' : 'omit if not requested',
      },
    });
    const routed = await callSovereign('draft', STRUCTURED_SYSTEM, user, 1400, 0.7);
    const text = routed.text?.trim() ?? '';
    // Strip a markdown fence if a provider adds one (lenient, never assumed).
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = jsonText ? asArticleDraftArtifact(JSON.parse(jsonText)) : null;
    return { articleDraft: parsed || fallback, provider: parsed ? routed.provider : 'fallback' };
  } catch {
    return { articleDraft: fallback, provider: 'fallback' };
  }
}

/**
 * Brief-grounded markdown companion — the video-article skill's presentation.
 * The caller supplies its system mandate + user prompt VERBATIM (the skill's
 * correspondence contract stays untouched); this seam only owns the sovereign
 * routing. Returns null on failure — the caller applies its own fallback.
 */
export async function draftCompanionMarkdown(input: {
  systemMandate: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ body: string; provider?: string; model?: string; sovereignFloor?: boolean } | null> {
  try {
    const routed = await callSovereign(
      'draft',
      input.systemMandate,
      input.userPrompt,
      input.maxTokens ?? 1400,
      input.temperature ?? 0.4,
    );
    const body = routed.text?.trim();
    if (!body) return null;
    return { body, provider: routed.provider, model: routed.model, sovereignFloor: routed.sovereignFloor };
  } catch {
    return null;
  }
}
