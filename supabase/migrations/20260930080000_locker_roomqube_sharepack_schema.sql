-- 20260930080000_locker_roomqube_sharepack_schema.sql
--
-- Locker, RoomQubes and Share Packs — Phase 1 schema foundation.
-- codexes/packs/agentiq/updates/2026-08-25_locker-roomqube-sharepacks-phase1.md
--
-- INTEGRATION NOTE: authored in an isolated worktree whose git history
-- predated the QubeTalk Communications Membrane (20260930040000) and
-- ContactGraph (20260930050000/060000) substrate — that worktree carried a
-- byte-for-byte compat shim (20260930055000_qubetalk_group_conversation_compat.sql)
-- recreating a MINIMAL qubetalk_groups/qubetalk_conversations subset so it
-- could build standalone. On this real branch those tables already exist
-- in full (with more columns — e.g. qubetalk_conversations.origin_engagement_id,
-- qubetalk_group_memberships.participant_id) via the real migrations, so
-- the compat shim was deleted rather than applied — every
-- CREATE TABLE IF NOT EXISTS below involving those two tables is
-- consequently a no-op; this migration's own new tables (asset_records,
-- roomqubes, etc.) are what actually apply. Renumbered from 20260930060000
-- (that slot was already taken by 20260930060000_qubetalk_contact_endpoint_exact_bridge.sql
-- on this branch) to 20260930080000, the next free slot after this
-- session's own 20260930070000_qubetalk_publication_execution.sql.
--
-- REUSE AUDIT SUMMARY (full matrix in the closeout doc above):
--   - content_qubes (20260513010000_content_qubes_schema.sql) is the
--     existing federated-content-reference pattern this schema's shape
--     directly mirrors (unified object + storage/rendition rows keyed by
--     FK, not a blob column) — asset_records/asset_renditions follow the
--     SAME split (content_qubes / content_qube_storage), deliberately, so
--     the two registries read the same way to anyone who already knows one.
--   - activity_receipts (20260514000000_activity_receipts.sql) is reused
--     as-is for every Locker/RoomQube/SharePack event — no new receipts
--     table. See the companion migration
--     20260930090000_activity_receipts_locker_action_types.sql (regenerated
--     against this branch's real, current action-type list — the
--     worktree's own version was built against its much shorter 9-type
--     stale baseline and would have wiped ~160 real types if applied
--     as-is), which is the ONE permitted unilateral action-type-union
--     extension per CLAUDE.md's DVN Pipeline Protection section.
--   - RoomQube's QubeTalk conversation context is a real FK into
--     qubetalk_groups / qubetalk_conversations — the SAME GroupQube/
--     ConversationQube tables the QubeTalk Communications Membrane
--     introduced. RoomQube does NOT get its own messaging table — spec
--     §9.1 forbids it outright.
--   - Membership resolution reuses `personas` directly (subject_persona_id
--     uuid REFERENCES personas(id)) — the same server-side
--     handle-to-persona-id resolution pattern already live in
--     app/api/mycanvas/entries/[id]/invite/route.ts. A full ContactGraph-
--     backed resolution path (contact_persons/contact_personas/
--     contact_endpoints) is NOT available in this worktree (see closeout
--     §0/§Deferred) and is deferred to Phase 2 integration.
--
-- All statements additive/idempotent (CREATE TABLE IF NOT EXISTS, ADD
-- COLUMN IF NOT EXISTS) per this repo's migration-safety convention. RLS is
-- deny-all + service-role-only on every new table, matching
-- 20260513010000_content_qubes_schema.sql / 20260514000000_activity_receipts.sql.
--
-- T0/T1/T2 note: owner_persona_id / added_by_persona_id / invited_by_persona_id
-- / subject_persona_id / approved_by_persona_id are T0 (server-internal,
-- raw persona UUID) — service-role RLS only, never returned to the browser
-- as-is by any route (routes return them only to the OWNING caller's own
-- self-view, mirroring the "owner self-view exception" in CLAUDE.md's
-- Identity & Access Spine section). recipient_refs on share_packs are plain
-- email addresses for the Phase 1 email channel — not persona identifiers.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. asset_records — the normalized federated asset registry (spec §7.1).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.asset_records (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                   text        NOT NULL,
  description             text,

  asset_class             text        NOT NULL CHECK (asset_class IN (
    'deck', 'agreement', 'report', 'paper', 'essay', 'experiment', 'dataset',
    'image', 'audio', 'video', 'bridge', 'dynamic-report', 'other'
  )),

  -- Federated home (spec §6). 'locker' = Locker-native (Phase 1 focus).
  -- The other values are schema-ready for Phase 2 resolver adapters but
  -- are not resolved by any service code in this pass — see closeout.
  native_system           text        NOT NULL DEFAULT 'locker' CHECK (native_system IN (
    'locker', 'qriptopian', 'codex', 'irl', 'bridge', 'venture-workspace', 'external'
  )),
  native_reference        jsonb       NOT NULL DEFAULT '{}',

  venture_id              text,
  project_id              text,

  -- T0 — server-internal only. Never serialised except in the owner's own
  -- self-view response.
  owner_persona_id        uuid        NOT NULL,
  owning_organization_ref text,

  lifecycle_status        text        NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN (
    'draft', 'review', 'approved', 'current', 'superseded', 'archived'
  )),
  sharing_status          text        NOT NULL DEFAULT 'private' CHECK (sharing_status IN (
    'private', 'internal', 'confidential', 'approved-to-share', 'public'
  )),
  sensitivity             text        CHECK (sensitivity IS NULL OR sensitivity IN (
    'standard', 'commercial', 'financial', 'legal', 'personal', 'restricted'
  )),

  aliases                 text[]      NOT NULL DEFAULT '{}',
  tags                    text[]      NOT NULL DEFAULT '{}',

  -- Version family (spec §9.5/§13). A brand-new asset gets a fresh
  -- version_family_id (application-generated, equal to a value shared by
  -- every version in the family — never equal to any one row's own id, so
  -- "which row is this" and "which family is this" never collide).
  -- version_number is 1-based within the family. supersedes_asset_id links
  -- a new version row back at the exact prior-current row it replaced —
  -- set once at creation, never rewritten (spec §9.5: "must not rewrite
  -- historical Share Packs").
  version_family_id       uuid        NOT NULL,
  version_number          integer     NOT NULL DEFAULT 1 CHECK (version_number >= 1),
  supersedes_asset_id     uuid        REFERENCES public.asset_records (id),

  content_hash            text,
  original_filename       text,
  provenance              jsonb       NOT NULL DEFAULT '{}',

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT asset_records_family_version_unique UNIQUE (version_family_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_asset_records_owner        ON public.asset_records (owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_asset_records_family        ON public.asset_records (version_family_id);
CREATE INDEX IF NOT EXISTS idx_asset_records_lifecycle      ON public.asset_records (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_asset_records_sharing        ON public.asset_records (sharing_status);
CREATE INDEX IF NOT EXISTS idx_asset_records_content_hash   ON public.asset_records (content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_records_venture        ON public.asset_records (venture_id) WHERE venture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_records_native_system  ON public.asset_records (native_system);

ALTER TABLE public.asset_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asset_records_service_role" ON public.asset_records;
CREATE POLICY "asset_records_service_role" ON public.asset_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.asset_records IS
  'Locker federated asset registry (spec §7.1). Mirrors content_qubes'' unified-object + linked-rows shape. native_system=locker is the only Phase-1-resolved value.';
COMMENT ON COLUMN public.asset_records.owner_persona_id IS 'T0 — server-internal only, never returned except in owner self-view.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. asset_renditions — usable representations of an asset (spec §5.3).
--    Mirrors content_qube_storage's shape (one row per storage/rendition,
--    is_primary marks the canonical delivery path).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.asset_renditions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          uuid        NOT NULL REFERENCES public.asset_records (id) ON DELETE CASCADE,

  rendition_kind    text        NOT NULL CHECK (rendition_kind IN (
    'source', 'pdf', 'presentation', 'web', 'audio', 'video', 'cover', 'thumbnail', 'download', 'other'
  )),

  -- Per CLAUDE.md's Dense Materials rule: storage_provider names WHERE the
  -- bytes live (Supabase Storage for working/served assets, autonomys for
  -- canonical/frozen provenance-bearing artifacts) — the repo never carries
  -- the bytes itself.
  storage_provider  text        NOT NULL DEFAULT 'supabase' CHECK (storage_provider IN (
    'supabase', 'autonomys', 'ipfs', 'external'
  )),
  storage_uri       text        NOT NULL,
  public_url        text,
  mime_type         text,
  size_bytes        bigint,
  content_hash      text,
  is_primary        boolean     NOT NULL DEFAULT false,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_renditions_asset   ON public.asset_renditions (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_renditions_primary ON public.asset_renditions (asset_id, is_primary);

ALTER TABLE public.asset_renditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "asset_renditions_service_role" ON public.asset_renditions;
CREATE POLICY "asset_renditions_service_role" ON public.asset_renditions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. roomqubes — governed, private, shareable sub-Locker surfaces
--    (spec §5.5/§7.3). ONE primitive for every room type (§11.1) — no
--    bespoke Data Room object.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.roomqubes (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                     text        NOT NULL,
  purpose                   text        NOT NULL DEFAULT '',

  room_type                 text        NOT NULL CHECK (room_type IN (
    'data-room', 'research-room', 'project-room', 'partner-room',
    'board-room', 'briefing-room', 'cohort-room', 'custom'
  )),

  venture_id                text,
  -- T0 — server-internal only.
  owner_persona_id          uuid        NOT NULL,
  intended_audience         text,
  default_access_policy     jsonb       NOT NULL DEFAULT '{}',

  -- QubeTalk conversation context (spec §7.3 qubeTalkContext, §11.5, §9.1).
  -- Real FKs into the QubeTalk Communications Membrane's GroupQube /
  -- ConversationQube tables — never a parallel messaging mechanism.
  qubetalk_group_id         uuid        REFERENCES public.qubetalk_groups (id) ON DELETE SET NULL,
  qubetalk_conversation_id  uuid        REFERENCES public.qubetalk_conversations (id) ON DELETE SET NULL,
  qubetalk_mode             text        NOT NULL DEFAULT 'room-thread' CHECK (qubetalk_mode IN ('room-thread', 'topic-channel')),
  notifications_enabled     boolean     NOT NULL DEFAULT true,

  status                    text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roomqubes_owner   ON public.roomqubes (owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_roomqubes_venture ON public.roomqubes (venture_id) WHERE venture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roomqubes_status  ON public.roomqubes (status);
CREATE INDEX IF NOT EXISTS idx_roomqubes_type    ON public.roomqubes (room_type);

ALTER TABLE public.roomqubes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roomqubes_service_role" ON public.roomqubes;
CREATE POLICY "roomqubes_service_role" ON public.roomqubes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.roomqubes IS
  'Governed private sub-Locker surface (spec §5.5). One primitive for data-room/research-room/partner-room/etc — never a bespoke per-type object.';

-- ═══════════════════════════════════════════════════════════════════════
-- 4. roomqube_placements — curated manifest entries (spec §7.2). A
--    placement, never a copy — removing one never deletes the asset.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.roomqube_placements (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  roomqube_id              uuid        NOT NULL REFERENCES public.roomqubes (id) ON DELETE CASCADE,
  asset_id                 uuid        NOT NULL REFERENCES public.asset_records (id) ON DELETE CASCADE,

  label_override           text,
  description_override     text,
  preferred_rendition_id   uuid        REFERENCES public.asset_renditions (id),

  -- spec §4.5 "follow current in rooms; pin at communication" — a
  -- placement itself may ALSO pin (spec §7.2 versionPolicy), e.g. "follow
  -- current deck, pin this specific experiment report" (acceptance #15).
  version_policy_mode      text        NOT NULL DEFAULT 'follow-current' CHECK (version_policy_mode IN ('follow-current', 'pinned')),
  pinned_version_asset_id  uuid        REFERENCES public.asset_records (id),

  section                  text,
  display_order            integer     NOT NULL DEFAULT 0,

  -- T0 — server-internal only.
  added_by_persona_id      uuid        NOT NULL,
  added_at                 timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT roomqube_placements_unique UNIQUE (roomqube_id, asset_id),
  CONSTRAINT roomqube_placements_pin_requires_mode CHECK (
    (version_policy_mode = 'pinned' AND pinned_version_asset_id IS NOT NULL) OR
    (version_policy_mode = 'follow-current' AND pinned_version_asset_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_roomqube_placements_room  ON public.roomqube_placements (roomqube_id);
CREATE INDEX IF NOT EXISTS idx_roomqube_placements_asset ON public.roomqube_placements (asset_id);

ALTER TABLE public.roomqube_placements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roomqube_placements_service_role" ON public.roomqube_placements;
CREATE POLICY "roomqube_placements_service_role" ON public.roomqube_placements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. roomqube_members — individual/group/agent membership (spec §7.3,
--    §11.4). Personhood-anchored where the subject is a person: FKs
--    directly to personas, resolved server-side from a T1 handle exactly
--    like app/api/mycanvas/entries/[id]/invite/route.ts already does — no
--    new resolver, no ContactGraph fork.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.roomqube_members (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  roomqube_id           uuid        NOT NULL REFERENCES public.roomqubes (id) ON DELETE CASCADE,

  subject_type          text        NOT NULL CHECK (subject_type IN ('person', 'group', 'agent')),
  -- Exactly one of these is set, matching subject_type.
  subject_persona_id    uuid        REFERENCES public.personas (id),
  subject_group_ref     text,

  role                  text        NOT NULL CHECK (role IN ('owner', 'administrator', 'contributor', 'reviewer', 'viewer', 'guest')),

  -- T0 — server-internal only.
  invited_by_persona_id uuid        NOT NULL,
  joined_at             timestamptz,
  expires_at            timestamptz,
  removed_at            timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT roomqube_members_subject_shape CHECK (
    (subject_type = 'person' AND subject_persona_id IS NOT NULL AND subject_group_ref IS NULL) OR
    (subject_type IN ('group', 'agent') AND subject_group_ref IS NOT NULL AND subject_persona_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roomqube_members_room_person_uidx
  ON public.roomqube_members (roomqube_id, subject_persona_id) WHERE subject_persona_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_roomqube_members_room  ON public.roomqube_members (roomqube_id);
CREATE INDEX IF NOT EXISTS idx_roomqube_members_active ON public.roomqube_members (roomqube_id) WHERE removed_at IS NULL;

ALTER TABLE public.roomqube_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roomqube_members_service_role" ON public.roomqube_members;
CREATE POLICY "roomqube_members_service_role" ON public.roomqube_members
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. share_packs / share_pack_items — recipient/purpose-specific delivery
--    manifests (spec §5.6/§7.4/§14). Phase 1 delivery channel: email only
--    (existing Mailjet infrastructure) — 'qubetalk'/'link'/'other' are
--    schema-ready but not service-resolved this pass.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.share_packs (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                     text        NOT NULL,
  purpose                   text        NOT NULL DEFAULT '',

  -- T0 — server-internal only.
  owner_persona_id          uuid        NOT NULL,

  -- Phase 1: plain recipient email addresses (email delivery channel).
  -- Never a persona identifier — recipients need not be platform personas.
  recipient_refs            text[]      NOT NULL DEFAULT '{}',
  source_roomqube_ids       uuid[]      NOT NULL DEFAULT '{}',

  delivery_channel          text        NOT NULL DEFAULT 'email' CHECK (delivery_channel IN ('email', 'qubetalk', 'link', 'other')),
  message_draft             text,
  access_policy             jsonb       NOT NULL DEFAULT '{}',

  authorization_state       text        NOT NULL DEFAULT 'draft' CHECK (authorization_state IN (
    'draft', 'proposed', 'approved', 'sent', 'revoked', 'expired'
  )),
  -- T0 — server-internal only.
  approved_by_persona_id    uuid,
  approved_at               timestamptz,
  -- References activity_receipts.id (spec §14.4) — no FK constraint since
  -- activity_receipts.id is only unique per its own table and this column
  -- is set after the receipt is created (avoids ordering coupling with the
  -- receipt-writer transaction).
  communication_receipt_id  uuid,

  created_at                timestamptz NOT NULL DEFAULT now(),
  sent_at                   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_share_packs_owner ON public.share_packs (owner_persona_id);
CREATE INDEX IF NOT EXISTS idx_share_packs_state ON public.share_packs (authorization_state);

ALTER TABLE public.share_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "share_packs_service_role" ON public.share_packs;
CREATE POLICY "share_packs_service_role" ON public.share_packs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.share_pack_items (
  id                       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  share_pack_id            uuid    NOT NULL REFERENCES public.share_packs (id) ON DELETE CASCADE,
  asset_id                 uuid    NOT NULL REFERENCES public.asset_records (id),

  -- Resolved + pinned at approval time (spec §14.3) — NULL while the pack
  -- is still draft/proposed and following current.
  pinned_version_asset_id  uuid    REFERENCES public.asset_records (id),
  rendition_id             uuid    REFERENCES public.asset_renditions (id),

  delivery_mode            text    NOT NULL DEFAULT 'link' CHECK (delivery_mode IN ('link', 'attachment', 'embedded')),
  resolved_hash            text,
  display_order            integer NOT NULL DEFAULT 0,

  -- Governed-link token (spec §15.3: expiry/revocation/named-recipient
  -- access, "links by default" §4.7). A recipient dereferences
  -- /api/locker/share/[token] rather than ever receiving a raw storage URL
  -- — mirrors the existing gated-content proxy discipline (CLAUDE.md
  -- "Gated Content" section) applied to Share Pack delivery.
  access_token             uuid    NOT NULL DEFAULT gen_random_uuid(),

  CONSTRAINT share_pack_items_unique UNIQUE (share_pack_id, asset_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_share_pack_items_token ON public.share_pack_items (access_token);
CREATE INDEX IF NOT EXISTS idx_share_pack_items_pack  ON public.share_pack_items (share_pack_id);
CREATE INDEX IF NOT EXISTS idx_share_pack_items_asset ON public.share_pack_items (asset_id);

ALTER TABLE public.share_pack_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "share_pack_items_service_role" ON public.share_pack_items;
CREATE POLICY "share_pack_items_service_role" ON public.share_pack_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.share_packs IS
  'Recipient/purpose-specific delivery manifest (spec §5.6/§7.4). Phase 1 delivery channel: email only, via the existing Mailjet REST integration.';
