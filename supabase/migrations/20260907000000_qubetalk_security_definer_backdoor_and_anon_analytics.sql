-- QubeTalk confidentiality repair, part 2 (incident 2026-07-28)
--
-- 20260906000000 revoked `select` on the three QubeTalk TABLES from `anon` and
-- left them deny-by-default. That repair was incomplete, and the way it was
-- incomplete is the same failure shape as the incident itself: it closed the
-- door that was being looked at while an equivalent door stayed open beside it.
--
-- ── LEAK A — SECURITY DEFINER functions granted to `anon` ───────────────────
--
-- 20260113091000_qubetalk_functions.sql defines every QubeTalk helper as
-- `security definer`. Such a function executes with its OWNER's privileges, so
-- it bypasses BOTH the table grants and the RLS that part 1 established. The
-- table lockdown does not reach it.
--
-- Three of them were granted to `anon`:
--
--   get_channel_statistics(p_channel_id)      -- message count, delegation
--                                                count, participant count and
--                                                last activity for ANY channel
--   get_channel_message_count(p_channel_id)
--   get_channel_delegation_count(p_channel_id)
--
-- Reachable anonymously over PostgREST RPC. Not message bodies, but a complete
-- traffic-analysis surface over every channel in every tenant: who is busy,
-- when they were last active, how many parties are in the room. For an
-- agent-to-agent channel that metadata is itself confidential, and part 1's
-- table comments assert a protection this bypasses.
--
-- Three more were granted to `authenticated` and are WRITE functions:
--
--   create_qubetalk_channel, add_channel_participant, remove_channel_participant
--
-- `add_channel_participant` on an arbitrary channel_id is a self-service grant
-- of read access to someone else's channel. Being signed in is not membership —
-- that distinction is exactly what the incident was about — so these come off
-- `authenticated` too. The API calls them through the service role, which is
-- unaffected by these revokes.
--
-- `set_tenant_context` / `get_tenant_context` set and read the
-- `app.current_tenant_id` GUC the part-1 migration retired. Nothing calls them;
-- they are the leftover half of the inert-RLS mechanism. Revoked so the dead
-- mechanism cannot be picked up and re-used as though it were load-bearing.
--
-- ── LEAK B — share_analytics granted to `anon` with no RLS ──────────────────
--
-- 20251230_share_analytics.sql grants `select` to `anon` on share_analytics and
-- three views over it, and never enables RLS on the table. The table holds
-- `persona_id` — a T0 identifier CLAUDE.md forbids serialising anywhere — plus
-- `ip_address` and `user_agent`. That is anonymous read of a T0 identifier
-- correlated with PII, over PostgREST, requiring no credential of any kind.
--
-- Included here rather than deferred because it is the same defect class found
-- while sweeping for it, and it is live. Every application read of these
-- objects goes through /api/analytics/* using the service role, so revoking
-- `anon` changes no working surface.

begin;

-- ── A. Close the SECURITY DEFINER bypass ───────────────────────────────────

revoke execute on function get_channel_statistics(text)       from anon;
revoke execute on function get_channel_message_count(text)    from anon;
revoke execute on function get_channel_delegation_count(text) from anon;

revoke execute on function get_channel_statistics(text)       from authenticated;
revoke execute on function get_channel_message_count(text)    from authenticated;
revoke execute on function get_channel_delegation_count(text) from authenticated;

revoke execute on function create_qubetalk_channel(text, text, text[])  from authenticated;
revoke execute on function add_channel_participant(text, text)          from authenticated;
revoke execute on function remove_channel_participant(text, text)       from authenticated;

revoke execute on function set_tenant_context(text) from anon, authenticated;
revoke execute on function get_tenant_context()     from anon, authenticated;

comment on function get_channel_statistics(text) is
  'SECURITY DEFINER — bypasses the deny-by-default RLS on qubetalk_*. Service '
  'role only. Granting this to anon/authenticated re-opens the 2026-07-28 leak '
  'as traffic analysis; the table lockdown does NOT constrain it.';

-- ── B. Close the anonymous read of share_analytics (persona_id + IP) ───────

revoke select on share_analytics              from anon;
revoke select on share_analytics_summary      from anon;
revoke select on persona_sharing_leaderboard  from anon;
revoke select on platform_analytics           from anon;

-- `authenticated` keeps no direct access either: reads go through
-- /api/analytics/*, which is where any scoping decision belongs.
revoke select on share_analytics              from authenticated;
revoke select on share_analytics_summary      from authenticated;
revoke select on persona_sharing_leaderboard  from authenticated;
revoke select on platform_analytics           from authenticated;

alter table share_analytics enable row level security;
alter table share_analytics force row level security;

comment on table share_analytics is
  'Share telemetry. CONFIDENTIAL — holds persona_id (T0), ip_address and '
  'user_agent. Deny-by-default RLS, no permissive policy; reads go through '
  '/api/analytics/* under the service role. Never grant to anon.';

commit;
