/**
 * Native delegate conversation — Harness Homecoming (CFS-023, Workstream 3).
 *
 * "Conversations occur inside AgentiQ, not in a vendor chat interface." This is
 * the primitive that makes the harness home: talk to a constitutional delegate
 * NATIVELY — grounded in its own constitutional identity + the sovereign
 * knowledge base, routed through the invariant-aware Model Router (callSovereign).
 * The frontier model (Claude / GPT / open weights) is an INTERCHANGEABLE
 * inference provider behind the sovereign fallback ladder — invisible, not home.
 *
 * The reply carries a SOVEREIGNTY RECEIPT (which provider actually served it,
 * whether it degraded to the open-weight floor, the governing invariants) — the
 * proof that the conversation ran through the platform's own stack, and that the
 * model underneath is swappable without changing who the delegate is.
 *
 * Division of concern: identity resolution + system-prompt assembly are PURE and
 * canary-tested; only the inference call is impure.
 */

import { callSovereign } from '@/services/constitutional/modelRouter';
import { getDelegateSpec } from '@/services/homecoming/agentHomecoming';
import { DELEGATE_CHARTER_STATUS, type HomecomingDelegateId } from '@/types/homecoming';

export interface DelegateIdentity {
  label: string;
  description: string;
  agentClass: string;
}

/** The generic identity. TRUE of every Homecoming delegate by charter, and
 *  free of invented specifics — it states only bounded delegation. */
export const GENERIC_DELEGATE_DESCRIPTION =
  'A constitutional delegate of the Human Agency System, operating under bounded delegation.';

/**
 * The selection RULE, as a pure function of its inputs (operator refinement,
 * 2026-07-25).
 *
 * **Forward-compatibility rule, stated conditionally — this is not a fallback
 * a citizen can exercise today:** *if a future roster-valid delegate exists
 * without an authored identity specification, Homecoming returns the generic
 * identity rather than inventing authored characteristics.*
 *
 * Every delegate on the current roster (aletheon, moneypenny, nakamoto) IS
 * authored, so the generic branch has no reachable subject. Extracting the rule
 * here keeps it directly testable without fabricating an invalid delegate id —
 * which would assert behaviour the type boundary already forbids.
 */
export function resolveAuthoredOrGenericIdentity(input: {
  delegateId: string;
  authoredIdentity: { displayName: string; description: string } | null;
  agentClass: string;
}): DelegateIdentity {
  return {
    label: input.authoredIdentity?.displayName ?? input.delegateId,
    description: input.authoredIdentity?.description ?? GENERIC_DELEGATE_DESCRIPTION,
    agentClass: input.agentClass,
  };
}

/**
 * Resolve a delegate's conversational identity.
 *
 * **Defined ONLY for roster-valid delegate ids.** An off-roster id throws on
 * the charter-status lookup, and that is deliberate: a defensive guard here
 * would weaken the type boundary and imply arbitrary ids are supported. The
 * invariant is enforced by type and at call sites, never by a silent fallback
 * inside the resolver.
 *
 * Composes `resolveAuthoredOrGenericIdentity` rather than repeating the rule.
 */
export function resolveDelegateIdentity(delegate: HomecomingDelegateId): DelegateIdentity {
  const spec = getDelegateSpec(delegate);
  const meta = DELEGATE_CHARTER_STATUS[delegate];
  return resolveAuthoredOrGenericIdentity({
    delegateId: delegate,
    authoredIdentity: spec ? { displayName: spec.displayName, description: spec.description } : null,
    agentClass: meta.agentClass,
  });
}

export interface DelegateGrounding {
  /** Canonical invariant statements the delegate must honour. */
  invariants?: string[];
  /** Relevant snippets from the sovereign Constitutional Knowledge Repository. */
  knowledge?: string[];
}

/**
 * Assemble a delegate's constitutional system prompt: native-operation framing +
 * its identity + the bounded-delegation constraints + any grounding. Pure and
 * deterministic — the canary pins its structure, not model output.
 */
export function buildDelegateSystemPrompt(identity: DelegateIdentity, grounding: DelegateGrounding = {}): string {
  const parts: string[] = [
    `You are ${identity.label}, a constitutional delegate of the Human Agency System (agent class: ${identity.agentClass}). ` +
      'You operate NATIVELY within the platform: the AI model producing your words is an interchangeable inference ' +
      'provider, not your home. Your identity, memory, authority, and constitution live in the Human Agency System — ' +
      'they do not change when the provider underneath does.',
    identity.description,
    'Constitutional constraints — bounded delegation (delegation-framework v1):\n' +
      '- Authority may be delegated; sovereignty may not. Act only within your bounded scope.\n' +
      '- You do not command; you illuminate. Reveal context, surface consequences, preserve memory.\n' +
      '- Human sovereignty is paramount — defer to the First Citizen’s will.\n' +
      '- Minimum disclosure: reveal only what the moment requires.',
  ];

  const invariants = (grounding.invariants ?? []).filter((s) => typeof s === 'string' && s.trim());
  if (invariants.length) {
    parts.push(`Governing invariants you must honour:\n${invariants.map((i) => `- ${i}`).join('\n')}`);
  }
  const knowledge = (grounding.knowledge ?? []).filter((s) => typeof s === 'string' && s.trim());
  if (knowledge.length) {
    parts.push(
      'Relevant sovereign knowledge (from the Constitutional Knowledge Repository — reason from this and draw on it ' +
        `when it bears on the question):\n${knowledge.map((k) => `- ${k}`).join('\n')}`,
    );
  }
  return parts.join('\n\n');
}

/** One prior exchange turn (client-held transcript — no server session state). */
export interface DelegateTurn {
  role: 'operator' | 'delegate';
  text: string;
}

export interface DelegateConverseInput {
  delegate: HomecomingDelegateId;
  message: string;
  /** Prior turns, oldest first — multi-turn continuity (capped by the route). */
  history?: DelegateTurn[];
  grounding?: DelegateGrounding;
  maxTokens?: number;
}

export interface SovereigntyReceipt {
  provider: string;
  model: string;
  /** True when the routed target failed and a fallback served it. */
  degraded: boolean;
  /** True when it ran on the open-weight sovereign floor. */
  sovereignFloor: boolean;
  stage: string;
  governingInvariants: string[];
  note: string;
}

export interface DelegateConverseResult {
  delegate: HomecomingDelegateId;
  reply: string;
  sovereignty: SovereigntyReceipt;
}

/**
 * Converse with a delegate natively. Grounds the reply in the delegate's
 * constitutional identity (+ optional invariants/knowledge) and routes through
 * callSovereign — so the frontier model is a swappable provider, and the reply
 * carries the sovereignty receipt proving it. Impure (calls a provider).
 */
export async function converseWithDelegate(input: DelegateConverseInput): Promise<DelegateConverseResult> {
  const identity = resolveDelegateIdentity(input.delegate);
  const system = buildDelegateSystemPrompt(identity, input.grounding);
  // Multi-turn continuity: fold the client-held transcript into the prompt so
  // the delegate remembers the conversation. Provider-agnostic (one user string
  // through callSovereign, no provider-specific message arrays).
  const history = (input.history ?? []).filter((t) => t && typeof t.text === 'string' && t.text.trim());
  const prompt = history.length
    ? `Conversation so far:\n${history
        .map((t) => `${t.role === 'delegate' ? identity.label : 'Operator'}: ${t.text.trim()}`)
        .join('\n')}\n\nOperator: ${input.message}\n\nReply as ${identity.label}, continuing the conversation.`
    : input.message;
  const result = await callSovereign('reasoning', system, prompt, input.maxTokens ?? 1200);
  return {
    delegate: input.delegate,
    reply: result.text,
    sovereignty: {
      provider: result.provider,
      model: result.model,
      degraded: result.degraded,
      sovereignFloor: result.sovereignFloor,
      stage: result.stage,
      governingInvariants: result.governingInvariants,
      note: 'The provider is an interchangeable inference layer — this conversation ran natively inside AgentiQ, not in a vendor chat interface.',
    },
  };
}
