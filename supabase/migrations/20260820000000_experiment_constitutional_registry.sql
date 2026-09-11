-- Experiment / Constitutional / Invariant Registry + Research Backlog
-- (Strand 1 of the operator's four-strand programme, 2026-07-24).
--
-- Operator framing: "this should be able to be updated in the front end...
-- admin gated but stubbed for opening up to cohorts or token gated access."
--
-- Purpose: a permanent, living register for the platform's experimental /
-- constitutional evolution — candidate experiments, candidate constitutional
-- principles, candidate structural invariants, and a research backlog — with
-- status tracking, dependencies, and review history.
--
-- Extend-don't-duplicate discipline (see the charter doc,
-- codexes/packs/irl/foundation/CFS-051_experiment-constitutional-registry.md):
--   - `types/research.ts`'s EXPERIMENT_REGISTRY remains the ratified/shipped
--     experiment list — these tables never fork it. `research_candidate_experiments`
--     is specifically for CANDIDATE research threads not yet a formal EXP-NNN.
--   - `codexes/packs/irl/foundation/canonical-invariants.seed.json` /
--     appendix-a_canonical-invariants.md remain the ratified invariant canon.
--     `research_candidate_invariants` is for pre-canon candidates; promotion
--     into the canon is a separate ratification ceremony this table does not
--     perform automatically (`promoted_invariant_id` records the outcome once
--     a human completes it).
--   - Constitutional principles (candidate, "under review") are a genuinely
--     NEW concept — today principles are only tracked as ratified CFS markdown
--     docs with no pre-ratification stage. `research_candidate_principles`
--     is that new stage.
--
-- T2 discipline: no personaId/authProfileId column anywhere. `review_history`
-- entries carry a `reviewerRef` (sha256 one-way commitment via
-- services/identity/personaReferences.ts::personaPublicRef — the SAME
-- Polity Public Reference derivation the DVN pipeline already uses), never a
-- raw persona id.
--
-- Soft-fail pattern: mirrors services/constitutional/capabilityRegistry.ts —
-- server-side only (service role), gated at the API route by a swappable
-- `canManageRegistry(persona)` helper (today: platform admin; a documented
-- follow-on widens it to a CAS research-lab access grant or a token-gate
-- without touching this schema or the CRUD service).
--
-- No DVN receipts are emitted by this slice (deliberate scope decision,
-- documented in the charter doc) — the append-only `review_history` jsonb
-- array is the audit trail for this register. A follow-on may add
-- `research_registry_item_registered` / `_status_changed` receipt types
-- (mirroring capability_registry's CHECK-constraint-rebuild pattern) once the
-- register has enough real usage to warrant DVN anchoring.

-- ─── Candidate Experiments ───────────────────────────────────────────────
-- Tracks operator-named workstreams / research threads that are not yet a
-- formal EXP-NNN row in EXPERIMENT_REGISTRY (types/research.ts), plus any
-- experiment ideas discovered along the way. `charter_ref` cites the REAL
-- repo doc when one exists (CFS-0xx, CRP-00x, an updates/ doc); null when
-- honestly "candidate, no charter yet".
CREATE TABLE IF NOT EXISTS public.research_candidate_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  family text,
  layer text CHECK (layer IS NULL OR layer IN ('I', 'II', 'III')),
  series_id text,
  hypothesis text NOT NULL,
  -- Real repo path to the charter/spec/update doc this candidate traces to,
  -- when one exists. Null is an honest "candidate, no charter yet" — never
  -- fabricated.
  charter_ref text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'scoped', 'protocol-ratified', 'running', 'evaluated', 'published', 'promoted', 'archived')),
  governing_invariants text[] NOT NULL DEFAULT '{}',
  -- Cross-register refs: 'experiment:<slug>' | 'principle:<slug>' |
  -- 'invariant:<slug>' | 'backlog:<slug>' | a bare EXPERIMENT_REGISTRY id
  -- (e.g. 'EXP-006') when depending on the shipped registry directly.
  depends_on text[] NOT NULL DEFAULT '{}',
  -- Append-only log: [{ reviewerRef, date, note, disposition }, ...]
  review_history jsonb NOT NULL DEFAULT '[]',
  -- Honest provenance note: cites the real source used to seed this row, or
  -- states plainly "candidate, no charter yet".
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_candidate_experiments_status
  ON public.research_candidate_experiments (status);
CREATE INDEX IF NOT EXISTS idx_research_candidate_experiments_created
  ON public.research_candidate_experiments (created_at DESC);

ALTER TABLE public.research_candidate_experiments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS research_candidate_experiments_service_all ON public.research_candidate_experiments;
CREATE POLICY research_candidate_experiments_service_all ON public.research_candidate_experiments
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─── Candidate Constitutional Principles ────────────────────────────────
-- A candidate principle "under review" before it becomes a ratified CFS
-- charter. Mirrors the Hypothesis vs Canon discipline (CLAUDE.md): a
-- principle NEVER enters as 'ratified' by assertion — only by a real
-- ratification event the operator/steward records here.
CREATE TABLE IF NOT EXISTS public.research_candidate_principles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  statement text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'under-review', 'ratified', 'rejected')),
  depends_on text[] NOT NULL DEFAULT '{}',
  review_history jsonb NOT NULL DEFAULT '[]',
  -- Once ratified, the real CFS doc path this principle graduated into.
  charter_ref text,
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_candidate_principles_status
  ON public.research_candidate_principles (status);
CREATE INDEX IF NOT EXISTS idx_research_candidate_principles_created
  ON public.research_candidate_principles (created_at DESC);

ALTER TABLE public.research_candidate_principles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS research_candidate_principles_service_all ON public.research_candidate_principles;
CREATE POLICY research_candidate_principles_service_all ON public.research_candidate_principles
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─── Candidate Structural Invariants ─────────────────────────────────────
-- CANDIDATES not yet in the ratified canon
-- (codexes/packs/irl/foundation/canonical-invariants.seed.json /
-- appendix-a_canonical-invariants.md). Promotion path: candidate →
-- proposed-for-canonization → canonized, at which point it graduates into
-- the existing canon file/process (`promoted_invariant_id` records the real
-- inv.* id once that ceremony completes) — this table never replaces that
-- ceremony or writes to the canon file itself.
CREATE TABLE IF NOT EXISTS public.research_candidate_invariants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  -- Mirrors the canon's namespace list (reasoning, constitutional,
  -- engineering, experience, capability, style, narrative, sovereignty,
  -- cybernetics, interaction, epistemology, representation, polity) but is
  -- NOT constrained by CHECK here — a candidate may propose a new namespace,
  -- which is itself part of what review decides.
  namespace text,
  statement text NOT NULL,
  rationale text,
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'proposed-for-canonization', 'canonized', 'rejected')),
  depends_on text[] NOT NULL DEFAULT '{}',
  review_history jsonb NOT NULL DEFAULT '[]',
  -- The real inv.<namespace>.<NNN> id this candidate became, once the
  -- canonization ceremony (outside this table) actually completes.
  promoted_invariant_id text,
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_candidate_invariants_status
  ON public.research_candidate_invariants (status);
CREATE INDEX IF NOT EXISTS idx_research_candidate_invariants_created
  ON public.research_candidate_invariants (created_at DESC);

ALTER TABLE public.research_candidate_invariants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS research_candidate_invariants_service_all ON public.research_candidate_invariants;
CREATE POLICY research_candidate_invariants_service_all ON public.research_candidate_invariants
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ─── Research Backlog ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_backlog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'scoped', 'in-progress', 'done')),
  linked_experiment_ids text[] NOT NULL DEFAULT '{}',
  linked_hypothesis_ids text[] NOT NULL DEFAULT '{}',
  review_history jsonb NOT NULL DEFAULT '[]',
  -- Honest provenance note, same as the three sibling tables above. This
  -- column was MISSING from the original 2026-07-24 authoring of this file
  -- while the seed migration (20260820000100) and the whole TypeScript layer
  -- (types/researchRegistry.ts's BacklogItem.sourceNote, registryStore.ts's
  -- insert + EDITABLE_FIELDS.backlog) all already referenced it — so the
  -- seed failed with `column "source_note" ... does not exist` on the
  -- operator's first real run (2026-07-25). Added here so a FRESH install is
  -- correct; migration 20260821000000 carries the ALTER for databases that
  -- already ran this file before the fix.
  source_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_backlog_items_status
  ON public.research_backlog_items (status);
CREATE INDEX IF NOT EXISTS idx_research_backlog_items_created
  ON public.research_backlog_items (created_at DESC);

ALTER TABLE public.research_backlog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS research_backlog_items_service_all ON public.research_backlog_items;
CREATE POLICY research_backlog_items_service_all ON public.research_backlog_items
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
