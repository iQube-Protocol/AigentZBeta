/**
 * Unified Identity, Content & Access — canonical contract types.
 *
 * See `codexes/packs/agentiq/updates/2026-05-05_unified-identity-content-access-foundation-plan.md`
 * (and its registration in col_architecture) for the full specification.
 *
 * Identifier exposure tiers (privacy-first; rule: identifiers may move
 * down a tier T0 -> T1 -> T2 only via a deliberate transformation;
 * never up):
 *
 *   T0 server-internal     personaId, authProfileId, fioHandle, rootDid
 *                          Stored in DB / held in server memory during
 *                          a request. NEVER in client responses, URLs,
 *                          postMessage payloads, or browser storage.
 *
 *   T1 same-origin shell   personaSessionToken
 *                          HMAC-signed envelope, origin-bound, rotating,
 *                          short-lived. Resolves T1 -> T0 only on the
 *                          AigentZ server. Replaces today's raw
 *                          `currentPersonaId` localStorage and the
 *                          `?personaId=` URL param.
 *
 *   T2 public-network      aliasCommitment = hash(personaId+cohortId+salt)
 *                          Per-tx, escrow-window TTL. The only persona
 *                          handle that touches DVN receipts, on-chain
 *                          anchors, mailbox relays, and any URL/message
 *                          that traverses the open internet outside the
 *                          trusted shell. Purged by the Escrow canister
 *                          at the end of the escrow window.
 *
 * Phase 0: this file is types only. No runtime change. The implementations
 * land in Phase 1 (`services/identity/getActivePersona.ts`,
 * `services/identity/personaSessionToken.ts`,
 * `services/content/getContentDescriptor.ts`,
 * `services/access/evaluateAccess.ts`).
 */

// ─────────────────────────────────────────────────────────────────────────
// 1. Identity contracts (privacy-first, tiered)
// ─────────────────────────────────────────────────────────────────────────

/** Self-asserted disclosure floor for a persona; drives default UI affordances. */
export type Identifiability =
  | 'anonymous'
  | 'semi_anonymous'
  | 'semi_identifiable'
  | 'identifiable';

/**
 * T0 — server-internal active-persona context.
 *
 * Returned by `getActivePersona(req)` on the server. Used by API routes
 * and services to resolve entitlements, gate access, and write rows.
 * MUST NOT cross the wire to the browser. Routes that produce JSON
 * responses must strip this context and emit only ActivePersonaSurface.
 */
export interface ActivePersonaContext {
  /** Canonical persona UUID. T0 — server-internal only. */
  personaId: string;

  /** Multi-email-merged caller identity. T0 — server-internal only. */
  authProfileId: string;

  identifiability: Identifiability;

  /** Cartridge-role flags. Booleans only — no underlying handle exposed. */
  cartridgeFlags: {
    isAdmin: boolean;
    isPartner: boolean;
  };

  /** Cohort group ids the persona is a member of (no aliases at rest). */
  cohortMemberships: string[];

  /** Provenance trace for debugging — which input source produced this. */
  source:
    | 'session-cookie'
    | 'session-token'
    | 'api-key'
    | 'postmessage-token';
}

/**
 * T1 — public-safe surface state for the browser.
 *
 * What every surface (KnytTab, embed, runtime, viewer, drawer, remix
 * dialog) reads. Carries no correlatable handle. The personaSessionToken
 * is opaque, server-signed, origin-bound, rotating, and resolves to
 * ActivePersonaContext only on the AigentZ server.
 */
export interface ActivePersonaSurface {
  /**
   * Opaque, server-signed, short-lived. Resolves on the server back to
   * ActivePersonaContext. Rotates on persona switch, sign-out, or TTL.
   * The ONLY persona handle that touches client storage or URLs.
   */
  personaSessionToken: string;

  identifiability: Identifiability;

  cartridgeFlags: {
    isAdmin: boolean;
    isPartner: boolean;
  };

  /**
   * User-chosen pet name for the persona ("Work", "Anon", "Knight").
   * Stored in the persona row; not derived from personaId or fioHandle.
   * Optional; absent means anonymous presentation.
   */
  displayLabel?: string;

  /**
   * Cohort group ids ARE T1-safe — they identify the group, not the
   * member, and groups are public/semi-public by design.
   */
  cohortMemberships: string[];

  /** TTL hint for the session token; client refreshes proactively. */
  sessionExpiresAt: string;
}

/**
 * Consented-disclosure result.
 *
 * Only returned from `discloseCredential(context, requesterContext)`,
 * called by a small set of compliance-bearing routes (e.g. investor
 * verification, KYC, root-DiD reputation read, fioHandle reveal in an
 * identifiable interaction). Each call returns ONLY the field(s) the
 * scope requires. The caller uses the value to make a decision and
 * discards it before any response is built.
 */
export interface DisclosedPersonaCredential {
  /** T0 -> consented surface. Available only on identifiable scopes. */
  fioHandle?: string;

  /** did:fio:* or did:iq:* — only on root_did or compliance scopes. */
  rootDid?: string;

  /** 0..5 from RQH. Only on reputation scope. */
  rootReputationBucket?: number;

  /** CRM compliance flag. Only on investor scope. */
  isInvestor?: boolean;

  /** KYC record id, never the record itself. Only on kyc scope. */
  legalIdentityRef?: string;

  /** Proof-of-personhood, when World ID is wired (backlog). */
  kybeAttestation?: string;

  /** DVN receipt anchoring the disclosure event — alias-attributed. */
  consentReceiptId: string;
}

/** Scopes for `discloseCredential`. Each scope returns a minimum subset. */
export type DisclosureScope =
  | 'investor'
  | 'kyc'
  | 'reputation'
  | 'root_did'
  | 'fio_handle';

export interface DisclosureRequesterContext {
  /** Route or service path requesting the disclosure (audit trail). */
  route: string;
  /** Plain-language reason — appears in the disclosure receipt. */
  reason: string;
  /** Minimum-disclosure scope the requester needs. */
  scope: DisclosureScope;
}

/**
 * T2 — ephemeral cohort alias commitment.
 *
 * The ONLY persona-related identifier that ever reaches a public chain
 * or a public DVN receipt. One-way hash; the path from
 * `aliasCommitment` -> `personaId` is held server-side only and exists
 * only for the escrow window. The Escrow canister calls `purge_expired`
 * when the window closes and the mapping is destroyed.
 *
 * See `codexes/packs/agentiq/updates/2026-04-27_cohort-escrow-root-did-reputation-backlog.md`
 * for the canister-level design.
 */
export interface CohortAliasCommitment {
  /** hash(personaId + cohortId + salt) — un-correlatable post-purge. */
  aliasCommitment: string;
  /** Dynamic; tx- or group-scoped; never permanent. */
  cohortId: string;
  /** ISO timestamp; Escrow canister purges after this. */
  expiresAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Content contract
// ─────────────────────────────────────────────────────────────────────────

/**
 * Five exhaustive content states. State determines storage path,
 * encryption posture, gating evaluator, payload uniqueness, and whether
 * a TokenQube is required.
 *
 *   A — open, non-iQubed, Supabase plaintext
 *   B — open, iQubed (survivability), shared ciphertext, public access TokenQube
 *   C — gated, WIP, Supabase encrypted, shared ciphertext, TokenQube + entitlement
 *   D — gated, canonical pool/streaming, AutoDrive, shared asset-keyed ciphertext,
 *       N TokenQubes wrap the same content key (license/access semantics)
 *   E — gated, canonical sovereign, holder-custodied, UNIQUE ciphertext + UNIQUE
 *       key per holder, one NFT TokenQube per holder, off-platform decryption
 *       supported (custody/sovereignty semantics)
 */
export type ContentState =
  | 'A_open_unqubed'
  | 'B_open_iqubed'
  | 'C_gated_wip'
  | 'D_gated_canonical_pool'
  | 'E_gated_canonical_sovereign';

export type ContentClass =
  | 'episode_still'
  | 'episode_motion'
  | 'episode_print'
  | 'character_card'
  | 'gn'
  | 'lore'
  | 'agent'
  | 'tool'
  | 'model'
  | 'workflow'
  | 'dataset'
  | 'capsule'
  | 'other';

/** Gating kind classification — single source of truth in services/rewards/contentGating.ts */
export type GatingKind = 'free' | 'payment' | 'credential';

export interface ContentGatingDescriptor {
  kind: GatingKind;
  /**
   * Credential id when kind='credential'. Examples:
   *   'admin' | 'partner' | 'investor'
   *   'cohort:<cohort_id>'
   *   'token:<chain>:<contract>'    // ERC-721/1155 holder check
   */
  credential?: string;
  priceUsd?: number;
  reason?: string;
}

export type StorageBackend = 'supabase' | 'autodrive';

export interface ContentEncryptionEnvelope {
  alg: 'AES-256-GCM';
  iv: string;
  authTag: string;
}

export interface ContentStoragePointer {
  backend: StorageBackend;
  /**
   * For supabase: storage URL or signed-redirect handle.
   * For autodrive: CID.
   * Never named with raw URL semantics outside the descriptor.
   */
  pointer: string;
}

export interface ContentOnChainAnchor {
  /** Chain id where the TokenQube currently lives (may differ from mint chain after LZ bridge). */
  chain: string;
  contract: string;
  tokenId: string;
}

export interface ContentIQubeEnvelope {
  metaQubeId: string;
  blakQubeId: string;
  /** Present for B/C/D/E. Absent for A. */
  tokenQubeId?: string;
  /** Present for B/C/D/E. */
  encryption?: ContentEncryptionEnvelope;
  storage: ContentStoragePointer;
  /** Present for D/E only. */
  onChain?: ContentOnChainAnchor;
}

/**
 * Content-side intelligence. Built by `getContentDescriptor(assetId)`
 * server-side from `master_content_qubes` / `codex_media_assets` rows
 * plus the gating classifier. Surfaces consume; they never derive.
 */
export interface ContentAccessDescriptor {
  assetId: string;
  contentClass: ContentClass;
  state: ContentState;
  gating: ContentGatingDescriptor;
  /** Present for B/C/D/E. Absent for A. */
  iqube?: ContentIQubeEnvelope;
  /** Does access trigger a DVN receipt? */
  receiptEligible: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Access decision
// ─────────────────────────────────────────────────────────────────────────

/**
 * The set of actions the access evaluator gates. Most are read-side
 * (return content); mint/transfer/payment-settle/policy-escalation are
 * the small consequential set that opt into sync receipt emission.
 */
export type AccessAction =
  | 'read'
  | 'watch'
  | 'listen'
  | 'invoke'
  | 'remix'
  | 'mint'
  | 'transfer'
  | 'payment-settle'
  | 'policy-escalation'
  | 'disclosure';

export type AccessDecisionReason =
  | 'free'
  | 'owned'
  | 'credential-met'
  | 'token-proof-verified'
  | 'payment-required'
  | 'credential-required'
  | 'token-required'
  | 'policy-blocked'
  | 'guardian-vetoed';

/**
 * How the allowed payload is delivered.
 *   plain-redirect      — A: 302 to a public Supabase URL
 *   decrypt-stream      — B/C: server fetches ciphertext, decrypts, streams plaintext
 *   page-image-proxy    — gated PDFs: server renders page WebPs, browser never sees PDF bytes
 *   token-proof-stream  — D/E: holder signed challenge; server unwraps shared (D)
 *                         or per-holder (E) content key, decrypts, streams
 */
export type DeliveryMode =
  | 'plain-redirect'
  | 'decrypt-stream'
  | 'page-image-proxy'
  | 'token-proof-stream';

/**
 * Receipt mode for the action. Operator decision §11.2:
 *   async  default for high-frequency reads (PDF page, video stream, list).
 *          The decision returns at DB latency; the receipt is enqueued
 *          and anchored by the DVN pipeline with retry/backoff. A
 *          reconciliation sweep picks up drops.
 *   sync   opt-in for the small set of consequential actions where the
 *          receipt IS the proof: mint, transfer, payment-settle,
 *          policy-escalation, disclosure (root-DiD or kybe).
 *          `evaluateAccess` blocks on DVN anchoring before returning;
 *          failure to anchor returns allow=false / 'policy-blocked'.
 */
export type ReceiptMode = 'sync' | 'async';

export interface AccessReceiptHandle {
  mode: ReceiptMode;
  /** Present if mode='sync' or already queued. */
  receiptId?: string;
  /** T2 alias attribution (NEVER personaId or rootDid). */
  aliasCommitment: string;
  cohortId: string;
}

export interface AccessDecision {
  allow: boolean;
  reason: AccessDecisionReason;
  deliveryMode: DeliveryMode;
  /** Present when deliveryMode='token-proof-stream'. */
  tokenQubeProofChallenge?: string;
  receipt: AccessReceiptHandle;
  /** For ephemeral signed-URL grants. */
  expiresAt?: string;
}

export interface EvaluateAccessOptions {
  /**
   * Force sync receipt anchoring (default false). The boundary is set
   * per action type in services/access/policyResolvers.ts, not per
   * surface. Surfaces that pass `requireSyncReceipt: true` for a
   * non-consequential action have it down-graded to async with a log.
   */
  requireSyncReceipt?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Function signatures (implementations land in Phase 1+)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Server-side identity resolver. The single function that produces an
 * ActivePersonaContext. Replaces every ad-hoc personaId resolution in
 * the codebase (see `2026-05-05_unified-identity-content-access-foundation-plan.md`
 * §1.5 for the consumer migration list).
 *
 * Implementation: `services/identity/getActivePersona.ts` (Phase 1.1).
 */
export type GetActivePersona = (
  req: { headers: Headers; cookies?: { get: (k: string) => { value: string } | undefined }; url?: string }
) => Promise<ActivePersonaContext | null>;

/**
 * Server-side consented credential disclosure. Called by a small set
 * of compliance-bearing routes. Returns from a BlakQube unwrap; emits
 * a sync DVN receipt anchored to a fresh aliasCommitment.
 *
 * Implementation: `services/identity/discloseCredential.ts` (Phase 1.6).
 */
export type DiscloseCredential = (
  context: ActivePersonaContext,
  requester: DisclosureRequesterContext
) => Promise<DisclosedPersonaCredential>;

/**
 * Server-side content descriptor builder.
 *
 * Implementation: `services/content/getContentDescriptor.ts` (Phase 1.2).
 */
export type GetContentDescriptor = (
  assetId: string
) => Promise<ContentAccessDescriptor | null>;

/**
 * Server-side access evaluator. The single gate every consumer calls.
 * Surfaces that contain a gating check that is not a call into this
 * function are bugs (see plan §8 principle 9).
 *
 * Implementation: `services/access/evaluateAccess.ts` (Phase 1.3).
 */
export type EvaluateAccess = (
  context: ActivePersonaContext,
  descriptor: ContentAccessDescriptor,
  action: AccessAction,
  opts?: EvaluateAccessOptions
) => Promise<AccessDecision>;
