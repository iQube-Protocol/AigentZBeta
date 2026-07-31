-- 20260809000000_agent_gateway_session_upgrade.sql
--
-- metaMe Threshold — the incremental service crossing (PRD-THR-001 §9, Increment 4b).
--
-- Entering a service (e.g. IRL) is a SEPARATE constitutional event from crossing
-- the Threshold: the human authorizes an additional, capability-specific delegation
-- that UPGRADES the agent's existing session — "authorize one more thing" — rather
-- than minting a new bearer. This adds two columns to agent_gateway_sessions:
--
--   upgrade_of         — on a `pending` upgrade handshake row, the id of the ACTIVE
--                        session being upgraded (so the browser authorization is
--                        pinned to the exact agent session it augments).
--   service_agreements — on an ACTIVE session, a map of serviceId -> the AUTHORIZED
--                        capability-specific agreement id (e.g. irl ->
--                        irl:experiment-result:submit agreement). The delegated
--                        write tools (submit_review) use this agreement, NOT the
--                        base crossing agreement, so the x409 gate stays intact.
--
-- Idempotent + additive; nothing existing changes.

ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS upgrade_of text;
ALTER TABLE public.agent_gateway_sessions ADD COLUMN IF NOT EXISTS service_agreements jsonb NOT NULL DEFAULT '{}'::jsonb;
