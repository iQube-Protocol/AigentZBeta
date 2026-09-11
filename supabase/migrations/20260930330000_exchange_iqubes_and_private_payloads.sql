-- Project reciprocal exchanges as private ClusterQubes and their deposited
-- artifacts as independently gated ContentQubes. Native exchange tables remain
-- authoritative; this mapping grants no access and copies no payload bytes.

DO $$
DECLARE constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
   WHERE ns.nspname = 'public' AND rel.relname = 'iqube_id_map'
     AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%source%triad_meta%'
   LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.iqube_id_map DROP CONSTRAINT %I', constraint_name);
  END IF;
  ALTER TABLE public.iqube_id_map DROP CONSTRAINT IF EXISTS iqube_id_map_source_check;
  ALTER TABLE public.iqube_id_map ADD CONSTRAINT iqube_id_map_source_check CHECK (source IN (
    'triad_meta', 'triad_blak', 'triad_token', 'content_qube', 'registry_asset',
    'master_content_qube', 'codex_media_asset', 'identity_iqube', 'memory_iqube',
    'code:aigentQubeSource', 'code:toolQubeSource', 'code:liquidui-template',
    'code:chainTemplate', 'locker_asset', 'roomqube',
    'research_experiment', 'research_document', 'research_object', 'experiment_result',
    'reciprocal_exchange', 'exchange_artifact'
  ));
END $$;

INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'reciprocal_exchange', id::text, 'ClusterQube', false,
       'Private reciprocal exchange; membership and disclosure remain authoritative in the exchange service'
FROM public.reciprocal_exchanges
ON CONFLICT (source, source_id) DO NOTHING;

INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'exchange_artifact', id::text, 'ContentQube', false,
       'Private exchange artifact; payload remains at its immutable native storage reference'
FROM public.exchange_artifacts
ON CONFLICT (source, source_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.register_reciprocal_exchange_iqube()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
  VALUES ('reciprocal_exchange', NEW.id::text, 'ClusterQube', false,
          'Private reciprocal exchange; membership and disclosure remain authoritative in the exchange service')
  ON CONFLICT (source, source_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_exchange_artifact_iqube()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
  VALUES ('exchange_artifact', NEW.id::text, 'ContentQube', false,
          'Private exchange artifact; payload remains at its immutable native storage reference')
  ON CONFLICT (source, source_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reciprocal_exchanges_register_iqube ON public.reciprocal_exchanges;
CREATE TRIGGER reciprocal_exchanges_register_iqube
AFTER INSERT ON public.reciprocal_exchanges
FOR EACH ROW EXECUTE FUNCTION public.register_reciprocal_exchange_iqube();

DROP TRIGGER IF EXISTS exchange_artifacts_register_iqube ON public.exchange_artifacts;
CREATE TRIGGER exchange_artifacts_register_iqube
AFTER INSERT ON public.exchange_artifacts
FOR EACH ROW EXECUTE FUNCTION public.register_exchange_artifact_iqube();

REVOKE ALL ON FUNCTION public.register_reciprocal_exchange_iqube() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_exchange_artifact_iqube() FROM PUBLIC, anon, authenticated;

-- Private WIP/recovery fallback only. Canonical frozen artifacts are encrypted
-- and minted to AutoDrive; no client policy is intentionally installed here.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exchange-artifacts', 'exchange-artifacts', false, 20971520,
  ARRAY['text/plain','text/markdown','application/json','application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMENT ON FUNCTION public.register_reciprocal_exchange_iqube() IS
  'Internal identity trigger only; it does not grant exchange access.';
COMMENT ON FUNCTION public.register_exchange_artifact_iqube() IS
  'Internal identity trigger only; it does not grant artifact access.';
