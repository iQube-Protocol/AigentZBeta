-- ============================================================================
-- myCartridge Phase 4a — config + roles DB foundation
--
-- PRD: codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md §23, §26
-- Phase plan ref: §32 Phase 4 ("config + roles") + §33 row 4
--
-- This migration lands the schema-side foundation for myCartridge:
--   - cartridge_memberships  — (slug, persona, role) join table
--   - cartridge_activations  — Activation Catalogue entries (defaults
--                              status='pending'; flips to 'approved' via
--                              the Phase 11 §21a flow)
--   - cartridge_codex_entries — per-cartridge published Codex rows
--   - codex_configs columns   — owner_persona_id, primary_tab_slug,
--                              available_specialists, token_whitelist,
--                              smart_triad_config
--   - codex_tabs columns      — member_only, invite_only, token_gated,
--                              role_required
--
-- The approvals table (`cartridge_activation_approvals`) is intentionally
-- NOT created here — it lands in Phase 11 alongside the
-- AdminActiveSurfaceApprovalsTab UI and the approval API routes (§32 Phase
-- 11 / §33 row 11).
--
-- The KB sources table (`cartridge_kb_sources`) is also intentionally NOT
-- created here — it's a v0.5 surface (per-cartridge KB embedding pipeline
-- isn't on the MVP scope) and is mentioned in §26 as deferred.
--
-- Privacy posture
-- ---------------
--   - persona_id and granted_by are T0 — server-internal only. The
--     spine resolves cartridge memberships via getActivePersona; the
--     browser only ever sees role-as-flag, not the persona id.
--   - Service-role only policies on the new tables. Reads land via
--     spine-gated routes (Phase 4b: extend getActivePersona +
--     evaluateAccess; Phase 7: cartridge admin surface).
--
-- Idempotency
-- -----------
--   Everything uses IF NOT EXISTS so re-running is safe.
-- ============================================================================

-- ─── cartridge_memberships ──────────────────────────────────────────────────
-- The (cartridge_slug, persona_id, role) join. One row per persona-role
-- assignment per cartridge. PK is composite (slug, persona) — a persona
-- holds at most one role per cartridge; promote/demote via UPDATE not
-- INSERT.

CREATE TABLE IF NOT EXISTS public.cartridge_memberships (
  cartridge_slug  text NOT NULL,
  persona_id      text NOT NULL,
  role            text NOT NULL
    CHECK (role IN (
      'owner',
      'admin',
      'editor',
      'contributor',
      'member',
      'partner',
      'franchisee',
      'correspondent',
      'guest'
    )),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  granted_by      text,
  -- Free-form audit context: invite source, batch id, etc.
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (cartridge_slug, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_cartridge_memberships_persona
  ON public.cartridge_memberships(persona_id);
CREATE INDEX IF NOT EXISTS idx_cartridge_memberships_role
  ON public.cartridge_memberships(role);

ALTER TABLE public.cartridge_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cartridge_memberships_read_service"  ON public.cartridge_memberships;
DROP POLICY IF EXISTS "cartridge_memberships_write_service" ON public.cartridge_memberships;
CREATE POLICY "cartridge_memberships_read_service"  ON public.cartridge_memberships FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cartridge_memberships_write_service" ON public.cartridge_memberships FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.cartridge_memberships IS
  'Per-cartridge persona role assignments. Service-role only — all reads land via the spine (getActivePersona.cartridgeMemberships) or admin routes. See PRD §23.';
COMMENT ON COLUMN public.cartridge_memberships.persona_id IS
  'T0 — server-internal only. The spine projects to role-flag at the boundary.';
COMMENT ON COLUMN public.cartridge_memberships.granted_by IS
  'T0 audit field — persona who granted the role. Never exposed to the browser.';


-- ─── cartridge_activations ──────────────────────────────────────────────────
-- One row per active tab registered in the Activations Catalogue. A
-- cartridge can register multiple tabs as active surfaces; status moves
-- from 'pending' → 'approved' / 'rejected' via the §21a Phase 11 flow.

CREATE TABLE IF NOT EXISTS public.cartridge_activations (
  catalog_id      text PRIMARY KEY,
  cartridge_slug  text NOT NULL,
  tab_slug        text NOT NULL,
  -- Active tab pattern from PRD §20. 'metrics-actions' is the canonical
  -- Active surface; 'metrics-only' / 'actions-only' are conservative
  -- subsets for lower-trust cartridges.
  mode            text NOT NULL DEFAULT 'metrics-actions'
    CHECK (mode IN ('metrics-actions', 'metrics-only', 'actions-only')),
  metrics_json    jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions_json    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Activation gating per PRD §21a. MVP enforces 'pending_metame' →
  -- 'approved' transition only; Registry + Studio stages typed but
  -- auto-approved (CARTRIDGE_APPROVAL_STAGES = 'metame-only').
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'pending_registry',
      'pending_studio',
      'pending_metame',
      'approved',
      'rejected',
      'archived'
    )),
  visibility      text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'invite-only', 'member-only')),
  -- The submitting persona (T0). Spine-resolved at submission time;
  -- never echoed to the browser.
  submitted_by    text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  approved_at     timestamptz,
  rejected_at     timestamptz,
  -- Free-form context: rubric scoring, automated pre-check results,
  -- migration provenance.
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cartridge_slug, tab_slug)
);

CREATE INDEX IF NOT EXISTS idx_cartridge_activations_cartridge
  ON public.cartridge_activations(cartridge_slug);
CREATE INDEX IF NOT EXISTS idx_cartridge_activations_status
  ON public.cartridge_activations(status);

ALTER TABLE public.cartridge_activations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cartridge_activations_read_service"  ON public.cartridge_activations;
DROP POLICY IF EXISTS "cartridge_activations_write_service" ON public.cartridge_activations;
CREATE POLICY "cartridge_activations_read_service"  ON public.cartridge_activations FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cartridge_activations_write_service" ON public.cartridge_activations FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.cartridge_activations IS
  'Activation Catalogue entries (one per active tab). status flips from pending → approved only via the §21a Phase 11 approval chain. See PRD §20 + §21a.';
COMMENT ON COLUMN public.cartridge_activations.status IS
  'MVP enforces the pending_metame → approved transition only. Registry + Studio stages typed but auto-approved (CARTRIDGE_APPROVAL_STAGES = ''metame-only'').';
COMMENT ON COLUMN public.cartridge_activations.submitted_by IS
  'T0 — server-internal only. Never exposed to the browser.';


-- ─── cartridge_codex_entries ────────────────────────────────────────────────
-- Per-cartridge published Codex rows. Sourced from myCanvas / myWorkspace
-- via the `publish-to-cartridge` action (PRD §25). MVP shape is simple
-- markdown; v0.5 will add the "mint as ContentQube" action.

CREATE TABLE IF NOT EXISTS public.cartridge_codex_entries (
  entry_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_slug  text NOT NULL,
  title           text NOT NULL,
  body_md         text NOT NULL DEFAULT '',
  -- Publication state — drafts can be edited; published is locked
  -- (or moved through a state-change receipt per §30).
  status          text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived')),
  -- Where this entry originated. 'mycanvas' / 'myworkspace' rows
  -- preserve the source_id so the publisher can backtrack to the
  -- original draft.
  source          text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'mycanvas', 'myworkspace', 'admin-import')),
  source_id       text,
  -- The publishing persona (T0). Spine-resolved at write time.
  published_by    text,
  published_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cartridge_codex_entries_cartridge
  ON public.cartridge_codex_entries(cartridge_slug);
CREATE INDEX IF NOT EXISTS idx_cartridge_codex_entries_status
  ON public.cartridge_codex_entries(status);
CREATE INDEX IF NOT EXISTS idx_cartridge_codex_entries_source
  ON public.cartridge_codex_entries(source, source_id);

ALTER TABLE public.cartridge_codex_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cartridge_codex_entries_read_service"  ON public.cartridge_codex_entries;
DROP POLICY IF EXISTS "cartridge_codex_entries_write_service" ON public.cartridge_codex_entries;
CREATE POLICY "cartridge_codex_entries_read_service"  ON public.cartridge_codex_entries FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "cartridge_codex_entries_write_service" ON public.cartridge_codex_entries FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.cartridge_codex_entries IS
  'Per-cartridge published Codex rows. Sourced from myCanvas / myWorkspace via the publish-to-cartridge action. See PRD §18 + §25.';


-- ─── codex_configs column extensions ───────────────────────────────────────
-- Per PRD §26: add owner_persona_id, primary_tab_slug, available_specialists,
-- token_whitelist, smart_triad_config. All nullable to preserve existing
-- hand-curated cartridges (they continue to function with NULL until the
-- operator runs the wizard).

ALTER TABLE public.codex_configs
  ADD COLUMN IF NOT EXISTS owner_persona_id      text,
  ADD COLUMN IF NOT EXISTS primary_tab_slug      text,
  ADD COLUMN IF NOT EXISTS available_specialists text[],
  ADD COLUMN IF NOT EXISTS token_whitelist       text[],
  ADD COLUMN IF NOT EXISTS smart_triad_config    jsonb;

CREATE INDEX IF NOT EXISTS idx_codex_configs_owner_persona
  ON public.codex_configs(owner_persona_id);

COMMENT ON COLUMN public.codex_configs.owner_persona_id IS
  'T0 — server-internal only. The owning persona for a wizard-created cartridge. NULL for hand-curated cartridges in CODEX_DEFINITIONS.';
COMMENT ON COLUMN public.codex_configs.primary_tab_slug IS
  'Default tab the cartridge opens on. NULL falls back to the first ordered tab.';
COMMENT ON COLUMN public.codex_configs.available_specialists IS
  'Subset of SpecialistId enum. NULL = use the category default from PRD §24.';
COMMENT ON COLUMN public.codex_configs.token_whitelist IS
  'Subset of TokenId enum. NULL = wallet feature disabled.';
COMMENT ON COLUMN public.codex_configs.smart_triad_config IS
  'JSONB mirror of the v0.4 myCartridge.smartTriad block. Source-of-truth for cartridge-level Triad config.';


-- ─── codex_tabs column extensions ──────────────────────────────────────────
-- Per PRD §23: add gate flags to the existing codex_tabs schema. All
-- default to permissive (FALSE / NULL) so existing tabs are unaffected.

ALTER TABLE public.codex_tabs
  ADD COLUMN IF NOT EXISTS member_only   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_only   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS token_gated   jsonb,
  ADD COLUMN IF NOT EXISTS role_required text;

CREATE INDEX IF NOT EXISTS idx_codex_tabs_role_required
  ON public.codex_tabs(role_required) WHERE role_required IS NOT NULL;

COMMENT ON COLUMN public.codex_tabs.member_only IS
  'When true, only personas in cartridge_memberships for this codex can see the tab.';
COMMENT ON COLUMN public.codex_tabs.invite_only IS
  'When true, only invite-bearing personas (cartridge_memberships.role IN (''partner'',''member'',''contributor'',...) granted via explicit invite) see the tab.';
COMMENT ON COLUMN public.codex_tabs.token_gated IS
  'Optional { tokenId, minBalance } object. When set, evaluateAccess checks the persona''s token balance via the wallet spine.';
COMMENT ON COLUMN public.codex_tabs.role_required IS
  'When set, requires cartridge_memberships.role >= this role (per PRD §23 hierarchy: owner > admin > editor > contributor > member > partner > franchisee > correspondent > guest).';


-- ─── updated_at trigger reuse ──────────────────────────────────────────────
-- The codex_registry migration already defines update_updated_at_column()
-- as a plpgsql function. Attach it to the new tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'cartridge_activations_set_updated_at'
  ) THEN
    CREATE TRIGGER cartridge_activations_set_updated_at
      BEFORE UPDATE ON public.cartridge_activations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'cartridge_codex_entries_set_updated_at'
  ) THEN
    CREATE TRIGGER cartridge_codex_entries_set_updated_at
      BEFORE UPDATE ON public.cartridge_codex_entries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
