-- ============================================================================
-- myworkspace_entries — PRIVATE work-artifact surface (sibling of
-- mycanvas_entries, separate table for clean demarcation).
--
-- Phase: Aigent Me Phase 4 — myArtifacts restructure (2026-05-30).
--
-- Operator-driven rationale: cohabiting canvas (public-publishable
-- experiences) and workspace (private work artifacts) in a single
-- mycanvas_entries table proved too leaky — entries created without an
-- explicit `meta_json.surface` stamp default to canvas and surface in
-- the wrong tab. Splitting to a dedicated table gives strict separation
-- with no JSON-path filter relying on operator-set discriminators.
--
-- Schema mirrors mycanvas_entries exactly (id / persona_id / title /
-- body_md / tags / visibility / entry_type / meta_json / timestamps).
-- Same RLS pattern (service-role-only). Same indices.
--
-- Workflow vs canvas:
--   myCanvas    → mycanvas_entries (this migration does NOT touch)
--   myWorkspace → myworkspace_entries (this migration creates)
--   myLedger    → reads activity_receipts (this migration does NOT touch)
--
-- Data migration at the end moves existing private-stamped rows from
-- mycanvas_entries to the new table so they appear under myWorkspace
-- without operator action. Heuristic: any row whose meta_json carries
-- surface in (workspace, workbench) OR whose entry_type='note' (the
-- legacy default for operator-authored drafts that never published
-- publicly). experience_origin / experience_derived rows STAY in
-- mycanvas_entries since those are remix outputs intended for canvas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.myworkspace_entries (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id   text NOT NULL,
  title        text NOT NULL,
  body_md      text NOT NULL DEFAULT '',
  tags         text[] NOT NULL DEFAULT '{}',
  visibility   text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','invited')),
  entry_type   text NOT NULL DEFAULT 'note'
    CHECK (entry_type IN ('note', 'experience_origin', 'experience_derived')),
  meta_json    jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_myworkspace_entries_persona
  ON public.myworkspace_entries(persona_id);
CREATE INDEX IF NOT EXISTS idx_myworkspace_entries_created_at
  ON public.myworkspace_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_myworkspace_entries_type
  ON public.myworkspace_entries(persona_id, entry_type);

ALTER TABLE public.myworkspace_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "myworkspace_entries_read_service"  ON public.myworkspace_entries;
DROP POLICY IF EXISTS "myworkspace_entries_write_service" ON public.myworkspace_entries;
CREATE POLICY "myworkspace_entries_read_service"  ON public.myworkspace_entries FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "myworkspace_entries_write_service" ON public.myworkspace_entries FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.myworkspace_entries IS
  'Private work-artifact entries for the myWorkspace surface. Sibling of mycanvas_entries with strict separation — no shared discriminator.';

-- ─── Data migration: move legacy private-stamped rows ──────────────────────
-- Idempotent — uses INSERT ... ON CONFLICT and only DELETEs rows that
-- successfully moved. Safe to re-run.

WITH moved AS (
  INSERT INTO public.myworkspace_entries (
    id, persona_id, title, body_md, tags, visibility, entry_type, meta_json,
    created_at, updated_at
  )
  SELECT
    id, persona_id, title, body_md, tags, visibility, entry_type, meta_json,
    created_at, updated_at
  FROM public.mycanvas_entries
  WHERE (
    meta_json->>'surface' IN ('workspace', 'workbench')
    OR (
      entry_type = 'note'
      AND (meta_json->>'surface' IS NULL OR meta_json->>'surface' = '')
    )
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
DELETE FROM public.mycanvas_entries
WHERE id IN (SELECT id FROM moved);

-- Sanity report — non-fatal; inspect after the migration runs.
SELECT
  (SELECT COUNT(*) FROM public.mycanvas_entries)    AS mycanvas_remaining,
  (SELECT COUNT(*) FROM public.myworkspace_entries) AS myworkspace_total;
