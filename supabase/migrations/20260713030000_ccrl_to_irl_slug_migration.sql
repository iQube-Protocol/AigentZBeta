-- ccrl → irl slug migration (operator direction 2026-07-13, "hyper surgical").
-- The lab's machine slugs migrate to irl-*; code-side legacy aliases keep old
-- deep links resolving (data/codex-configs.ts LEGACY_CODEX_SLUGS /
-- LEGACY_TAB_SLUGS + the cartridgeAdminGrants tenant-slug translator).
-- This migration is DEFENSIVE: the IRL cartridge is hand-curated in code, so
-- DB rows exist only if a copy was ever registered — every statement is a
-- no-op when absent.

-- DB-registered codex copy, if any. codex_tabs.codex_id is a TEXT FK onto
-- codex_configs(id), so the id rename needs the constraint dropped for the
-- one statement — done ONLY when the legacy row actually exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.codex_configs WHERE id = 'ccrl-cartridge') THEN
    ALTER TABLE public.codex_tabs DROP CONSTRAINT IF EXISTS codex_tabs_codex_id_fkey;
    UPDATE public.codex_configs SET id = 'irl-cartridge' WHERE id = 'ccrl-cartridge';
    UPDATE public.codex_tabs SET codex_id = 'irl-cartridge' WHERE codex_id = 'ccrl-cartridge';
    ALTER TABLE public.codex_tabs ADD CONSTRAINT codex_tabs_codex_id_fkey
      FOREIGN KEY (codex_id) REFERENCES public.codex_configs(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.codex_configs SET slug = 'irl-cartridge' WHERE slug = 'ccrl-cartridge';

-- CRM tenant slugs feeding per-cartridge admin grants (the code-side
-- translator also maps legacy values — this normalises stored data to match).
UPDATE public.crm_tenants SET slug = 'irl-cartridge' WHERE slug IN ('ccrl', 'ccrl-cartridge');
