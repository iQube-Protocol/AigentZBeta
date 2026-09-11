-- 20260822000000_cdr_domain_profiles.sql
--
-- SPEC-CDR-001 P5 — provisional discovery + abstention. Schema only; no P5
-- code exists yet (operator: "Do not implement P5 until the SQL has been
-- reviewed").
--
-- THE SEPARATION THIS MIGRATION EXISTS TO PRESERVE (operator, P5-6):
--
--   discovery_candidates  — the RESEARCH artifact and its review lifecycle.
--                           Evidence, synthesis, inferred confidence, status.
--   domain_profiles       — the RUNTIME artifact CDR and the Overlay resolve
--                           against. Promoted from a candidate, never written
--                           by the runtime.
--
-- Putting both in the generic candidate table would couple runtime resolution
-- to research-workflow storage. The Overlay and the IRE MUST NOT query
-- discovery_candidates directly; they read domain_profiles.
--
-- Two numbers that must never collapse into one (operator):
--   confidence             = how strongly does the evidence support this?
--                            (inferred, lives on the candidate, copied onto
--                            the promoted profile as the discovered claim)
--   presentation_threshold = how much support do we require before
--                            interrupting the citizen? (operational policy,
--                            lives ONLY on the runtime profile, nullable,
--                            falls back to CDR_PRESENTATION_THRESHOLD)
--
-- The threshold is NOT evidence about the subject and must not masquerade as
-- part of the profile's constitutional truth — hence nullable-with-default
-- rather than a mandatory value stamped on every row.
--
-- T0/T2 discipline: NO personaId, authProfileId, rootDid or caseId appears
-- anywhere in this migration. `verified_by` carries the authority union
-- (`polity-public-ref:<T2>` or an operator-ratification decision ref), never a
-- persona identifier. The presentation-event log deliberately carries NO
-- subject identifier of any kind: the abstention metric is about PROFILES,
-- never about which citizen saw what — a per-citizen behavioural log is not
-- something this SPEC authorises. Service-role access only; RLS enabled with
-- no client policies, matching discovery_evidence / discovery_candidates /
-- corpus_candidate_sources. Additive and idempotent (CFS-010 §3).

-- ---------------------------------------------------------------------------
-- 1. Minimal candidate-storage extension.
--
-- `discovery_candidates` is invariant-shaped (statement / rationale /
-- discovery_class / abstraction_level / promoted_invariant_id). Domain Profile
-- candidates are a second Discovery Artifact type (D-12 §13.3), so they need:
--   - a type discriminant, defaulting to 'invariant' so every existing row is
--     unchanged and correctly classified;
--   - a payload for profile-specific fields, as jsonb rather than four columns
--     that would be NULL on every invariant row;
--   - forward lineage to the promoted profile, mirroring promoted_invariant_id.
-- ---------------------------------------------------------------------------

ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS artifact_type text NOT NULL DEFAULT 'invariant';

ALTER TABLE public.discovery_candidates
  DROP CONSTRAINT IF EXISTS discovery_candidates_artifact_type_check;
ALTER TABLE public.discovery_candidates
  ADD  CONSTRAINT discovery_candidates_artifact_type_check
    CHECK (artifact_type IN ('invariant', 'domain-profile'));

-- Profile-specific proposal fields: subject_type, subject_id, overlay_context,
-- capability_modules, aliases. Empty for invariant candidates.
ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS artifact_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Forward lineage. A candidate promotes to EITHER an invariant OR a profile,
-- never both — the constraint makes a mis-promotion fail at write time rather
-- than leaving two half-populated lineages to reconcile later.
ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS promoted_profile_id uuid;

ALTER TABLE public.discovery_candidates
  DROP CONSTRAINT IF EXISTS discovery_candidates_promotion_target_check;
ALTER TABLE public.discovery_candidates
  ADD  CONSTRAINT discovery_candidates_promotion_target_check
    CHECK (promoted_invariant_id IS NULL OR promoted_profile_id IS NULL);

CREATE INDEX IF NOT EXISTS discovery_candidates_artifact_type_idx
  ON public.discovery_candidates (artifact_type, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. The runtime-readable profile store.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.domain_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHAT is classified. Subject-general by design (§5.3) so the same store
  -- serves the Horizen pilot's agent profiles without a second table.
  subject_type text NOT NULL DEFAULT 'hostname'
    CHECK (subject_type IN ('hostname','application-route','agent','capability','tool','service','workflow')),
  -- Canonical subject, normalised lowercase by the writer.
  subject_id text NOT NULL,
  -- Additional subjects resolving to THIS SAME profile (the `www` case).
  -- An array on one row, never duplicated profile bodies (D-15).
  aliases text[] NOT NULL DEFAULT '{}',

  overlay_context text NOT NULL DEFAULT 'financial-context'
    CHECK (overlay_context IN ('financial-context')),

  -- D-5: two INDEPENDENT axes. L1 and L2 differ by provenance, not by
  -- verification — both are verified — so the three-value union is preserved
  -- exactly as shipped. Collapsing to asserted|discovered would erase the
  -- L1/L2 distinction the resolver's trust hierarchy depends on.
  assertion_provenance text NOT NULL
    CHECK (assertion_provenance IN ('first-party','curated','discovered')),
  verification_status text NOT NULL DEFAULT 'provisional'
    CHECK (verification_status IN ('provisional','verified')),

  -- D-6, enforced in SQL as it already is in the TypeScript union: confidence
  -- exists ONLY for a discovered assertion. A confidence score on a curated
  -- profile would imply an inference that never ran.
  confidence numeric,

  -- Operational policy, NOT evidence. NULL = use CDR_PRESENTATION_THRESHOLD.
  -- Per-row so a hostname profile and an agent profile can be calibrated
  -- differently without a deployment split.
  presentation_threshold numeric,

  -- The modules this profile ASSERTS are applicable (P4-1). Never an
  -- execution-domain claim.
  capability_modules text[] NOT NULL DEFAULT '{}',

  -- Authority + evidence. jsonb because `verified_by` is a union and evidence
  -- is a list of {type, ref}. T2-safe by construction — see the header.
  verified_by jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale text NOT NULL DEFAULT '',

  -- Lineage back to the discovery candidate this was promoted from. NULL for
  -- an operator-asserted profile that never went through discovery.
  source_candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- D-6 as a table constraint: discovered ⇒ confidence present; otherwise absent.
ALTER TABLE public.domain_profiles
  DROP CONSTRAINT IF EXISTS domain_profiles_confidence_provenance_check;
ALTER TABLE public.domain_profiles
  ADD  CONSTRAINT domain_profiles_confidence_provenance_check
    CHECK (
      (assertion_provenance = 'discovered' AND confidence IS NOT NULL)
      OR (assertion_provenance <> 'discovered' AND confidence IS NULL)
    );

ALTER TABLE public.domain_profiles
  DROP CONSTRAINT IF EXISTS domain_profiles_confidence_range_check;
ALTER TABLE public.domain_profiles
  ADD  CONSTRAINT domain_profiles_confidence_range_check
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

ALTER TABLE public.domain_profiles
  DROP CONSTRAINT IF EXISTS domain_profiles_presentation_threshold_check;
ALTER TABLE public.domain_profiles
  ADD  CONSTRAINT domain_profiles_presentation_threshold_check
    CHECK (presentation_threshold IS NULL OR (presentation_threshold >= 0 AND presentation_threshold <= 1));

-- A verified profile must name its authority and the moment of verification —
-- "verified" with no verifier is an assertion wearing a badge.
ALTER TABLE public.domain_profiles
  DROP CONSTRAINT IF EXISTS domain_profiles_verified_requires_authority_check;
ALTER TABLE public.domain_profiles
  ADD  CONSTRAINT domain_profiles_verified_requires_authority_check
    CHECK (
      verification_status <> 'verified'
      OR (verified_at IS NOT NULL AND verified_by <> '{}'::jsonb)
    );

-- Every module named must be one of the closed union's members (P4). A typo
-- here would silently drop a module at render time.
ALTER TABLE public.domain_profiles
  DROP CONSTRAINT IF EXISTS domain_profiles_capability_modules_check;
ALTER TABLE public.domain_profiles
  ADD  CONSTRAINT domain_profiles_capability_modules_check
    CHECK (capability_modules <@ ARRAY[
      'financial-intelligence',
      'investment-operations',
      'market-operations',
      'constitutional-financial-integrity',
      'constitutional-commerce'
    ]::text[]);

-- One profile per subject. Two rows for the same subject would be two answers
-- to the same question — the defect the whole registry exists to prevent.
CREATE UNIQUE INDEX IF NOT EXISTS domain_profiles_subject_uniq
  ON public.domain_profiles (subject_type, lower(subject_id));

-- The runtime's read path: resolve a subject, verified rows first.
CREATE INDEX IF NOT EXISTS domain_profiles_resolution_idx
  ON public.domain_profiles (subject_type, verification_status, updated_at DESC);

-- Alias lookup without a sequential scan.
CREATE INDEX IF NOT EXISTS domain_profiles_aliases_idx
  ON public.domain_profiles USING gin (aliases);

CREATE INDEX IF NOT EXISTS domain_profiles_source_candidate_idx
  ON public.domain_profiles (source_candidate_id);

-- ---------------------------------------------------------------------------
-- 3. Presentation / abstention instrumentation (§6.3 — "the abstention rate is
--    a metric to publish, not a defect to minimise").
--
-- Records the threshold ACTUALLY APPLIED, so calibration stays possible after
-- the profile value or the environment default changes. Without that column,
-- a later threshold change makes every historical event uninterpretable.
--
-- Deliberately carries NO citizen identifier. This measures how often the
-- system stayed silent, not who it stayed silent at.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.domain_profile_presentation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.domain_profiles(id) ON DELETE CASCADE,

  -- Denormalised so aggregation needs no join and stays correct even if the
  -- profile is later amended. Neither is an identifier.
  subject_type text NOT NULL,
  resolution_level text NOT NULL CHECK (resolution_level IN ('L1','L2','L3','L4')),

  -- The two numbers, side by side, as they stood at decision time.
  confidence numeric,
  applied_presentation_threshold numeric,

  --   offered           — the hedged contextual offer was shown
  --   silent_abstention — below threshold; nothing was shown (the metric that
  --                       would otherwise be invisible)
  --   viewed            — the citizen opened the offered context
  --   dismissed         — the citizen dismissed it
  outcome text NOT NULL
    CHECK (outcome IN ('offered','silent_abstention','viewed','dismissed')),

  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS domain_profile_presentation_events_profile_idx
  ON public.domain_profile_presentation_events (profile_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS domain_profile_presentation_events_rate_idx
  ON public.domain_profile_presentation_events (outcome, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Access posture — service-role only, matching every sibling table.
-- ---------------------------------------------------------------------------

ALTER TABLE public.domain_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_profile_presentation_events ENABLE ROW LEVEL SECURITY;
