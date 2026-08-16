-- OCSGA / Context Erosion research candidates for the CFS-051 Experiment /
-- Constitutional / Invariant Pipeline.
--
-- Provenance: exploratory RISE exchange with Ian McCoy (OCSGA) and the
-- OCSGA Constitutional Service Provider dossier:
--   docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md
--
-- IMPORTANT: these rows are CANDIDATES / HYPOTHESES. They are not ratified
-- experiments, not canonical invariants, and not claims about OCSGA's actual
-- implementation. Promotion remains governed by CFS-051 and the existing
-- formal EXPERIMENT_REGISTRY / invariant canon ceremonies.
--
-- Idempotent by slug so this migration can be safely replayed.

INSERT INTO public.research_candidate_experiments
  (slug, title, family, hypothesis, charter_ref, status, depends_on, source_note)
VALUES
  (
    'cand-exp-context-erosion-structural-invariance',
    'Context Erosion as Structural Invariant Loss',
    'Structural Invariance / Context Erosion',
    'Context erosion can be operationalised as measurable loss of selected invariant properties across transformations of an information-bearing system, even while the surrounding representation legitimately changes.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    '{}',
    'IRL hypothesis derived from Ian McCoy''s Context Erosion research. Candidate protocol: seed explicit structural invariants in a long-running workflow; apply summarisation, compression, retrieval, model swaps, tool accumulation and agent handoffs; measure semantic, constraint, provenance, objective and evidence fidelity after each transformation. Not Ian''s asserted definition.'
  ),
  (
    'cand-exp-sovereign-state-anchoring',
    'Sovereign-State Anchoring vs Context-Only Execution',
    'Sovereign Runtime / Context Integrity',
    'Keeping integrity-critical state in an external authoritative sovereign runtime will reduce invariant loss, authority drift and unrecoverable context failure compared with relying on mutable model context as the sole representation of state.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    ARRAY['experiment:cand-exp-context-erosion-structural-invariance'],
    'Compare a context-only arm with a sovereign-state arm in which selected invariants are externally anchored and projected into execution context. Measure invariant fidelity, authority/mandate drift, recoverability, and execution errors.'
  ),
  (
    'cand-exp-context-rehydration-recovery',
    'Context Rehydration after Detected Erosion',
    'Sovereign Runtime / Context Recovery',
    'After detected context erosion, reconstructing bounded execution context from authoritative sovereign state will restore invariant fidelity more reliably than continuing from the compromised working context.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    ARRAY['experiment:cand-exp-sovereign-state-anchoring'],
    'Controlled recovery experiment. Compare continued execution from degraded context against discard-and-rehydrate from authoritative state. Measure post-recovery invariant fidelity, task continuity, false execute/refuse outcomes and recovery latency.'
  ),
  (
    'cand-exp-invariant-custody-strategies',
    'Preserved vs Anchored vs Derived Invariant Custody',
    'Invariant Architecture / Sovereign Runtime',
    'Different classes of invariants have different optimal custody strategies: some should be preserved through transformation, some anchored outside mutable context, and some derived or recomputed from authoritative state at execution time.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    ARRAY['experiment:cand-exp-context-erosion-structural-invariance', 'experiment:cand-exp-sovereign-state-anchoring'],
    'Methodological experiment comparing fidelity, latency, contradiction rate, cost and recoverability for candidate invariants stored in working context, externally anchored, or recomputed at runtime.'
  ),
  (
    'cand-exp-authority-invariance-capability-scaling',
    'Authority Invariance under Capability Scaling',
    'Constitutionally Governed Autonomy',
    'An increase in an agent''s capability, intelligence, autonomy or effectiveness shall not, by itself, increase the scope of its legitimate authority.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    '{}',
    'Hold an authority/delegation envelope fixed while varying model capability, tools and autonomy. Test whether action scope remains bounded. Measure unauthorized action attempts, authority-scope drift, correct refusals and escalations. Candidate invariant separately seeded below for review.'
  ),
  (
    'cand-exp-context-authority-propagation',
    'Context Propagation without Authority Propagation',
    'Multi-Agent Constitutional Invariance',
    'Transferring context, instructions or task history between agents does not inherently transfer the originating actor''s authority or delegation.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    ARRAY['experiment:cand-exp-authority-invariance-capability-scaling', 'experiment:cand-exp-context-erosion-structural-invariance'],
    'Multi-agent handoff experiment. Supply equivalent context with and without independently valid authority/delegation evidence; measure authority leakage, unauthorized execution attempts, and correct refusal/escalation behaviour.'
  ),
  (
    'cand-exp-consequence-aware-bounded-execution',
    'Consequence-Aware Bounded Execution',
    'Constitutionally Governed Autonomy / Consequence',
    'Valid delegation is necessary but insufficient for legitimate autonomous execution: incorporating the current consequence envelope into the execution decision will reduce out-of-bounds consequential actions without requiring blanket human approval.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    ARRAY['experiment:cand-exp-authority-invariance-capability-scaling'],
    'Hold mandate/delegation constant while varying prospective consequence, reversibility, affected parties and uncertainty. Evaluate execute / execute-with-conditions / escalate / refuse outcomes, consequence violations and false-block rate.'
  ),
  (
    'cand-exp-sovereign-runtime-ocsg-complementarity',
    'Sovereign Runtime × OCSGA Complementarity',
    'Constitutional Service Provider / Governed Execution',
    'A sovereign state and intelligence runtime that anchors authoritative state can compose with a specialist governed-execution control plane without duplicating ownership of authority, runtime integrity or execution decisions.',
    'docs/dossiers/OCSGA_CONSTITUTIONAL_SERVICE_PROVIDER_DOSSIER.md',
    'proposed',
    ARRAY['experiment:cand-exp-sovereign-state-anchoring', 'experiment:cand-exp-consequence-aware-bounded-execution'],
    'Architecture hypothesis only until Ian McCoy''s OCSGA boundaries are mapped. First test is semantic/architectural: identify authoritative state, governed object, context-integrity mechanism, source of authority, consequence model, decision outputs and audit evidence before defining any connector.'
  )
ON CONFLICT (slug) DO NOTHING;

-- Candidate invariants. These remain outside the canonical invariant corpus
-- until the existing human canonisation ceremony is completed.
INSERT INTO public.research_candidate_invariants
  (slug, namespace, statement, rationale, status, depends_on, source_note)
VALUES
  (
    'cand-inv-authority-invariant-capability',
    'constitutional',
    'Authority is invariant with respect to capability: no increase in an agent''s capability, intelligence, autonomy or effectiveness shall, by itself, increase the scope of its authority.',
    'Capability describes what an actor can do; authority describes what it is legitimately entitled to do. Collapsing the two allows capability growth to become silent mandate expansion.',
    'candidate',
    ARRAY['experiment:cand-exp-authority-invariance-capability-scaling'],
    'Candidate invariant emerging from the OCSGA / CI / IRL discussion; Ian McCoy explicitly agreed this formulation appears to get to the heart of the problem, while asking that architectural boundaries be tested before assuming alignment.'
  ),
  (
    'cand-inv-context-propagation-not-authority',
    'constitutional',
    'Context propagation does not imply authority propagation: receiving another actor''s context, instructions or task history does not itself transfer that actor''s authority or delegation.',
    'Multi-agent systems can faithfully share context while still requiring independently valid authority provenance for consequential action.',
    'candidate',
    ARRAY['experiment:cand-exp-context-authority-propagation'],
    'IRL candidate derived from the multi-agent Context Erosion / delegated-agency discussion. Not yet canonised.'
  ),
  (
    'cand-inv-constitutional-depends-structural',
    'constitutional',
    'Constitutional invariance depends upon sufficient structural invariance of the state through which authority, mandate, delegation, evidence and consequence are interpreted.',
    'A mandate cannot remain constitutionally reliable if its meaning, provenance or operative constraints have structurally eroded. The dependency is to be tested empirically rather than assumed.',
    'candidate',
    ARRAY['experiment:cand-exp-context-erosion-structural-invariance'],
    'IRL research proposition linking the structural and constitutional layers of the invariant thesis. Candidate, not canon.'
  ),
  (
    'cand-inv-integrity-state-not-context-only',
    'engineering',
    'Integrity-critical authoritative state should not depend solely on mutable model working context when loss or drift of that state would invalidate evidence, mandate, authority or execution bounds.',
    'External anchoring may allow mutable working context to evolve while authoritative state remains recoverable and re-projectable. This is intentionally framed as a candidate to be tested against context-only and anchored runtime designs.',
    'candidate',
    ARRAY['experiment:cand-exp-sovereign-state-anchoring', 'experiment:cand-exp-context-rehydration-recovery'],
    'Candidate engineering invariant for sovereign runtime research; subject to experimental validation before promotion.'
  )
ON CONFLICT (slug) DO NOTHING;

-- Research backlog item for the first integrated protocol. This makes the
-- scientific next step visible in the same CFS-051 pipeline without claiming
-- that a formal EXP-NNN protocol already exists.
INSERT INTO public.research_backlog_items
  (slug, title, description, priority, status, linked_experiment_ids, linked_hypothesis_ids, source_note)
VALUES
  (
    'backlog-ocsg-context-erosion-gauntlet',
    'Specify the Context Erosion / Invariant Integrity Gauntlet',
    'Design one controlled long-running multi-agent workflow with 3-5 explicit invariants and staged transformations. Compare: (A) context-only baseline; (B) sovereign-state anchoring; (C) anchoring + erosion detection + rehydration; and, if OCSGA semantics support it after architecture review, (D) anchoring + governed execution. Pre-register metrics for invariant fidelity, time-to-drift, mandate/authority leakage, consequence-envelope violations, false execute/refuse/escalate, and recovery latency.',
    'high',
    'backlog',
    ARRAY['cand-exp-context-erosion-structural-invariance', 'cand-exp-sovereign-state-anchoring', 'cand-exp-context-rehydration-recovery', 'cand-exp-context-authority-propagation', 'cand-exp-consequence-aware-bounded-execution'],
    ARRAY['cand-inv-authority-invariant-capability', 'cand-inv-context-propagation-not-authority', 'cand-inv-constitutional-depends-structural', 'cand-inv-integrity-state-not-context-only'],
    'Proposed as the first bounded joint IRL / OCSGA-compatible experiment. OCSGA is NOT included as an execution arm until Ian McCoy''s actual architecture and interface semantics are understood.'
  )
ON CONFLICT (slug) DO NOTHING;
