/**
 * moneyPennyArchitect — PRD-MPY-001 Phase 3, Architect mode.
 *
 * "Designs constitutional financial structures/products — pricing models,
 * fee-split ('constitutional service fee'), settlement-terms design,
 * delegation envelopes, agreement templates. Produces artifacts, not
 * transactions." (PRD-MPY-001 §2)
 *
 * This is a PROPOSAL producer only. It never forms, accepts, or authorizes a
 * Constitutional Agreement, and never touches settlementExecutor.ts — those
 * belong to Runtime mode (Phase 4). Composes three already-built seams, adds
 * no new mechanism:
 *   - buildInvariantSlice/citeInvariants (services/invariants/grounding.ts) —
 *     the same grounding + Reach-accrual pair CVR-003's other producers use.
 *   - callSovereign('reasoning', ...) (services/constitutional/modelRouter.ts)
 *     — the same sovereign, invariant-aware inference entry point
 *     MoneyPenny's chat route already uses.
 *   - saveArtifactRecord (services/artifact/artifactRecordStore.ts) — the
 *     durable artifact-record store CVR-003's other pilots already use,
 *     which already accepts `citedInvariantIds` verbatim.
 */

import { randomUUID } from 'crypto';
import { buildInvariantSlice, citeInvariants } from '@/services/invariants/grounding';
import { callSovereign } from '@/services/constitutional/modelRouter';
import { saveArtifactRecord } from '@/services/artifact/artifactRecordStore';

const ARCHITECT_SYSTEM_PROMPT = `You are MoneyPenny, in Architect mode — the Constitutional Financial Services Agent designing a financial structure or product (pricing model, fee split, settlement-terms design, delegation envelope, agreement template).

Ground rules:
- Reason ONLY from the invariant evidence supplied below. Do not invent facts, regulations, or figures not given to you.
- If no governing invariants were supplied, say so plainly and design from first principles of the domain framing only — never fabricate a citation.
- Cite any invariant you rely on by its bracketed seed id, e.g. [inv.finance.001].
- You are producing a PROPOSAL for a human to review and, if they choose, carry into a formal Constitutional Agreement. You are NOT forming, accepting, or authorizing any agreement, and you are NOT moving funds — say so explicitly if the intent implies otherwise.
- Structure the output as: a short title, a one-paragraph brief, then the design itself (headings/bullets as appropriate).`;

export interface DraftFinancialStructureInput {
  intent: string;
}

export interface DraftFinancialStructureResult {
  ok: boolean;
  error?: string;
  artifactId?: string;
  recordId?: string | null;
  title?: string;
  body?: string;
  citedInvariantIds?: string[];
}

function deriveTitle(intent: string): string {
  const trimmed = intent.trim().replace(/\s+/g, ' ');
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed || 'Untitled financial structure';
}

/**
 * Ground the intent in the `finance` invariant library, draft the structure
 * via sovereign inference, cite what was used (Reach accrual, best-effort),
 * and persist the result as an operational artifact record. Never throws —
 * every failure path returns `{ ok: false, error }`.
 */
export async function draftFinancialStructure(
  input: DraftFinancialStructureInput,
): Promise<DraftFinancialStructureResult> {
  const intent = input.intent?.trim();
  if (!intent) return { ok: false, error: 'intent is required' };

  let slice;
  try {
    slice = await buildInvariantSlice({ namespaces: ['finance'], limit: 8 });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'grounding failed' };
  }

  const invariantBlock = slice.items.length > 0
    ? `### Governing financial-services invariants (cite by seed id when they ground the design)\n${slice.items
        .map((i) => `- [${i.seedId ?? i.id}] ${i.statement}`)
        .join('\n')}`
    : '### No governing financial-services invariants were resolved for this intent — design from domain framing only, and say so.';

  const userPrompt = `Design intent: ${intent}\n\n${invariantBlock}`;

  let sovereign;
  try {
    sovereign = await callSovereign('reasoning', ARCHITECT_SYSTEM_PROMPT, userPrompt, 900, 0.5);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'inference failed' };
  }
  const body = sovereign.text?.trim();
  if (!body) return { ok: false, error: 'inference returned no content' };

  const title = deriveTitle(intent);
  const artifactId = `moneypenny-architect-${randomUUID()}`;

  const recordId = await saveArtifactRecord({
    artifactId,
    profile: 'moneypenny',
    consequenceClass: 'operational',
    delegate: 'aigent-moneypenny',
    title,
    brief: intent.slice(0, 300),
    body,
    receiptId: null,
    citedInvariantIds: slice.citedIds,
    sovereignty: {
      source: 'moneypenny-architect',
      mode: 'architect',
      groundedNamespaces: ['finance'],
      provider: sovereign.provider,
      model: sovereign.model,
      degraded: sovereign.degraded,
    },
  });

  // Best-effort Reach accrual — never blocks the response (grounding.ts's
  // own contract: a citation failure must never break the act it describes).
  if (slice.citedIds.length > 0) {
    void citeInvariants(slice.citedIds);
  }

  return {
    ok: true,
    artifactId,
    recordId,
    title,
    body,
    citedInvariantIds: slice.citedIds,
  };
}
