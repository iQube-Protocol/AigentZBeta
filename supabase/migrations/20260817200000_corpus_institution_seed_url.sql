-- 20260817200000_corpus_institution_seed_url.sql
--
-- Constitutional Discovery amendment §4/§9 phase 3 — Agent B (Discovery
-- Agent) needs a concrete starting point per institution to do
-- institution-targeted navigation instead of open keyword search (Law I's
-- institution-first philosophy — general search stays reserved for §7 Open
-- Discovery, the doubly-gated last resort). `seed_url` is that starting
-- point: the institution's own publications/recommendations listing page,
-- steward-provided at proposal time alongside the institution name.
--
-- Nullable and additive — an institution with no seed_url yet simply isn't
-- eligible for automated discovery until a steward adds one; nothing about
-- the existing propose->ratify flow changes.

ALTER TABLE public.corpus_institutional_registry
  ADD COLUMN IF NOT EXISTS seed_url text;

COMMENT ON COLUMN public.corpus_institutional_registry.seed_url IS
  'Constitutional Discovery amendment §4 — the institution''s own publications/recommendations listing page. Agent B''s starting point for institution-targeted navigation; steward-provided, never search-derived.';
