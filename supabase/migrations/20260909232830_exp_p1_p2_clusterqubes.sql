-- Constitute EXP-P1 and the EXP-P2 family as thin, experiment-governed iQubes.
--
-- Payloads remain in their native homes:
--   * IRL pack documents -> pack corpus (Supabase runtime mirror / AutoDrive canon)
--   * research_objects / experiment_results -> their existing RLS tables
-- iqube_id_map supplies stable global identity only. It grants no access.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
   WHERE ns.nspname = 'public'
     AND rel.relname = 'iqube_id_map'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) LIKE '%source%triad_meta%'
   LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.iqube_id_map DROP CONSTRAINT %I', constraint_name);
  END IF;
  ALTER TABLE public.iqube_id_map DROP CONSTRAINT IF EXISTS iqube_id_map_source_check;
  ALTER TABLE public.iqube_id_map ADD CONSTRAINT iqube_id_map_source_check CHECK (source IN (
    'triad_meta', 'triad_blak', 'triad_token', 'content_qube', 'registry_asset',
    'master_content_qube', 'codex_media_asset', 'identity_iqube', 'memory_iqube',
    'code:aigentQubeSource', 'code:toolQubeSource', 'code:liquidui-template',
    'code:chainTemplate', 'locker_asset', 'roomqube', 'research_experiment',
    'research_document', 'research_object', 'experiment_result'
  ));
END $$;

INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'research_experiment', experiment_id, 'ClusterQube', false,
       'Experiment ClusterQube; composition is explicit and member access remains independent'
FROM (VALUES ('EXP-P1'), ('EXP-P2'), ('EXP-P2A'), ('EXP-P2B')) AS roots(experiment_id)
ON CONFLICT (source, source_id) DO NOTHING;

INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'research_document', experiment_id || '|' || document_path, 'ContentQube', false,
       'Experiment ContentQube; payload remains in the IRL pack corpus'
FROM (VALUES
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/README.md'),
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_COVER_NOTE.md'),
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_EXP_P1_COVER_NOTE.md'),
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_ONE_PAGER.md'),
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/AUSTIN_REVIEWER_KIT.md'),
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/CRYSTAL-CANON_source-material-charter.md'),
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/CRYSTAL-ENLARGEMENT_plan.md'),
  ('EXP-P1', 'foundation/experiments/exp-p1-representation-runtime-gauntlet/OPERATOR_SIGNING_RUNBOOK.md'),
  ('EXP-P2', 'foundation/experiments/exp-p2-consequential-performance/README.md'),
  ('EXP-P2', 'foundation/experiments/exp-p2-consequential-performance/01_shared-constitutional-framework.md'),
  ('EXP-P2', 'foundation/experiments/exp-p2-consequential-performance/02_protocol-v0.5.md'),
  ('EXP-P2', 'foundation/experiments/exp-p2-consequential-performance/03_operational-amendment-v0.5.md'),
  ('EXP-P2', 'foundation/experiments/exp-p2-consequential-performance/04_statistical-analysis-plan-skeleton.md'),
  ('EXP-P2', 'foundation/experiments/exp-p2-consequential-performance/05_v0.2-recovered-historical-draft.md'),
  ('EXP-P2', 'foundation/experiments/exp-p2-consequential-performance/06_stopping-rule-reconciliation.md'),
  ('EXP-P2A', 'foundation/experiments/exp-p2a-software-consequences/README.md'),
  ('EXP-P2B', 'foundation/experiments/exp-p2b-physical-consequences/README.md'),
  ('EXP-P2B', 'foundation/experiments/exp-p2b-physical-consequences/01_prior-protocol-v1.0-candidate.md')
) AS documents(experiment_id, document_path)
ON CONFLICT (source, source_id) DO NOTHING;

-- Existing Supabase-native evidence becomes a DataQube by reference.
INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'research_object', id::text, 'DataQube', false,
       'Experiment DataQube; payload remains in RLS-protected research_objects'
FROM public.research_objects
WHERE object_id ~ '^EXP-P1/' OR object_id ~ '^EXP-P2(A|B)?/'
ON CONFLICT (source, source_id) DO NOTHING;

INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'experiment_result', id::text, 'DataQube', false,
       'Experiment DataQube; payload remains in RLS-protected experiment_results'
FROM public.experiment_results
WHERE experiment IN ('EXP-P1', 'EXP-P2', 'EXP-P2A', 'EXP-P2B')
ON CONFLICT (source, source_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.register_foundational_research_object_iqube()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.object_id ~ '^EXP-P1/' OR NEW.object_id ~ '^EXP-P2(A|B)?/' THEN
    INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
    VALUES ('research_object', NEW.id::text, 'DataQube', false,
            'Experiment DataQube; payload remains in RLS-protected research_objects')
    ON CONFLICT (source, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_objects_register_foundational_iqube ON public.research_objects;
CREATE TRIGGER research_objects_register_foundational_iqube
AFTER INSERT ON public.research_objects
FOR EACH ROW EXECUTE FUNCTION public.register_foundational_research_object_iqube();

CREATE OR REPLACE FUNCTION public.register_foundational_experiment_result_iqube()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.experiment IN ('EXP-P1', 'EXP-P2', 'EXP-P2A', 'EXP-P2B') THEN
    INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
    VALUES ('experiment_result', NEW.id::text, 'DataQube', false,
            'Experiment DataQube; payload remains in RLS-protected experiment_results')
    ON CONFLICT (source, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS experiment_results_register_foundational_iqube ON public.experiment_results;
CREATE TRIGGER experiment_results_register_foundational_iqube
AFTER INSERT ON public.experiment_results
FOR EACH ROW EXECUTE FUNCTION public.register_foundational_experiment_result_iqube();

REVOKE ALL ON FUNCTION public.register_foundational_research_object_iqube() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_foundational_experiment_result_iqube() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.register_foundational_research_object_iqube() IS
  'Internal trigger assigning iQube identity to new EXP-P1/P2 evidence. Does not grant access.';
COMMENT ON FUNCTION public.register_foundational_experiment_result_iqube() IS
  'Internal trigger assigning iQube identity to new EXP-P1/P2 results. Does not grant access.';
