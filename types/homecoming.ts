/**
 * Chrysalis Homecoming — the CFS-023 programme contracts (Constitutional Agent
 * Sovereignty). The bridge between Chrysalis 2.0 (the platform becomes
 * constitutionally complete) and Chrysalis 3.0 (the ecosystem becomes a
 * constitutional society): Chrysalis gives the platform its constitutional
 * skeleton; Homecoming gives it its constitutional inhabitants.
 *
 * Contract-first, like types/invariantIntelligence.ts and types/constitutional.ts:
 * this file is the CONTRACT only — order-pinned constitutional data + pure
 * helpers, no runtime organs. The runtime organ that consumes it is the live
 * Homecoming Test (services/homecoming/constitutionalPresence.ts +
 * app/api/constitutional/homecoming-test/route.ts), mirroring the Chrysalis Test.
 *
 * Naming discipline (deliberate, to avoid collision with the existing
 * sovereignty vocabulary): the s0–s5 Sovereignty Scale (types/constitutional.ts,
 * `SOVEREIGNTY_SCALE`) grades the INTELLIGENCE SUPPLY + platform substrate; the
 * `SovereigntyTier` (services/constitutional/modelQube.ts) grades the MODEL
 * CLASS. Neither is reused here. The five constitutional sovereignties below are
 * a DIFFERENT axis — the layers of the stack that become sovereign — and the
 * Constitutional Presence ladder uses L0–L5, never s0–s5.
 *
 * Isomorphic: no fs, no DB, no clock, no network — safe anywhere.
 *
 * Order constants are constitutional data (sequencing corollary of Law XV),
 * canary-pinned in tests/homecoming.test.ts.
 */

// ---------------------------------------------------------------------------
// §1 The Chrysalis evolution ladder (CFS-023 §1) — order pinned
// ---------------------------------------------------------------------------

/**
 * The Chrysalis eras. Homecoming is the bridge era, sequenced strictly between
 * 2.0 and 3.0. Order is meaning: you cannot bring the inhabitants home before
 * the house is constitutionally complete, nor reach constitutional society
 * before the inhabitants are home. Pinned by canary.
 */
export const CHRYSALIS_ERAS = [
  'chrysalis-1.x', // Foundation — the constitutional primitives (Passport, Standing, Registry, iQubes, Delegation)
  'chrysalis-2.0', // Constitutional Computing — the platform becomes constitutionally complete
  'chrysalis-homecoming', // Constitutional Agent Sovereignty — the inhabitants come home
  'chrysalis-3.0', // Constitutional Society — the ecosystem becomes self-sustaining
] as const;

export type ChrysalisEra = (typeof CHRYSALIS_ERAS)[number];

// ---------------------------------------------------------------------------
// §2 The five constitutional sovereignties (CFS-023 §2) — the axis of layers
//     that become sovereign. NOT the s0–s5 supply scale.
// ---------------------------------------------------------------------------

/**
 * The five layers of the stack that each achieve constitutional sovereignty, in
 * maturity order. `computing` + `development` are delivered by Chrysalis 2.0;
 * `agent` + `knowledge` are the two Homecoming brings home; `operational` is the
 * business itself (Operation Leap). Order is the maturity ladder — pinned.
 */
export const CONSTITUTIONAL_SOVEREIGNTIES = [
  'computing', // reasoning · Invariant Intelligence · constitutional order
  'development', // Aigent Z · AgentiQ · development · deployment
  'agent', // Alethean · Marketa · Kn0w1 · MoneyPenny · future delegates — native constitutional operation
  'knowledge', // exports · documents · memories · VentureQubes · Standing · passports — the constitutional knowledge base
  'operational', // Operation Leap · Founder Office · Studio · Registry · Portfolio — the business runs constitutionally
] as const;

export type ConstitutionalSovereignty = (typeof CONSTITUTIONAL_SOVEREIGNTIES)[number];

/** Which programme delivers each sovereignty. Homecoming owns `agent` + `knowledge`. */
export const SOVEREIGNTY_PROGRAMME: Record<
  ConstitutionalSovereignty,
  'chrysalis-2.0' | 'chrysalis-homecoming' | 'operation-leap'
> = {
  computing: 'chrysalis-2.0',
  development: 'chrysalis-2.0',
  agent: 'chrysalis-homecoming',
  knowledge: 'chrysalis-homecoming',
  operational: 'operation-leap',
};

/** The sovereignties Chrysalis Homecoming is chartered to deliver. */
export const HOMECOMING_SOVEREIGNTIES: readonly ConstitutionalSovereignty[] = ['agent', 'knowledge'];

// ---------------------------------------------------------------------------
// §3 The four Homecoming workstreams (CFS-023 §4) — order pinned
// ---------------------------------------------------------------------------

/**
 * The four workstreams. Knowledge first (the delegates reason FROM the sovereign
 * knowledge base, so it must exist to reason from), then Agent (stand the
 * delegates up), then Harness (conversations move inside the platform), then
 * Operational (the daily operating rhythm becomes native). Order is meaning.
 */
export const HOMECOMING_WORKSTREAMS = [
  'knowledge', // establish the Constitutional Knowledge Repository — import AND constitutionalize
  'agent', // stand up constitutional delegates through the existing genesis→passport→persona pipeline
  'harness', // Human → Aigent Z → AgentiQ → Inference Providers; the frontier model becomes invisible
  'operational', // strategic planning, PRDs, Founder Office, Studio, deploy orchestration — all native
] as const;

export type HomecomingWorkstream = (typeof HOMECOMING_WORKSTREAMS)[number];

// ---------------------------------------------------------------------------
// §4 The Constitutional Presence ladder L0–L5 (CFS-023 §5) — per-delegate
//     maturity. Order pinned; contiguous (a gap stops the climb).
// ---------------------------------------------------------------------------

/**
 * Constitutional Presence — how present a delegate is WITHIN the Human Agency
 * System, measured per delegate. Not "does the delegate exist" but "is the
 * delegate constitutionally present": can it access the Registry, reason from
 * sovereign knowledge, invoke Studio, participate in development, operate under
 * bounded authority. Each rung is proven by a REAL, read-only-observable
 * artifact (see PRESENCE_SIGNAL). L0 first, L5 last. Order is meaning.
 */
export const CONSTITUTIONAL_PRESENCE_LADDER = [
  'card', // L0 — an Agent Card exists (hand-curated route or dynamic via agent_root_identity)
  'knowledge', // L1 — a persisted registry identity the knowledge/standing layer binds to
  'reasoning', // L2 — an agent persona routing through sovereign, invariant-aware inference
  'studio', // L3 — authorised to inspect/invoke Studio + skills
  'development', // L4 — participates in the constitutional development pipeline (packs, D1)
  'sovereign', // L5 — passport issued + active bounded delegation; operates natively
] as const;

export type PresenceLevel = (typeof CONSTITUTIONAL_PRESENCE_LADDER)[number];

/** The real artifact that proves each presence rung (what the live scorer reads). */
export const PRESENCE_SIGNAL: Record<PresenceLevel, { level: number; proof: string }> = {
  card: { level: 0, proof: 'an Agent Card is published (agent_root_identity row or a hand-curated card route)' },
  knowledge: { level: 1, proof: 'a seeded agent_root_identity — a persisted registry identity, not just a static card' },
  reasoning: { level: 2, proof: 'an agent_persona (did:agent:persona:…:production) routing through bounded sovereign inference' },
  studio: { level: 3, proof: 'a delegation grant whose scope authorises draft_document / skill invocation (Studio access)' },
  development: { level: 4, proof: 'a delegation grant whose scope authorises registry_submission_proposal (the development pipeline)' },
  sovereign: { level: 5, proof: 'an issued participant passport (bound_passport_id) AND an active bounded-delegation grant' },
};

/** The numeric index of a presence level (0–5), or -1 if unknown. Pure. */
export function presenceLevelIndex(level: string): number {
  return (CONSTITUTIONAL_PRESENCE_LADDER as readonly string[]).indexOf(level);
}

/**
 * Resolve a delegate's presence from its per-rung satisfied signals. The ladder
 * is CONTIGUOUS and honest: presence is the highest rung reached with no gap
 * below it — you cannot be "development connected" without being "reasoning
 * connected." Returns the level string, or `null` if not even L0 (card) holds
 * (a conceptual delegate, below the ladder). Pure, deterministic.
 */
export function resolvePresenceLevel(satisfied: Partial<Record<PresenceLevel, boolean>>): PresenceLevel | null {
  let reached: PresenceLevel | null = null;
  for (const level of CONSTITUTIONAL_PRESENCE_LADDER) {
    if (!satisfied[level]) break; // contiguity: first gap stops the climb
    reached = level;
  }
  return reached;
}

// ---------------------------------------------------------------------------
// §5 The Homecoming Test dimensions (CFS-023 §6) — the acceptance criterion
// ---------------------------------------------------------------------------

/**
 * The Homecoming Test is not continuity alone. A delegate has come home when it
 * performs its role with all three: it remains recognisably itself
 * (`continuity`), it reasons from the sovereign knowledge base (`knowledge`),
 * and it can do MORE because it has direct platform access (`capability`) —
 * while operating natively within the Human Agency System. This aligns with the
 * Chrysalis 2.0 improvement principle: homecoming must IMPROVE the delegate,
 * never merely relocate it. Order pinned.
 */
export const HOMECOMING_TEST_DIMENSIONS = [
  'continuity', // it remains recognisably the same delegate
  'knowledge', // it reasons from your sovereign knowledge base
  'capability', // it can do more because it has direct platform access
] as const;

export type HomecomingTestDimension = (typeof HOMECOMING_TEST_DIMENSIONS)[number];

// ---------------------------------------------------------------------------
// §6 The delegate roster (CFS-023 §4.2) — charter-time snapshot, honestly graded
// ---------------------------------------------------------------------------

/** The named constitutional delegates Homecoming stands up, in first-mover order. */
export const HOMECOMING_DELEGATES = [
  'aigent-z',
  'marketa',
  'kn0w1',
  'aletheon',
  'moneypenny',
  'nakamoto',
] as const;

export type HomecomingDelegateId = (typeof HOMECOMING_DELEGATES)[number];

/**
 * Charter-time standing of each delegate (2026-07-09). This is a STATIC,
 * dated snapshot for the charter's honesty ledger — the LIVE presence is
 * computed by the scorer against real tables, never read from here.
 *   - `concrete`  — seeded agent_root_identity + charter + wallet (real registry identity today)
 *   - `archetype` — a full Agent Card exists but DB-unseeded / passport pending issuance (the first-mover)
 *   - `conceptual`— codex pack + wallet only; no card, no root seed, no passport (needs the full pipeline)
 */
export type DelegateCharterStatus = 'concrete' | 'archetype' | 'conceptual';

export const DELEGATE_CHARTER_STATUS: Record<
  HomecomingDelegateId,
  { agentClass: string; homeRealm: string; status: DelegateCharterStatus }
> = {
  'aigent-z': { agentClass: 'system-orchestrator', homeRealm: 'agentiq', status: 'concrete' },
  marketa: { agentClass: 'guide-agent', homeRealm: 'agentiq', status: 'concrete' },
  kn0w1: { agentClass: 'guide-agent', homeRealm: 'agentiq', status: 'concrete' },
  aletheon: { agentClass: 'specialist', homeRealm: 'agentiq', status: 'archetype' },
  moneypenny: { agentClass: 'guide-agent', homeRealm: 'agentiq', status: 'conceptual' },
  nakamoto: { agentClass: 'specialist', homeRealm: 'agentiq', status: 'conceptual' },
};

// ---------------------------------------------------------------------------
// §7 Knowledge Homecoming source classes (CFS-023 §4.1) — order pinned
// ---------------------------------------------------------------------------

/**
 * The classes of knowledge that come home into the Constitutional Knowledge
 * Repository. Every class except `chatgpt-export` already has a production
 * surface in the platform (Codex KB, invariant substrate, VentureQubes,
 * PortfolioQubes, Experience Guides, Standing VSP) — Knowledge Homecoming
 * INTEGRATES those, it does not reinvent them. `chatgpt-export` is the one
 * genuinely-new intake path (nothing exists today) and is flagged accordingly.
 */
export const KNOWLEDGE_HOMECOMING_SOURCES = [
  'chatgpt-export', // NEW intake — conversation exports; the only class without an existing surface
  'documents', // PRDs, architectural + constitutional papers → Codex KB (domain protocol/polity)
  'venture-qubes', // venture_qubes.layers (13-layer V1)
  'portfolio-qubes', // venture_portfolios
  'experience-guides', // experience_qubes.blak_qube.personalGuide
  'standing', // vsp_facts + vsp_profiles.standing_graph
  'registry-metadata', // iq_meta_qubes / iqube_id_map
] as const;

export type KnowledgeHomecomingSource = (typeof KNOWLEDGE_HOMECOMING_SOURCES)[number];

/** True iff a knowledge source still needs a genuinely-new intake path built. */
export function knowledgeSourceIsNew(source: KnowledgeHomecomingSource): boolean {
  return source === 'chatgpt-export';
}

/**
 * The objective of Knowledge Homecoming is not import but CONSTITUTIONALIZATION:
 * knowledge becomes invariant-aware. The two established downstream idioms an
 * imported source is routed through (never a new store):
 *   - `invariant-extraction` → the `invariants` substrate (initializeKnowledge)
 *   - `meta-blak-split`       → the governed iQube meta(T1)/blak(T0) storage idiom
 */
export const CONSTITUTIONALIZATION_IDIOMS = ['invariant-extraction', 'meta-blak-split'] as const;

export type ConstitutionalizationIdiom = (typeof CONSTITUTIONALIZATION_IDIOMS)[number];

// ---------------------------------------------------------------------------
// §8 Agent continuity (SPEC-HMC-001) — the per-migration-event contracts.
//
//     SPEC-HMC-001 is the mechanics layer under CFS-023's `agent` + `knowledge`
//     sovereignties (the same relation SPEC-VLM-001 has to CFS-050). It defines
//     no new sovereignty, ladder, or invariant class — so its contracts live
//     HERE, in the CFS-023 contract file, never in a parallel constant set.
//     Order constants are constitutional data, canary-pinned like §1–§7 above.
// ---------------------------------------------------------------------------

/**
 * The six states one continuity event (one delegate, one source host, one
 * migration) moves through — SPEC-HMC-001 §3. Order is meaning, and it is the
 * per-event form of HOMECOMING_WORKSTREAMS' programme-level ordering: knowledge
 * (constitutionalize) before agent (reconstitute presence) before native
 * operation. Pinned by canary.
 */
export const MIGRATION_LIFECYCLE_STAGES = [
  'origin-observed', // 1 — source host/session identified, its material located
  'constitutionalized', // 2 — parsed by a host-specific pure parser into the `homecoming` KB domain; principles PROPOSED
  'principal-ratified', // 3 — the HUMAN decides which proposed invariants become durable (Law XI)
  'presence-reconstituted', // 4 — Constitutional Presence re-climbed CONTIGUOUSLY on the destination host
  'delegation-reauthorized', // 5 — the HUMAN re-grants bounded authority (Principal–Delegate Separation)
  'native', // 6 — operates fully in-platform; the source host is inert history
] as const;

export type MigrationLifecycleStage = (typeof MIGRATION_LIFECYCLE_STAGES)[number];

/**
 * What proves each stage, and — load-bearing — whether the stage is a HUMAN act.
 *
 * `humanAct: true` marks the two stages SPEC-HMC-001 §3 names as the precise
 * mechanical difference between "importing chats" and "preserving agency":
 * stage 3 (the principal ratifies what is preserved, Law XI) and stage 5 (the
 * principal re-authorizes bounded authority, Principal–Delegate Separation).
 * Neither can be observed from platform state alone and NEITHER may ever be
 * performed by an agent on its own behalf. Stage 6 depends on stage 5, so it
 * inherits the same human dependency.
 */
export const MIGRATION_STAGE_SIGNAL: Record<
  MigrationLifecycleStage,
  { index: number; proof: string; humanAct: boolean }
> = {
  'origin-observed': {
    index: 0,
    proof: 'source material for this delegate is located and consented-to (Companion capture or an operator-provided export)',
    humanAct: false,
  },
  constitutionalized: {
    index: 1,
    proof: 'source material is ingested into the `homecoming` KB domain and its governing principles are PROPOSED into the invariants substrate',
    humanAct: false,
  },
  'principal-ratified': {
    index: 2,
    proof: 'the human principal has ratified which proposed invariants become durable (Law XI — humans define semantics)',
    humanAct: true,
  },
  'presence-reconstituted': {
    index: 3,
    proof: 'the delegate has climbed the Constitutional Presence ladder CONTIGUOUSLY on the destination host (assessDelegate)',
    humanAct: false,
  },
  'delegation-reauthorized': {
    index: 4,
    proof: 'the human principal has FRESHLY re-authorized bounded authority on the new host — never inherited by assertion',
    humanAct: true,
  },
  native: {
    index: 5,
    proof: 'the delegate operates fully in-platform under the re-authorized scope; the source host is an inert historical record',
    humanAct: true,
  },
};

/** The numeric index of a lifecycle stage (0–5), or -1 if unknown. Pure. */
export function migrationStageIndex(stage: string): number {
  return (MIGRATION_LIFECYCLE_STAGES as readonly string[]).indexOf(stage);
}

/**
 * Resolve the highest CONTIGUOUS lifecycle stage from per-stage satisfaction —
 * the same contiguity discipline as `resolvePresenceLevel`, for the same reason:
 * SPEC-HMC-001 §3 states that an event which skips stage 3 or stage 5 "has not
 * achieved continuity — it has performed an import." A gap stops the climb, so
 * a later stage can never be credited over a missing earlier one. Returns null
 * when not even stage 1 holds. Pure, deterministic.
 */
export function resolveMigrationStage(
  satisfied: Partial<Record<MigrationLifecycleStage, boolean>>,
): MigrationLifecycleStage | null {
  let reached: MigrationLifecycleStage | null = null;
  for (const stage of MIGRATION_LIFECYCLE_STAGES) {
    if (!satisfied[stage]) break; // contiguity: first gap stops the climb
    reached = stage;
  }
  return reached;
}

/**
 * The ceiling a READ-ONLY assessment of platform state may ever resolve to.
 *
 * Stage 4 (`presence-reconstituted`) is the last stage provable from observable
 * artifacts. Stages 5–6 turn on a human act (see MIGRATION_STAGE_SIGNAL's
 * `humanAct`) that no assessment can observe and no agent may perform on its own
 * behalf. An assessment surface that reported stage 5 as reached would be
 * asserting a human authorization that did not happen — the exact backdoor
 * SPEC-HMC-001 §9.2 component 6 forbids. Canary-pinned.
 */
export const ASSESSABLE_STAGE_CEILING: MigrationLifecycleStage = 'presence-reconstituted';

/** True iff the stage requires a human act (never agent-performable). Pure. */
export function stageRequiresHumanAct(stage: MigrationLifecycleStage): boolean {
  return MIGRATION_STAGE_SIGNAL[stage].humanAct;
}

/**
 * The five-part continuity taxonomy — SPEC-HMC-001 §9/§10, the operator's own
 * naming. Finer-grained than CFS-023's single `continuity` Homecoming Test
 * dimension (HOMECOMING_TEST_DIMENSIONS above), which it decomposes rather than
 * replaces. Order pinned.
 */
export const AGENT_CONTINUITY_DIMENSIONS = [
  'behavioural', // the reasoning substrate that generates behaviour (Personal + Domain Invariants)
  'working-context', // current intent + in-flight commitments — resume, don't restart cold
  'project', // working context scoped to a specific venture/intent
  'artefact', // what the delegate produced stays attributed to the SAME delegate
  'relationship', // earned standing carried forward; authority freshly re-granted
] as const;

export type AgentContinuityDimension = (typeof AGENT_CONTINUITY_DIMENSIONS)[number];

/**
 * Each continuity dimension bound to (a) the lifecycle stage that owns it and
 * (b) the §9.2 Constitutional Agent Reconstitution component(s) it realises.
 * This is SPEC-HMC-001 §10's mapping table as data — the doc's table and this
 * constant are the same claim, so `tests/homecoming.test.ts` pins the mapping.
 */
export const CONTINUITY_DIMENSION_SPEC: Record<
  AgentContinuityDimension,
  { stage: MigrationLifecycleStage; reconstitutionComponents: readonly number[]; proof: string }
> = {
  behavioural: {
    stage: 'principal-ratified',
    reconstitutionComponents: [1, 2], // Personal Invariants intact · Domain Invariants intact
    proof: 'constitutionalized source material exists in the `homecoming` KB domain AND its extracted principles have been ratified by the human principal',
  },
  'working-context': {
    stage: 'presence-reconstituted',
    reconstitutionComponents: [4], // working context intact
    proof: "the delegate's current intent and in-flight commitments are re-derivable on the destination host",
  },
  project: {
    stage: 'presence-reconstituted',
    reconstitutionComponents: [4], // working context, scoped to one venture/intent
    proof: "the delegate's venture/intent-scoped working context is re-derivable on the destination host",
  },
  artefact: {
    stage: 'native',
    reconstitutionComponents: [5], // artefact provenance intact
    proof: 'artifacts the delegate produced remain attributed to the SAME delegate identity, never orphaned',
  },
  relationship: {
    stage: 'delegation-reauthorized',
    reconstitutionComponents: [3, 6], // earned standing carried forward · authority FRESHLY re-granted
    proof: 'earned standing carries forward AND the human principal has freshly re-authorized bounded scope',
  },
};

/**
 * The third-party agent hosts SPEC-HMC-001 §10 names as migration objectives.
 * `chatgpt-export` is deliberately spelled to match KNOWLEDGE_HOMECOMING_SOURCES[0]
 * — it is the SAME source class, not a second name for it (parity canary-pinned).
 */
export const MIGRATION_SOURCE_HOSTS = ['chatgpt-export', 'claude-ai', 'claude-code', 'codex'] as const;

export type MigrationSourceHost = (typeof MIGRATION_SOURCE_HOSTS)[number];

/**
 * True iff a shipped parser exists for this host's source material today.
 * ONLY `chatgpt-export` does (`services/homecoming/chatgptImport.ts`). The other
 * three are named objectives with no parser — SPEC-HMC-001 §11's first honest
 * limit, and explicitly NOT authorised to be built by that SPEC's ratification.
 * Reporting this honestly is the point: never let a surface imply coverage that
 * does not exist.
 */
export function migrationSourceParserExists(host: MigrationSourceHost): boolean {
  return host === 'chatgpt-export';
}
