-- Create Marketa agent personas (@aigent) and link to CRM personas
-- Adds identity-layer personas in `persona` and CRM-layer personas in `crm_personas`.

-- 1) Ensure identity personas exist (agent_declared @aigent handles)
INSERT INTO persona (fio_handle, default_identity_state, world_id_status, app_origin)
SELECT 'marketaagq@aigent', 'semi_anonymous', 'agent_declared', 'aigentiq'
WHERE NOT EXISTS (SELECT 1 FROM persona WHERE fio_handle = 'marketaagq@aigent');

INSERT INTO persona (fio_handle, default_identity_state, world_id_status, app_origin)
SELECT 'marketalvb@aigent', 'semi_anonymous', 'agent_declared', 'aigentiq'
WHERE NOT EXISTS (SELECT 1 FROM persona WHERE fio_handle = 'marketalvb@aigent');

-- 2) Ensure CRM personas exist and link them to identity personas
INSERT INTO public.crm_personas (tenant_id, display_name, email, external_user_id, persona_state, identity_persona_id)
SELECT
  'demo-tenant',
  'Marketa (AGQ)',
  'marketaagq@aigent',
  'marketa-agq',
  'pseudonymous',
  (SELECT id FROM persona WHERE fio_handle = 'marketaagq@aigent' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_personas
  WHERE tenant_id = 'demo-tenant' AND external_user_id = 'marketa-agq'
);

INSERT INTO public.crm_personas (tenant_id, display_name, email, external_user_id, persona_state, identity_persona_id)
SELECT
  'demo-tenant',
  'Marketa (LVB)',
  'marketalvb@aigent',
  'marketa-lvb',
  'pseudonymous',
  (SELECT id FROM persona WHERE fio_handle = 'marketalvb@aigent' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_personas
  WHERE tenant_id = 'demo-tenant' AND external_user_id = 'marketa-lvb'
);

-- 3) Verification query (safe to run repeatedly)
-- SELECT cp.id AS crm_persona_id, cp.tenant_id, cp.display_name, cp.external_user_id, cp.identity_persona_id,
--        p.fio_handle AS identity_fio_handle
-- FROM public.crm_personas cp
-- LEFT JOIN persona p ON p.id = cp.identity_persona_id
-- WHERE cp.tenant_id = 'demo-tenant'
--   AND cp.external_user_id IN ('marketa-agq', 'marketa-lvb')
-- ORDER BY cp.external_user_id;
