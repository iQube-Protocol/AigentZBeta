-- QubeTalk confidentiality repair (incident 2026-07-28)
--
-- QubeTalk history rendered in full to an anonymous visitor loading a Companion
-- embed URL in a private window. The API routes are fixed separately; this
-- migration closes the two DATABASE-layer failures, either of which would have
-- been sufficient on its own.
--
-- FAILURE 1 — `select` granted to `anon`.
--   20260113090500_qubetalk_tables.sql line 130-132 granted select on all three
--   QubeTalk tables to the `anon` role. Combined with the PostgREST endpoint,
--   that is a read path that never touches our application code at all.
--
-- FAILURE 2 — the RLS policies are INERT.
--   Every policy gates on `current_setting('app.current_tenant_id')`. That
--   session variable is never set anywhere in the codebase — no `set_config`
--   call exists, and the server connects with the SERVICE ROLE key, which
--   bypasses RLS entirely. So the policies have never once evaluated against a
--   real request. This is CB-1: a mechanism that cannot fire is
--   constitutionally indistinguishable from a mechanism that does not exist.
--
--   Worse than absent, it read as PRESENT. A reviewer opening the migration saw
--   `enable row level security` and six named policies and reasonably concluded
--   the tables were protected.
--
-- The repair below does NOT try to make `app.current_tenant_id` work. Making an
-- unset GUC load-bearing would rebuild the same trap. Instead the tables become
-- deny-by-default to every non-service role: the application is the only reader,
-- and the application now authenticates its caller through the identity spine.

begin;

-- ── 1. Revoke the anonymous read path ──────────────────────────────────────
-- `anon` has no legitimate reason to read agent-to-agent channel traffic.
revoke select on qubetalk_channels    from anon;
revoke select on qubetalk_delegations from anon;
revoke select on qubetalk_messages    from anon;

-- `authenticated` loses direct table access too. Being signed in is not the
-- same as being a participant in a channel, and the difference is exactly what
-- leaked. Reads go through the API, which resolves the caller's actual scope.
revoke select, insert, update on qubetalk_channels    from authenticated;
revoke select, insert, update on qubetalk_delegations from authenticated;
revoke select, insert, update on qubetalk_messages    from authenticated;

-- ── 2. Replace the inert policies with deny-by-default ─────────────────────
-- Dropped rather than repaired: a policy keyed on a GUC nothing sets is not a
-- weaker gate, it is a decorative one, and leaving it in place would preserve
-- the false assurance that caused this.
drop policy if exists "Users can view channels they participate in"    on qubetalk_channels;
drop policy if exists "Users can insert channels for their tenant"     on qubetalk_channels;
drop policy if exists "Users can view delegations in their tenant"     on qubetalk_delegations;
drop policy if exists "Users can insert delegations for their tenant"  on qubetalk_delegations;
drop policy if exists "Users can view messages in their tenant channels"   on qubetalk_messages;
drop policy if exists "Users can insert messages in their tenant channels" on qubetalk_messages;

-- RLS stays enabled with NO permissive policy. Under Postgres RLS that denies
-- every row to every non-superuser, non-owner role — the service role the API
-- uses still bypasses it (BYPASSRLS), which is why the API-layer gate is the
-- load-bearing control and is canaried as such.
alter table qubetalk_channels    enable row level security;
alter table qubetalk_delegations enable row level security;
alter table qubetalk_messages    enable row level security;

-- Belt and braces: force RLS for the table OWNER too, so a future connection
-- made as the owner rather than the service role cannot silently read through.
alter table qubetalk_channels    force row level security;
alter table qubetalk_delegations force row level security;
alter table qubetalk_messages    force row level security;

comment on table qubetalk_channels is
  'QubeTalk channels. CONFIDENTIAL. Deny-by-default RLS with no permissive policy: '
  'all reads go through /api/qubetalk/*, which authenticates the caller via the '
  'identity spine and derives tenant scope server-side. Never grant to anon.';
comment on table qubetalk_messages is
  'QubeTalk message history. CONFIDENTIAL — see qubetalk_channels. Anonymous read '
  'of this table was the 2026-07-28 leak.';

commit;
