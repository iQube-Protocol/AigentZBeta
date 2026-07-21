-- CFS-035 Observatory amendment — operator-gated shadow→authoritative flip.
--
-- An Invariant Decision Node runs in SHADOW by default (observe-only; the
-- incumbent heuristic is served). Flipping a node to AUTHORITATIVE makes the
-- runtime serve the node's projection instead. This is a consequential, operator-
-- gated act (CFS-035 §11 / CFS-017 discipline) — recorded here with who flipped
-- it and why. Default is faithful: absent row ⇒ shadow (incumbent served).
--
-- `flipped_by_persona` is a T0 server-internal audit field — it is NEVER returned
-- to the browser (the flip API projects only node_id/authoritative/rationale/at).

create table if not exists invariant_node_flips (
  node_id            text primary key,
  authoritative      boolean not null default false,
  rationale          text,
  flipped_by_persona text,        -- T0 audit — server-internal only, never serialised to client
  flipped_at         timestamptz not null default now()
);

comment on table invariant_node_flips is
  'CFS-035 — per-node shadow→authoritative flip state. Absent/false ⇒ shadow (incumbent served). Operator-gated; flipped_by_persona is server-internal audit only.';
