-- Federate Locker assets and RoomQubes into the canonical iQube Registry.
--
-- Navigation/storage remain separate: asset_records and roomqubes stay the
-- native sources of truth; iqube_id_map only provides stable global identity.
-- Authorization remains persona-scoped in the existing access spine.

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

  ALTER TABLE public.iqube_id_map
    DROP CONSTRAINT IF EXISTS iqube_id_map_source_check;
  ALTER TABLE public.iqube_id_map
    ADD CONSTRAINT iqube_id_map_source_check CHECK (source IN (
      'triad_meta',
      'triad_blak',
      'triad_token',
      'content_qube',
      'registry_asset',
      'master_content_qube',
      'codex_media_asset',
      'identity_iqube',
      'memory_iqube',
      'code:aigentQubeSource',
      'code:toolQubeSource',
      'code:liquidui-template',
      'code:chainTemplate',
      'locker_asset',
      'roomqube'
    ));
END $$;

INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'locker_asset', a.id::text, 'ContentQube', false,
       'Federated Locker asset; bytes remain in the native rendition provider'
  FROM public.asset_records a
ON CONFLICT (source, source_id) DO NOTHING;

INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
SELECT 'roomqube', r.id::text, 'ClusterQube', false,
       'RoomQube governed manifest; membership is the access boundary'
  FROM public.roomqubes r
ON CONFLICT (source, source_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.register_locker_asset_iqube()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
  VALUES (
    'locker_asset',
    NEW.id::text,
    'ContentQube',
    false,
    'Federated Locker asset; bytes remain in the native rendition provider'
  )
  ON CONFLICT (source, source_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS asset_records_register_iqube ON public.asset_records;
CREATE TRIGGER asset_records_register_iqube
AFTER INSERT ON public.asset_records
FOR EACH ROW EXECUTE FUNCTION public.register_locker_asset_iqube();

CREATE OR REPLACE FUNCTION public.register_roomqube_iqube()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.iqube_id_map (source, source_id, primitive_type, synthetic, notes)
  VALUES (
    'roomqube',
    NEW.id::text,
    'ClusterQube',
    false,
    'RoomQube governed manifest; membership is the access boundary'
  )
  ON CONFLICT (source, source_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roomqubes_register_iqube ON public.roomqubes;
CREATE TRIGGER roomqubes_register_iqube
AFTER INSERT ON public.roomqubes
FOR EACH ROW EXECUTE FUNCTION public.register_roomqube_iqube();

REVOKE ALL ON FUNCTION public.register_locker_asset_iqube() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_roomqube_iqube() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.register_locker_asset_iqube() IS
  'Internal trigger: gives each Locker asset a canonical iQube identity. Not an access grant.';
COMMENT ON FUNCTION public.register_roomqube_iqube() IS
  'Internal trigger: gives each RoomQube a canonical ClusterQube identity. Not an access grant.';
