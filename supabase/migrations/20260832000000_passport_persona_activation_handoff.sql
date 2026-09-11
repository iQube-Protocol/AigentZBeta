-- 20260832000000_passport_persona_activation_handoff.sql
--
-- PRD-PAG-001 Amendment A §A.11 follow-up — the persona activation must cross
-- the storage partition (operator, 2026-07-28: "now actions aren't working —
-- red check mark and not pulling over or getting right overlay").
--
-- WHAT BROKE. §A.11.2 pins the citizen's EXPLICITLY CHOSEN persona by writing
-- `localStorage.currentPersonaId` from the Companion panel. But the Companion
-- is an iframe inside the extension side panel, and the browser PARTITIONS
-- third-party iframe storage — the same partition gap §A.10.2a already closed
-- for the SESSION, and which the panel's own comment names three lines later.
-- So the pin landed in the iframe's partition and the TOP-LEVEL application
-- never saw it. Three symptoms, one cause:
--
--   1. `personaFetch` (utils/personaSpine.tsx) attaches `x-persona-id` from
--      that key. Absent it, `getActivePersona` falls to its step-4 "first
--      owned persona, sorted" default — the exact fallback ruling 2 abolishes.
--   2. WORSE: MetaMeRuntimeClient.tsx's own bootstrap then LATCHES that
--      fallback ("firstId" from /api/wallet/personas) into localStorage. The
--      wrong persona is not merely resolved once, it is persisted — and its
--      `if (!localStorage.getItem(...))` guard then keeps it.
--   3. The extension observer scrapes `currentPersonaId` off the top-level
--      metaMe tab (background.js). With no pin it reports "no-active-persona"
--      ("PERSONA TO PAIR: None confirmed"), Connect stays disabled, no session
--      is stored, and every "Pull Across" capture dies at `ensureFreshToken`
--      with `no-auth-session` — the red ✗ badge. With a LATCHED WRONG pin it
--      pairs the wrong persona and the overlay/actions resolve against it.
--
-- THE FIX, in the shape this codebase already ratified. §A.10.2a solved the
-- identical problem for the session by minting ONE GRANT PER STORAGE WORLD
-- (`tokenHash` for the Companion partition, `handoffTokenHash` for the
-- top-level app). The persona activation now follows exactly that discipline:
-- the pending-auth row carries a SECOND, independent single-use marker, so the
-- Companion partition and the top-level application can each redeem the
-- citizen's one recorded choice exactly once, in their own storage world.
--
-- This is additive and changes nothing existing: a row that never redeems the
-- application marker behaves precisely as it does today.

ALTER TABLE public.passport_pending_auth
  ADD COLUMN IF NOT EXISTS persona_activation_handoff_consumed_at timestamptz;

COMMENT ON COLUMN public.passport_pending_auth.persona_activation_handoff_consumed_at IS
  'Second, independent single-use marker for the persona activation — redeemed by the TOP-LEVEL application (/passport-connect/complete) exactly as persona_activation_consumed_at is redeemed by the Companion iframe. One grant per storage world, mirroring the session handoff (PRD-PAG-001 Amendment A §A.10.2a). Set once by a conditional UPDATE (... WHERE persona_activation_handoff_consumed_at IS NULL).';
