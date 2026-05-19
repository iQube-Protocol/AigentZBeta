-- ============================================================================
-- mycanvas_entries + mycanvas_invites — personal publishing surface.
--
-- Phase: Aigent Me Phase 4 — Activations · myCanvas.
--
-- myCanvas is the user's private publishing surface inside the metaMe
-- runtime. Used for works-in-progress, private musings, draft ideas the
-- user may or may not share publicly later.
--
-- Visibility:
--   - 'private' — only the owning persona can read.
--   - 'invited' — additional personas listed in mycanvas_invites.
--   (Public sharing happens by republishing into a community surface; we
--   don't add a 'public' visibility here.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mycanvas_entries (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id   text NOT NULL,
  title        text NOT NULL,
  body_md      text NOT NULL DEFAULT '',
  tags         text[] NOT NULL DEFAULT '{}',
  visibility   text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private','invited')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mycanvas_entries_persona     ON public.mycanvas_entries(persona_id);
CREATE INDEX IF NOT EXISTS idx_mycanvas_entries_created_at  ON public.mycanvas_entries(created_at DESC);

ALTER TABLE public.mycanvas_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mycanvas_entries_read_service"  ON public.mycanvas_entries;
DROP POLICY IF EXISTS "mycanvas_entries_write_service" ON public.mycanvas_entries;
CREATE POLICY "mycanvas_entries_read_service"  ON public.mycanvas_entries FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "mycanvas_entries_write_service" ON public.mycanvas_entries FOR ALL    USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.mycanvas_invites (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id            uuid NOT NULL REFERENCES public.mycanvas_entries(id) ON DELETE CASCADE,
  invited_persona_id  text NOT NULL,
  role                text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','commenter')),
  invited_at          timestamptz NOT NULL DEFAULT now(),
  accepted_at         timestamptz,
  UNIQUE (entry_id, invited_persona_id)
);

CREATE INDEX IF NOT EXISTS idx_mycanvas_invites_entry            ON public.mycanvas_invites(entry_id);
CREATE INDEX IF NOT EXISTS idx_mycanvas_invites_invited_persona  ON public.mycanvas_invites(invited_persona_id);

ALTER TABLE public.mycanvas_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mycanvas_invites_read_service"  ON public.mycanvas_invites;
DROP POLICY IF EXISTS "mycanvas_invites_write_service" ON public.mycanvas_invites;
CREATE POLICY "mycanvas_invites_read_service"  ON public.mycanvas_invites FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY "mycanvas_invites_write_service" ON public.mycanvas_invites FOR ALL    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.mycanvas_entries IS
  'Per-persona private publishing surface inside metaMe runtime. PRD §11.c myCanvas.';
COMMENT ON COLUMN public.mycanvas_entries.persona_id IS 'T0 — owner. Never serialise.';
COMMENT ON TABLE public.mycanvas_invites IS
  'Stub for cross-persona invites to specific canvas entries. Real invite-acceptance flow lands later.';
