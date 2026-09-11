-- 20260814000000_access_gateway_human_sessions.sql
--
-- Polity Access Gateway — human session row shape (PRD-PAG-001 §2.1 / §4,
-- operator-ratified 2026-07-22, Phase 1).
--
-- The PRD's central direction: the Access Gateway is the Threshold gateway
-- GENERALIZED — "one core (handshake, PKCE/DCR, hashed-bearer T2 session store,
-- scope model), two adapters (agent-MCP, human-OIDC), one session table extended
-- to carry both row shapes" — never a second parallel session store. So the
-- human web session lives in agent_gateway_sessions as a `session_kind='human'`
-- row: it binds a PERSONA directly (no agent alias, no delegation agreement —
-- the human acts as themselves), and carries the T1/T2-only claim snapshot the
-- SessionQube projects to the relying party.
--
-- No T0 identifiers are added: subject_pairwise_ref is the keyed-HMAC pairwise
-- reference (services/identity/personaReferences.ts derivePairwiseRef — level 3
-- of the three-level model), principal_public_ref (existing column) stays the
-- sha256/16-hex Polity Public Reference (level 2), display_label/cartridge_flags
-- are the T1 surface snapshot, passport_status carries only the public-safe
-- passport fields (passportCredential.ts discipline). consent_record holds the
-- human's consent act (client, claims, timestamp — T2 refs only) and consent_ref
-- its sha256/16-hex commitment, safe to surface on the session payload.
--
-- Idempotent + additive; agent rows are untouched (session_kind defaults to
-- 'agent'). The table already has deny-all RLS (20260806000000) — service-role
-- gateway routes only; nothing here weakens it.

ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS session_kind text NOT NULL DEFAULT 'agent'
    CHECK (session_kind IN ('agent', 'human'));

-- Per-RP pairwise subject reference (T2 — prf_… keyed HMAC, or the Polity
-- Public Reference fallback for first-party when pairwise refs are disabled).
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS subject_pairwise_ref text;

-- T1 claim snapshot taken at consent time (browser-safe by definition).
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS display_label text;
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS cartridge_flags jsonb;

-- T2 public-safe passport status snapshot (class / statuses / grade / validity
-- — never the raw passport record, never kybe identifiers).
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS passport_status jsonb;

-- The consent record (clientId, granted claims, subjectRef, approvedAt — T2
-- refs only) + its sha256/16-hex commitment (surfaced on the SessionQube).
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS consent_record jsonb;
ALTER TABLE public.agent_gateway_sessions
  ADD COLUMN IF NOT EXISTS consent_ref text;

CREATE INDEX IF NOT EXISTS agent_gateway_sessions_kind_idx
  ON public.agent_gateway_sessions (session_kind);

COMMENT ON COLUMN public.agent_gateway_sessions.session_kind IS
  'PRD-PAG-001 §2.1: ''agent'' = Threshold MCP delegation row (binds agent_alias + agreement_id); ''human'' = Access Gateway human web session (binds a persona directly — agent_alias/agreement_id stay NULL).';
COMMENT ON COLUMN public.agent_gateway_sessions.subject_pairwise_ref IS
  'T2 pairwise subject ref for the registered client (derivePairwiseRef, persona_external_refs-backed) or the Polity Public Reference fallback. Never a raw persona UUID.';
COMMENT ON COLUMN public.agent_gateway_sessions.consent_ref IS
  'sha256/16-hex commitment of consent_record — the T2-safe consent reference surfaced on the SessionQube.';
