/**
 * Companion 1.1 C5 — where the avatar's knowledge comes from
 * (SCOPE-MMC-004 §4.5, §5.2, D-8).
 *
 * ── OPERATOR DIRECTION (2026-07-26) ────────────────────────────────────────
 *
 *   "Avatar service just deploy D-ID as is - no changes needed but stub the
 *    avatar to be serviced by the aigentMe KB."
 *
 * So: **D-ID ships unchanged.** `app/components/metaVatar/MetaAvatar.tsx` is
 * not modified by Companion 1.1 — same SDK, same client key, same mount. What
 * this module adds is the SEAM the knowledge source will move through, and an
 * honest record of which source is live today.
 *
 * ── WHY A SEAM AND NOT A REWIRING ──────────────────────────────────────────
 *
 * D-ID mounts with `data-agent-id`, and a D-ID agent carries its OWN uploaded
 * knowledge base on D-ID's side. That is precisely the "isolated uploaded
 * knowledge model" §5.2 names: today the avatar can answer from a corpus that
 * is not aigentMe's, which is how a second Agent Me comes into existence
 * without anyone deciding to create one.
 *
 * Moving it is not a front-end change. It requires reconfiguring the D-ID
 * agent to call back into the platform for knowledge, which is provider-side
 * work outside a reorganisation release. So this pass makes the gap
 * **declared and legible** rather than pretending it is closed.
 *
 * ── WHAT IS TRUE TODAY, STATED PLAINLY ─────────────────────────────────────
 *
 * `AVATAR_KNOWLEDGE_SOURCE` is `'did-hosted'`. The aigentMe-KB path is a
 * **stub**: it is the declared target, and it is NOT something a citizen can
 * exercise today. Anything that reads this module must treat
 * `isServicedByAigentMeKb()` as the honest answer to "does the avatar speak
 * from aigentMe's knowledge?" — currently `false`.
 *
 * ── THE D-8 DISTINCTION THIS PRESERVES ─────────────────────────────────────
 *
 * D-8 (the avatar owns no session of its own) is ALREADY satisfied and is not
 * what this module is about. `CodexCopilotLayer` renders the avatar as one of
 * its own two modes over a single conversation, so session, memory and context
 * are shared by construction.
 *
 * KNOWLEDGE is the separate axis, and the one still open: the avatar shares
 * Agent Me's *session* while potentially answering from a *different corpus*.
 * Conflating the two would let someone read D-8's satisfaction as closing this
 * as well. It does not — hence this file, and hence the canary that pins
 * `AVATAR_KNOWLEDGE_SOURCE` to the truth rather than to the intention.
 */

/** The possible knowledge sources behind the avatar's answers. */
export const AVATAR_KNOWLEDGE_SOURCES = ['did-hosted', 'aigentme-kb'] as const;

export type AvatarKnowledgeSource = (typeof AVATAR_KNOWLEDGE_SOURCES)[number];

/**
 * What is LIVE. `did-hosted` — the D-ID agent answers from its own uploaded
 * corpus. Change this only when the provider-side reconfiguration has actually
 * shipped and been verified; changing it early would make every consumer
 * assert something false.
 */
export const AVATAR_KNOWLEDGE_SOURCE: AvatarKnowledgeSource = 'did-hosted';

/** The target state (§4.5): the avatar renders Agent Me, knowledge included. */
export const AVATAR_KNOWLEDGE_TARGET: AvatarKnowledgeSource = 'aigentme-kb';

/** True only when the avatar genuinely answers from aigentMe's KB. */
export function isServicedByAigentMeKb(): boolean {
  return AVATAR_KNOWLEDGE_SOURCE === 'aigentme-kb';
}

export interface AvatarKnowledgeStatus {
  readonly source: AvatarKnowledgeSource;
  readonly target: AvatarKnowledgeSource;
  /** True while the live source differs from the target. */
  readonly isStub: boolean;
  /** Operator-facing, and deliberately not reassuring while the gap is open. */
  readonly note: string;
}

/**
 * The avatar's knowledge posture, for any surface that reports it.
 *
 * The note is written to be read by a person deciding whether to trust the
 * avatar's answers, so while the gap is open it says so directly rather than
 * describing the target as though it were the state.
 */
export function avatarKnowledgeStatus(): AvatarKnowledgeStatus {
  const isStub = AVATAR_KNOWLEDGE_SOURCE !== AVATAR_KNOWLEDGE_TARGET;
  return {
    source: AVATAR_KNOWLEDGE_SOURCE,
    target: AVATAR_KNOWLEDGE_TARGET,
    isStub,
    note: isStub
      ? 'The avatar renders Agent Me and shares its session, but still answers from the ' +
        "D-ID agent's own uploaded knowledge base. Servicing it from the aigentMe KB is " +
        'declared and not yet wired — provider-side reconfiguration, outside Companion 1.1.'
      : 'The avatar answers from the aigentMe knowledge base.',
  };
}
