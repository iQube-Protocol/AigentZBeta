-- 20260729000000_memory_invariants.sql
--
-- CFS-045 Memory Compilation (Post-Inference Knowledge Compression) — the
-- constitutional memory layer, ratified by the operator 2026-07-19.
--
-- Principles encoded here (charter:
-- codexes/packs/agentiq/updates/2026-07-19_cfs-045-memory-compilation-charter.md):
--   • Memory is not a transcript: rows are invariants that SURVIVED reasoning,
--     never conversation history. Conversation is evidence; memory is
--     conclusion.
--   • persona_id is a T0 key — server-internal only, never serialised to
--     browser-bound JSON, receipts, or chain payloads.
--   • statement content must be T1-safe (no third-party identifiers).
--   • The substrate compresses itself: compaction merges near-duplicates and
--     retires refuted/stale entries — memory stays small by design.
--
-- Service-role access only; RLS enabled with no client policies.

CREATE TABLE IF NOT EXISTS public.memory_invariants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL,
  cartridge_id text NOT NULL,
  statement text NOT NULL,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'retired')),
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  support_count int NOT NULL DEFAULT 1,
  refute_count int NOT NULL DEFAULT 0,
  -- merged_from / split_from ancestry (CFS-045 taxonomy: merged | split)
  lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Platform invariant seed ids that grounded the discovery (T2-safe refs)
  source_seed_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz,
  last_cited_at timestamptz
);

CREATE INDEX IF NOT EXISTS memory_invariants_persona_cartridge_idx
  ON public.memory_invariants (persona_id, cartridge_id, status);

CREATE INDEX IF NOT EXISTS memory_invariants_recency_idx
  ON public.memory_invariants (persona_id, updated_at DESC);

ALTER TABLE public.memory_invariants ENABLE ROW LEVEL SECURITY;
