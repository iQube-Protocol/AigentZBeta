-- AuthorityQube / DIDQube candidate invariants for the CFS-051 research pipeline.
--
-- IMPORTANT: candidate research only. These are not canonized invariants and
-- do not assert that a first-class DIDQube or AuthorityQube primitive exists
-- in the shipped runtime today. Promotion remains governed by the existing
-- invariant canonization ceremony.

INSERT INTO public.research_candidate_invariants
  (slug, namespace, statement, rationale, status, depends_on, source_note)
VALUES
  (
    'cand-inv-authority-independent-personhood-credential',
    'constitutional',
    'Authority should be credentialized independently of personhood and associated with the constitutional subject through a privacy-preserving credential container, so authority may be independently issued, scoped, expired and revoked without changing the subject''s personhood credential.',
    'Personhood is comparatively persistent; authority is plural, contextual, issuer-dependent, time-bound and revocable. Overloading the Polity Passport with mutable authority state would collapse two distinct constitutional properties.',
    'candidate',
    ARRAY['invariant:cand-inv-personhood-not-sufficient-authority', 'invariant:cand-inv-delegation-no-ex-nihilo-authority'],
    'Candidate architecture/invariant emerging from the authority-provenance discussion. The working AuthorityQube / DIDQube terminology is provisional and must compose with the existing iQube metaQube/blakQube/tokenQube architecture rather than silently creating a competing primitive.'
  ),
  (
    'cand-inv-minimum-sufficient-authority-disclosure',
    'constitutional',
    'An execution or service system should receive the minimum sufficient proof of authority required for the proposed act, not the full identity, institutional affiliation or underlying authority evidence of the holder unless those disclosures are themselves necessary to the decision.',
    'Authority verification and personal identifiability are separable. Selective disclosure reduces unnecessary exposure while still allowing a verifier to establish that a valid authority credential exists, is current, is scoped to the act, and is delegable where delegation is required.',
    'candidate',
    ARRAY['invariant:cand-inv-execution-requires-authority-provenance', 'invariant:cand-inv-authority-independent-personhood-credential'],
    'Candidate privacy/authority invariant. Motivating example: proving sufficient corporate authority without necessarily disclosing the company or role to every downstream service. Exact cryptographic mechanism remains open research/design.'
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.research_backlog_items
  (slug, title, description, priority, status, linked_experiment_ids, linked_hypothesis_ids, source_note)
VALUES
  (
    'backlog-authorityqube-didqube-architecture',
    'Specify AuthorityQube / DIDQube privacy-preserving authority architecture',
    'Define a candidate architecture in which the Polity Passport anchors constitutional personhood while independently issued and revocable Authority Credentials / AuthorityQubes are associated with that subject inside an iQube/DIDQube privacy and identifiability envelope. Explore metaQube-style public discoverability, blakQube-style confidential authority evidence, selective disclosure, issuer provenance, scope, delegability, expiry/revocation, mandate binding and minimum-sufficient authority proofs. Reconcile terminology and shape against CFS-004 iQube Evolution before proposing any new first-class primitive.',
    'high',
    'backlog',
    '{}',
    ARRAY['cand-inv-authority-independent-personhood-credential', 'cand-inv-minimum-sufficient-authority-disclosure', 'cand-inv-execution-requires-authority-provenance'],
    'Candidate architecture only; no implementation or formal experiment is warranted yet. The design must extend the existing iQube metaQube/blakQube/tokenQube plane rather than fork it.'
  )
ON CONFLICT (slug) DO NOTHING;
