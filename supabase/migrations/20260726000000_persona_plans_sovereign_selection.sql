-- 20260726000000_persona_plans_sovereign_selection.sql
--
-- IRL OS payment model (operator 2026-07-19): fold the research agent into the
-- Sovereign/Steward ladder, mirroring aigentZ/DevOn.
--
--   Free      → IRL OS content.
--   Sovereign → EITHER aigentZ OR Research Copilot (light) — the subscriber
--               picks ONE (sovereign_selection). Research light = 3 experiments/mo.
--   Steward   → BOTH aigentZ AND Research Copilot (full) — high experiment cap.
--   Add-ons   → aigentz_tier / research_tier let a subscriber on one path bolt
--               the other service on without going to Steward (each $29/mo,
--               standalone, mirrors the existing research_tier SKU).
--
-- Grandfathering:
--   * sovereign_selection NULL is read as 'aigentz' in the resolver, so every
--     existing Sovereign subscriber keeps aigentZ until they explicitly switch.
--   * research_tier === 'active' holders keep Research Copilot (add-on clause).
--
-- Additive/idempotent (CFS-010 §3).

ALTER TABLE public.persona_plans
  ADD COLUMN IF NOT EXISTS sovereign_selection text,  -- 'aigentz' | 'research' | NULL(=aigentz)
  ADD COLUMN IF NOT EXISTS aigentz_tier text;         -- 'active' | NULL  (standalone aigentZ add-on)

-- Monthly experiment-run counter — enforces the 3/mo (light) vs high (steward)
-- cap. period is 'YYYY-MM'; one row per (persona, month). Service-role only.
CREATE TABLE IF NOT EXISTS public.experiment_run_counters (
  persona_id uuid NOT NULL,
  period text NOT NULL,
  runs int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (persona_id, period)
);

ALTER TABLE public.experiment_run_counters ENABLE ROW LEVEL SECURITY;
