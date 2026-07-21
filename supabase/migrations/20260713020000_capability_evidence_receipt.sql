-- CFS-029 §7.2 — Capability Evidence as a constitutional object: the persisted
-- evidence row carries its provenance receipt (knowledge_curated, written at
-- the pack-generation route when fresh evidence lands).
ALTER TABLE public.capability_evidence
  ADD COLUMN IF NOT EXISTS receipt_id text;
