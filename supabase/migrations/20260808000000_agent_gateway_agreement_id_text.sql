-- 20260808000000_agent_gateway_agreement_id_text.sql
--
-- Fix agent_gateway_sessions.agreement_id: it was declared `uuid`, but the
-- Constitutional Agreement it references is keyed by a stable SLUG (e.g.
-- `thr-thc_…`), not a UUID. Storing the slug into a uuid column fails at the
-- crossing with "invalid input syntax for type uuid". Retype to text. The column
-- is only ever null until a crossing succeeds, so the cast is safe.

ALTER TABLE public.agent_gateway_sessions
  ALTER COLUMN agreement_id TYPE text USING agreement_id::text;
