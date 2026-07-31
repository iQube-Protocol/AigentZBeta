-- Seed data for the Experiment / Constitutional / Invariant Registry
-- (CFS-051, Strand 1 build 2026-07-24). Idempotent (ON CONFLICT (slug) DO
-- NOTHING) — safe to re-run.
--
-- Every row below was located by a real, honest grep/read of this repo
-- (codexes/packs/irl/foundation/*.md, codexes/packs/agentiq/updates/*.md,
-- CLAUDE.md) — none is invented. Where no real charter could be found, the
-- row says so explicitly in `source_note` rather than fabricating one
-- (per CLAUDE.md "No Guessing or Hallucinating").
--
-- Mid-build correction (same session, 2026-07-24): this is Strand 1 of a
-- four-strand operator programme running CONCURRENTLY on this branch.
-- Strand 2 (SPEC-HMC-001_constitutional-agent-continuity.md) and Strand 3
-- (SPEC-COS-001_constitutional-onboarding-specification.md) landed on this
-- same branch mid-build and directly answer three items this migration had
-- originally marked "no charter yet" / "partial match" (Constitutional Agent
-- Reconstitution, Agent Continuity, Progressive Surface Activation, Common
-- Onboarding Substrate). Re-checked against those two real docs before
-- finalizing the rows below — see each row's source_note.
--
-- Extend-don't-duplicate note: "Software Invariants" is ALREADY a shipped
-- entry in types/research.ts's EXPERIMENT_REGISTRY (id 'ISR-001', series
-- 'ISE') — its row here is a CROSS-REFERENCE marker (status 'promoted',
-- depends_on 'EXP-registry:ISR-001'), not a duplicate source of truth for
-- its hypothesis/protocol.

-- ─── Candidate Experiments — the operator's twelve named workstreams ─────

INSERT INTO public.research_candidate_experiments
  (slug, title, family, hypothesis, charter_ref, status, depends_on, source_note)
VALUES
  (
    'cand-exp-invariant-discovery-engine',
    'Invariant Discovery Engine',
    'Invariant Discovery Engine (CFS-048)',
    'A domain corpus can be walked (domain → pillar → coverage ladder, with parent-linking and recursive compression) to DISCOVER candidate invariants, rather than hand-authoring them — the discovery pipeline this very registry''s candidate-invariant table is designed to receive output from.',
    'codexes/packs/agentiq/updates/2026-07-20_cfs-048-invariant-discovery-engine-charter.md',
    'published',
    '{}',
    'Real charter: CFS-048 (2026-07-20), extended same-week by parent-linking, phase1a domain-ladder, phase2-compare, and recursive-compression amendments (all in codexes/packs/agentiq/updates/) and a 2026-07-23 constitutional-discovery-domain-architect amendment (PRD-ICA-001).'
  ),
  (
    'cand-exp-financial-services-invariant-refinement',
    'Financial Services invariant refinement',
    'Financial Services Constitutional Capability Domain (CRP-003 / CRP-003a)',
    'Financial Services invariants (inv.finance.*, proposed) should be DERIVED from the QriptoCENT corpus by the Invariant Discovery Engine, never hand-authored — CRP-003a''s N1–N3 increments (Constitutional Agreement primitive, the 12-step service pipeline, the FS Capability Suite) already prove the composition pattern on ~85-90% shipped primitives.',
    'codexes/packs/irl/foundation/CRP-003_financial-services-constitutional-capability-domain.md',
    'published',
    '{}',
    'Real charters: CRP-003 + CRP-003a (foundation/); build history in CHRYSALIS_WORKSTREAM_TRACKER.md rows 78-98 (Constitutional Agreement primitive N1, service-pipeline N2, FS Capability Suite N3, money-moving domains, spend-cap P3).'
  ),
  (
    'cand-exp-software-invariants',
    'Software Invariants',
    'Invariant Software Engineering (ISE) — already ISR-001 in EXPERIMENT_REGISTRY',
    'See types/research.ts EXPERIMENT_REGISTRY id ISR-001 for the authoritative hypothesis (software capabilities have a minimum sufficient causal structure derivable from an explicit invariant set).',
    'codexes/packs/irl/foundation/experiments/isr-001-invariant-software-reduction/README.md',
    'promoted',
    ARRAY['EXP-registry:ISR-001'],
    'Already shipped in types/research.ts EXPERIMENT_REGISTRY as ISR-001 (series ISE) — this row is a CROSS-REFERENCE marker only, per Extend-Don''t-Duplicate; ISR-001 remains the single source of truth for this line''s hypothesis/protocol.'
  ),
  (
    'cand-exp-constitutional-navigation',
    'Constitutional Navigation',
    'Sovereignty Navigation (CFS-050)',
    'Navigation exists to guide agency, not classify features. Four ratified principles govern every cartridge''s navigation: action-over-object, progressive agency, reveal-capability-when-relevant, cross-cartridge consistency.',
    'codexes/packs/irl/foundation/CFS-050_sovereignty-navigation.md',
    'published',
    '{}',
    'Real charter: CFS-050, RATIFIED (operator-directed 2026-07-24); first applied test is Venture Lab per SPEC-VLM-001. The operator''s "Constitutional Navigation" maps to CFS-050''s own "Constitutional Navigation Principle 001-004" heading language exactly.'
  ),
  (
    'cand-exp-constitutional-agent-reconstitution',
    'Constitutional Agent Reconstitution',
    'Homecoming: Constitutional Agent Continuity Specification (SPEC-HMC-001 §9)',
    'Constitutional Agent Reconstitution is the re-derivation of a delegate''s Personal Invariants, Domain Invariants, working context, earned standing, and artefact provenance on a destination host after a migration event — verifiably, not by assertion — plus human re-authorization of its bounded authority there. Distinct, by explicit note in the source doc, from CRP-003a''s unrelated "Transaction Reconstitution" (financial receipt-trail replay) and from CFS-031 §3''s general platform-level Reconstitution (code/constitution convergence) — this is the AGENT-specific reading the earlier search in this migration could not find a dedicated charter for.',
    'codexes/packs/irl/foundation/SPEC-HMC-001_constitutional-agent-continuity.md',
    'scoped',
    ARRAY['experiment:cand-exp-homecoming'],
    'CORRECTED mid-build: SPEC-HMC-001 (Strand 2 of this same operator programme, landed on this branch during this session) is a direct, real charter for exactly this concept — its §9 is explicitly "a worked-through definition of Constitutional Agent Reconstitution (the operator''s own named sub-concept)". Status "scoped" not "published": the doc''s own header states "Status: DESIGN — docs-only, awaiting explicit operator ratification". Composes CFS-023 (Chrysalis Homecoming) rather than re-deriving it.'
  ),
  (
    'cand-exp-homecoming',
    'Homecoming',
    'Chrysalis Homecoming: Constitutional Agent Sovereignty (CFS-023)',
    'Chrysalis 2.0 made the platform constitutionally sovereign; Homecoming makes the AGENTS constitutionally sovereign within that platform — constitutional context, orchestration, memory, and permissions move to live in a sovereign environment rather than a conversational interface.',
    'codexes/packs/irl/foundation/CFS-023_chrysalis-homecoming.md',
    'published',
    '{}',
    'Real charter: CFS-023, "Status: Chartered 2026-07-09". Substrate exists: types/homecoming.ts, services/homecoming/constitutionalPresence.ts, app/api/constitutional/homecoming-test/route.ts, tests/homecoming.test.ts. CFS-031 (2026-07-15) separately describes CFS-023 as one of the "largely unbuilt" companion workstreams at that later date — both facts cited, neither smoothed over.'
  ),
  (
    'cand-exp-progressive-surface-activation',
    'Progressive Surface Activation',
    'Progressive surface activation doctrine (SPEC-COS-001 §4, extending CFS-050 §4)',
    'At every layer of the onboarding substrate, the arriving person is granted the MINIMUM surface needed to take their next action — never the union of everything the platform could eventually show them. Each layer''s crossing reveals the next layer''s surface; it does not pre-activate downstream surfaces "just in case." Server-side enforced, same discipline as access gates (never client-optimistic-only).',
    'codexes/packs/irl/foundation/SPEC-COS-001_constitutional-onboarding-specification.md',
    'scoped',
    ARRAY['experiment:cand-exp-common-onboarding-substrate', 'experiment:cand-exp-constitutional-navigation'],
    'CORRECTED mid-build: the exact phrase "Progressive surface activation" is now a named, titled doctrine — SPEC-COS-001 §4 (Strand 3 of this same operator programme, landed on this branch during this session), explicitly generalizing what CFS-050 and PRD-THR-001 each independently apply locally. Status "scoped" not "published": SPEC-COS-001''s own header states "Status: DESIGN (docs-only, ratify-before-build)".'
  ),
  (
    'cand-exp-sovereignty-journey',
    'Sovereignty Journey',
    'Customer matrix Sovereignty axis + CFS-050 §3 progression ladder',
    '"Sovereignty Journey" is an existing, shipped axis (Disheartened → Architect) in the Venture Lab / Studio customer matrix (services/venture/customerMatrix.ts, generalized 2026-06-21) — and is also the progression ladder CFS-050 §3 names explicitly: Citizen → Participate → Passport → Delegate → Operate → Steward → Founder Office → Portfolio Operator.',
    'codexes/packs/agentiq/updates/2026-06-21_generalized-customer-matrix-funnel.md',
    'published',
    '{}',
    'Real sources: 2026-06-21 update doc (Engagement × Sovereignty Journey matrix, services/venture/customerMatrix.ts) and CFS-050 §3''s explicit progression ladder.'
  ),
  (
    'cand-exp-common-onboarding-substrate',
    'Common Onboarding Substrate',
    'The Constitutional Onboarding Specification — the one substrate every arrival crosses (SPEC-COS-001)',
    'The operator''s own canonical substrate diagram (Claude → MCP → Passport → Delegation → Agent Me → Experience Qubes → Journey recommendation) stated as the ONE ordered structure every arrival takes — whether via a third-party agent (PRD-THR-001''s scope) or a direct human arrival (Founder Office direct, Studio direct, partner-issued invite) — before any specialist journey begins. Composes, never forks, PRD-THR-001/CFS-043/CFS-050/PRD-MMC-001.',
    'codexes/packs/irl/foundation/SPEC-COS-001_constitutional-onboarding-specification.md',
    'scoped',
    ARRAY['experiment:cand-exp-progressive-surface-activation', 'experiment:cand-exp-action-oriented-navigation'],
    'CORRECTED mid-build: SPEC-COS-001 (Strand 3 of this same operator programme, landed on this branch during this session) is a direct, real, on-point charter — its own subtitle is literally "the one substrate every arrival crosses". Earlier in this migration''s drafting, only the adjacent journey_states table (docs/agent-harness/journey-state-schema.md) could be found as a partial match; superseded by this real charter. Status "scoped" not "published": the doc''s own header states "Status: DESIGN (docs-only, ratify-before-build)".'
  ),
  (
    'cand-exp-action-oriented-navigation',
    'Action-oriented Navigation',
    'Action-Oriented Navigation Philosophy (SPEC-VLM-001 §3.2) + CFS-050 §2',
    'Onboarding journeys and cartridge navigation should be verbs ("Create", "Build", "Research", "Operate") rather than nouns — an intent-driven navigation model already applied across SmartTriad, Founder Office, and (per SPEC-VLM-001) Venture Lab, now ratified platform-wide as CFS-050 Principle 001 (action over object).',
    'codexes/packs/irl/foundation/SPEC-VLM-001_venture-lab-moneypenny-reorganisation.md',
    'published',
    '{}',
    'Real, exact match: SPEC-VLM-001 §3.2 is literally titled "Action-Oriented Navigation Philosophy"; ratified platform-wide the same day as CFS-050 §2 (Constitutional Navigation Principle 001 — Action over object).'
  ),
  (
    'cand-exp-constitutional-continuity',
    'Constitutional Continuity',
    'Individualization establishes constitutional continuity (CFS-009 identity hierarchy)',
    'Personhood establishes existence; Individualization establishes constitutional continuity; Identity establishes recognizability; Standing establishes constitutional capability — four distinct constitutional primitives, not four names for one thing, forming the chain of legitimacy for a constitutional subject.',
    'codexes/packs/irl/foundation/CFS-009_development-constitution.md',
    'scoped',
    '{}',
    'Real, verbatim quote found in CFS-009 (and repeated in IRL-010 §identity hierarchy). "Constitutional Continuity" is a defined term WITHIN CFS-009''s four-primitive chain, not a standalone charter of its own — marked "scoped" rather than "published" for that reason.'
  ),
  (
    'cand-exp-agent-continuity',
    'Agent Continuity',
    'Homecoming: Constitutional Agent Continuity Specification (SPEC-HMC-001)',
    'Agent continuity is the preservation of the constitutional reasoning substrate that generates a delegate''s behaviour — not the preservation of any particular transcript, chat history, or hosting environment. Continuity holds across a migration event iff the delegate''s Personal Invariants, Domain Invariants, working context, earned standing, and artefact provenance are each re-derivable (verifiably, not by assertion) on the destination host, AND the human principal has re-authorized the delegate''s bounded authority there. Five-part taxonomy: behavioural, working-context, project, artefact, relationship continuity.',
    'codexes/packs/irl/foundation/SPEC-HMC-001_constitutional-agent-continuity.md',
    'scoped',
    ARRAY['experiment:cand-exp-constitutional-agent-reconstitution', 'experiment:cand-exp-homecoming'],
    'CORRECTED mid-build: this migration originally found only adjacent infrastructure (agent_gateway_sessions; EXP-004/EXP-005) with no dedicated charter. SPEC-HMC-001 (Strand 2 of this same operator programme, landed on this branch during this session) is the real, exact, on-point charter — its own title is literally "Constitutional Agent Continuity Specification" and §1 gives the working definition quoted in the hypothesis field. Status "scoped" not "published": the doc''s own header states "Status: DESIGN — docs-only, awaiting explicit operator ratification".'
  ),
  -- ── Additional candidates identified from this session's own recent work
  --    (operator invitation to scan agentiq/updates + CFS-0xx for genuine
  --    open threads not on the named list) ────────────────────────────────
  (
    'cand-exp-invariant-engine-family',
    'Invariant Engine Family (Resolution / Projection / Knowledge-Resolution / Field Observatory)',
    'Constitutional Coordinates + Engine Bundle (CFS-035/037/038/039/040/041)',
    'A resolved constitutional field (IRE, CFS-037) projected and applied (IPE, CFS-035/039) against a coordinate registry (CFS-038), resolved into retrievable knowledge (CFS-040), and observed as a live field (CFS-041) — the full engine bundle behind IRV-001/IPV-001 (Instrument Validation) and EXP-P1/P2/P3 (Validation Programme v1) already in EXPERIMENT_REGISTRY.',
    'codexes/packs/irl/foundation/CFS-035_the-invariant-engine.md',
    'published',
    ARRAY['EXP-registry:IRV-001', 'EXP-registry:IPV-001', 'EXP-registry:EXP-P1', 'EXP-registry:EXP-P2', 'EXP-registry:EXP-P3'],
    'Real charter bundle: CFS-035 (ratified 2026-07-18) + CFS-037/038/039/040/041 (the resolution/coordinates/projection/knowledge-resolution/field-observatory sequence). Cross-references, not duplicates, the IV0/VP1 series experiments that already validate parts of this bundle in EXPERIMENT_REGISTRY.'
  ),
  (
    'cand-exp-constitutional-cybernetic-loop',
    'Constitutional Cybernetic Loop',
    'The two-rate model — fast loop (code) / slow loop (constitution) (CFS-031)',
    'Constitutional Computing is a cybernetic system where every action produces evidence improving both code and constitution via a two-rate model: a fast, high-variance code loop and a slow, low-variance constitutional loop, connected by Standing as the membrane (Action → Evidence → Standing → Confidence → Invariant Candidate → Ratification → Constitution).',
    'codexes/packs/irl/foundation/CFS-031_constitutional-cybernetic-loop.md',
    'published',
    '{}',
    'Real charter: CFS-031, RATIFIED 2026-07-15 (operator direction, "for reference and ratification," following CCE-006/007). The deepened Constitutional Computing definition, Standing-as-membrane, and Reconstitution (§3) are ratified as canonical doctrine; the macro loop (§4) and hypothesis sources (§5) are ratified as architectural vision, not yet delivered.'
  ),
  (
    'cand-exp-dcir',
    'Dynamic Constitutional Interaction Runtime (DCIR)',
    'DCIR — a canonical runtime capability (CFS-020)',
    'DCIR stands alongside Constitutional Reasoning, Constitutional Order, and Constitutional Action as a canonical runtime capability — governed by inv.interaction.112-118.',
    'codexes/packs/irl/foundation/CFS-020_dcir-charter.md',
    'published',
    '{}',
    'Real charter: CFS-020, authored 2026-07-06 per the operator''s DCIR spec. Contract: types/dcir.ts. Referenced as a live constraint in later work (e.g. 2026-07-21 "explain-primitive-constitutional-first" / "explain-primitive-resilient-canon-reads" update docs).'
  ),
  (
    'cand-exp-capability-brief-mysoftware-registry',
    'Capability Brief / mySoftware / Capability Registry (today''s active thread)',
    'Constitutional Capability Brief + mySoftware Artefact Inventory + Capability Registry (CFS-049 / SPEC-MMC-002 / CFS-032)',
    'A shipped capability earns a Constitutional Capability Brief (CFS-049) as the human-readable landing point, is admitted into the Capability Registry (CFS-032 §4/§5, services/constitutional/capabilityRegistry.ts) as its constitutional-acceptance ceremony, and surfaces to its own citizen-owner via the mySoftware tab (SPEC-MMC-002) — the self-improvement loop closing through registration, not the receipt.',
    'codexes/packs/irl/foundation/CFS-049_constitutional-capability-brief.md',
    'running',
    '{}',
    'Real, active thread as of today (2026-07-24): CFS-032 (ratified 2026-07-16), CFS-049, SPEC-MMC-002 (+ its 2026-07-23/24 phase implementation-plan updates: prd-mmc-impl-006 myResearch, prd-mmc-impl-007 mySoftware), and same-day CCB (Constitutional Capability Brief) docs for the Financial Services suite, metaMe Companion, and MoneyPenny runtime. This session found this thread mid-flight in the working tree (uncommitted edits to capabilityRegistry.ts/MySoftwareTab.tsx) — status set to ''running'', not ''published'', for that reason.'
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Candidate Constitutional Principles ────────────────────────────────

INSERT INTO public.research_candidate_principles
  (slug, statement, rationale, status, charter_ref, source_note)
VALUES
  (
    'cand-principle-runtime-is-place-of-record',
    'The Runtime is the Place of Record: constitutional collaborations occur within the constitutional runtime itself. Emails, PDFs, detached documents, and ad-hoc communications are convenience mechanisms for invitation only; the canonical state exists inside the runtime.',
    'CFS-044''s own §1 heading literally names this "a candidate constitutional invariant — for ratification." It is the clearest real example in the corpus of a principle at exactly the pre-ratification stage this table exists to track.',
    'under-review',
    'codexes/packs/irl/foundation/CFS-044_open-lab-reviewer-engagement.md',
    'Real, exact match: CFS-044 v2, "Chrysalis Foundation · Constitutional Charter v2 · Status: PROPOSED (ratify-before-build; Phase 0 executable today)". The v3 interim amendment (2026-07-18) built Participation as a nav domain but left this principle + the four-surface model + Reserved Research Space lifecycle explicitly unratified.'
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Candidate Structural Invariants ─────────────────────────────────────
-- Deliberately light seeding: the ratified canon (appendix-a_canonical-
-- invariants.md / canonical-invariants.seed.json) already carries its OWN
-- internal 'proposed' staging for invariants not yet canonized — re-adding
-- any of those here would be exactly the duplication this migration's
-- header warns against. The one row below is a genuinely NEW candidate
-- framing (a structural-invariant reading of a ratified governance
-- principle) not present in the canon file under any inv.* id.

INSERT INTO public.research_candidate_invariants
  (slug, namespace, statement, rationale, status, source_note)
VALUES
  (
    'cand-inv-progressive-surface-activation',
    'experience',
    'Capability surfaces activate progressively, gated by demonstrated relevance to current intent — never by feature completeness or up-front architecture exposure.',
    'A structural-invariant framing of CFS-050 §4 (a ratified GOVERNANCE principle, "reveal capability when relevant") — proposed here as a candidate for the invariant canon specifically, distinct from the governance charter it is derived from.',
    'candidate',
    'Derived from CFS-050 §4 (ratified 2026-07-24). NOT a duplicate of any existing inv.* id in appendix-a_canonical-invariants.md / canonical-invariants.seed.json as of this search — genuinely new candidate framing, not yet in the canon under any id.'
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── Research Backlog ─────────────────────────────────────────────────────

INSERT INTO public.research_backlog_items
  (slug, title, description, priority, status, source_note)
VALUES
  (
    'backlog-widen-registry-access-gate',
    'Widen canManageRegistry to cohort/token-gated public proposal access',
    'The operator''s own framing: "stubbed for opening up to cohorts or token gated access to enable public users to propose experiment or constitutional principles." services/research/registryAccess.ts::canManageRegistry is the single, documented widening point (today: platform admin only) — the natural composition target is the existing CAS research-lab access grant (services/passport/participationAccess.ts) that CFS-044''s Open Lab reviewer engagement already uses.',
    'high',
    'backlog',
    'Directly quotes the operator''s task framing; architected for exactly this in registryAccess.ts.'
  ),
  (
    'backlog-dvn-receipt-registry-actions',
    'DVN-receipt registry registration + status-transition actions',
    'services/constitutional/capabilityRegistry.ts (the structural template for this register) receipts every registration/operational-validation/deprecation as a DVN-anchorable activity_receipts row. This registry deliberately does NOT do so yet (append-only review_history jsonb is the audit trail for this slice) — a follow-on could add research_registry_item_registered / _status_changed action types, mirroring capability_registry''s CHECK-constraint-rebuild pattern, once real usage justifies DVN anchoring.',
    'medium',
    'backlog',
    'Scope decision documented in migration 20260820000000''s header comment and the CFS-051 charter doc.'
  ),
  (
    'backlog-clarify-agent-reconstitution-continuity-scope',
    'Ratify SPEC-HMC-001 (Constitutional Agent Continuity + Reconstitution)',
    'Originally logged as "no charter found" for cand-exp-constitutional-agent-reconstitution and cand-exp-agent-continuity. RESOLVED mid-build: SPEC-HMC-001 (Strand 2 of this same four-strand operator programme) landed on this branch during this session and directly charters both concepts. Its own header states "Status: DESIGN — docs-only, awaiting explicit operator ratification" — the remaining work is the operator''s ratification pass (§13 of that doc is the unchecked ratification record), not discovery.',
    'medium',
    'backlog',
    'Updated honestly mid-build once SPEC-HMC-001 (a sibling strand''s output) was found in the shared working tree — see this migration''s header comment for the discovery timeline.'
  )
ON CONFLICT (slug) DO NOTHING;
