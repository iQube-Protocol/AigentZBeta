-- ============================================================================
-- AVL → MVL rename: AgentiQ Venture Lab is now metaMe Venture Lab.
--
-- Rewrites any existing experience_qubes.active_cartridges row that
-- contains the slug 'avl' to use 'mvl' instead. Idempotent — re-running
-- after the swap is a no-op because no rows will match 'avl' any more.
--
-- ActiveCartridgeSlug type union in services/iqube/experienceQube.ts
-- has been updated in lockstep. Venture iQube schema bumped to v0.3
-- (codexes/packs/agentiq/updates/2026-05-29_venture-iqube-schema-v0.3.md).
-- ============================================================================

UPDATE public.experience_qubes
SET active_cartridges = array_replace(active_cartridges, 'avl', 'mvl')
WHERE 'avl' = ANY(active_cartridges);

-- Sanity report — non-fatal; safe to inspect after running.
SELECT COUNT(*) AS rows_with_avl_remaining
FROM public.experience_qubes
WHERE 'avl' = ANY(active_cartridges);
