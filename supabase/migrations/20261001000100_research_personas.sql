-- 20261001000100_research_personas.sql
--
-- IRL Stewardship — Research Persona / handle (item 3). A PERSONA-level
-- display layer for the participation relationship — never personhood, never
-- a replacement for KybeDID/RootDID (Person-Persona-iQube Constitutional
-- Interaction Protocol v0.1, codexes/packs/agentiq/updates/
-- 2026-09-11_person-persona-iqube-constitutional-protocol-v0.1.md). One row
-- per persona_id: a persona's research-facing handle is stable across every
-- programme/experiment they participate in, so "Austin" reads as Austin on
-- both EXP-P1 and EXP-P2 — the steward-legibility problem this closes.
--
-- privacy_mode is the participant's own disclosure choice, never inferred:
--   - identified    — a civil/known display name may be shown
--   - pseudonymous  — a chosen handle/pseudonym is shown, no civil name
--   - anonymous     — a generated, non-identifying handle only
--
-- NEVER stores rootDid/kybeId/personaId in display_name/handle — those stay
-- server-internal (T0). This table is itself keyed by persona_id (a T0
-- foreign key, server-side only) but its DISPLAYED columns (display_name,
-- handle) are deliberately participant-authored T1 content, never derived
-- from or leaking the T0 identity chain.

BEGIN;

CREATE TABLE IF NOT EXISTS public.research_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  handle text NOT NULL,
  privacy_mode text NOT NULL DEFAULT 'pseudonymous' CHECK (privacy_mode IN ('identified', 'pseudonymous', 'anonymous')),
  -- Set when a steward PROPOSES a handle at invitation time, before the
  -- participant has confirmed it during onboarding (item 3: "proposed at
  -- invitation creation, created/confirmed during onboarding").
  proposed_by_persona_id uuid,
  confirmed_at timestamptz,
  -- True only for rows this migration's own backfill created (item 8:
  -- "derive a temporary admin label ... otherwise generate a neutral
  -- placeholder"). Lets the steward UI show "needs a real handle" without
  -- a second flag table.
  is_placeholder boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive handle uniqueness — "@austin-review" and "@Austin-Review"
-- are the same handle for collision purposes.
CREATE UNIQUE INDEX IF NOT EXISTS research_personas_handle_lower_idx
  ON public.research_personas (lower(handle));

ALTER TABLE public.research_personas ENABLE ROW LEVEL SECURITY;

-- Backfill (item 8): every persona_id that already holds an active
-- access_grants row gets a neutral placeholder row if it doesn't have one
-- yet, so the Steward UI never shows a blank/undefined identity for an
-- existing participant. `short-id` = first 8 chars of the persona_id — T2-
-- safe enough for an admin-only steward surface to disambiguate rows
-- (never shown to other researchers as a substitute for a real handle).
INSERT INTO public.research_personas (persona_id, display_name, handle, privacy_mode, is_placeholder)
SELECT DISTINCT
  ag.persona_id,
  'Researcher ' || substr(ag.persona_id::text, 1, 8),
  'researcher-' || substr(ag.persona_id::text, 1, 8),
  'pseudonymous',
  true
FROM public.access_grants ag
WHERE ag.status = 'active'
ON CONFLICT (persona_id) DO NOTHING;

COMMIT;
