-- 20260824000000_experiment_workspace_tracking.sql
--
-- Horizen Workspace, Phase 2 — the common ExperimentWorkspace spine
-- (audit Amendment A §A.5 / Amendment B §B.5).
--
-- THIS TABLE IS THE ONLY NEW STATE THE SPINE INTRODUCES.
--
-- Operator ruling on the actions substrate, 2026-07-27: "Hybrid".
--
--   milestones · blockers   → workspace-local (here). They have no existing
--                             home anywhere in the platform.
--   actions                 → PROJECTED from IntentQubes (nbe_plans).
--   decisions               → PROJECTED from constitutional_agreements.
--   participants            → PROJECTED from participation grants.
--   evidence                → PROJECTED from activity receipts.
--   invariants              → RESOLVED at runtime with provenance.
--
-- The base audit named "a second programme-management system" as the single
-- most likely way this workstream goes wrong. That is why this migration
-- creates ONE table for the two concerns with no home, and why the columns
-- that reach into other systems (`linked_intent_id`, `linked_agreement_id`)
-- are nullable REFERENCES rather than copies of anything.
--
-- T0/T2 discipline: no personaId, authProfileId, rootDid or caseId appears
-- here. Authorship is recorded as a one-way commitment (`created_by_ref`),
-- the same class of value the DVN pipeline and the Constitutional Agreement
-- primitive already use. Service-role access only: RLS enabled with no client
-- policies, matching constitutional_agreements and discovery_candidates.
-- Every statement is additive and idempotent (CFS-010 §3).

CREATE TABLE IF NOT EXISTS public.experiment_workspace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace instance id from the authoritative registry
  -- (services/venture/partnerWorkspace.ts today, e.g. 'horizen-pilot-series-001').
  -- Deliberately text, not a FK: the registry is CODE, not a table, and a FK
  -- to a table that does not exist would force one into being — which is the
  -- second-system defect this whole design avoids.
  workspace_id text NOT NULL,

  -- The two concerns with no existing home. A third value must not be added
  -- here without checking it is not already modelled elsewhere: 'action' and
  -- 'decision' in particular are PROJECTED and must never be written here.
  kind text NOT NULL,

  title text NOT NULL,
  detail text,

  -- Milestones move open → in_progress → done; blockers open → cleared.
  -- One column, because a blocker with a `done` status and a milestone with a
  -- `cleared` status are both nonsense and both caught by the app-level
  -- transition rules rather than by two near-identical columns.
  status text NOT NULL DEFAULT 'open',

  -- Which layer of the ratified agent division of labour owns this, and which
  -- agent id. Both nullable and both text: the layer/owner vocabulary lives in
  -- code (PARTNER_WORKSPACE_LAYERS / PartnerLayerOwnerId), so an enum here
  -- would be a second copy of it.
  layer text,
  owner_agent_id text,

  due_date date,

  -- Reaches into the projected substrate. NULL is the normal case: a milestone
  -- exists before the intent that pursues it. Never a copy of the linked
  -- record — only its id, so the substrate stays authoritative.
  linked_intent_id text,
  linked_agreement_id text,

  -- One-way commitment of the author. NEVER a persona identifier.
  created_by_ref text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experiment_workspace_items
  DROP CONSTRAINT IF EXISTS experiment_workspace_items_kind_check;
ALTER TABLE public.experiment_workspace_items
  ADD CONSTRAINT experiment_workspace_items_kind_check
  CHECK (kind IN ('milestone', 'blocker'));

ALTER TABLE public.experiment_workspace_items
  DROP CONSTRAINT IF EXISTS experiment_workspace_items_status_check;
ALTER TABLE public.experiment_workspace_items
  ADD CONSTRAINT experiment_workspace_items_status_check
  CHECK (status IN ('open', 'in_progress', 'done', 'cleared'));

CREATE INDEX IF NOT EXISTS experiment_workspace_items_workspace_idx
  ON public.experiment_workspace_items (workspace_id, kind, status);

CREATE INDEX IF NOT EXISTS experiment_workspace_items_created_idx
  ON public.experiment_workspace_items (created_at DESC);

ALTER TABLE public.experiment_workspace_items ENABLE ROW LEVEL SECURITY;
