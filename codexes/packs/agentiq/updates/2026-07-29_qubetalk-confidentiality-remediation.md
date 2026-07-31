# QubeTalk confidentiality remediation — closing the doors beside the one we fixed

**Date:** 2026-07-29
**Branch:** `claude/constitutional-ground-review-7yg8nb`
**Follows:** `da4bb2677` — "Close the anonymous read path into QubeTalk history"

---

## Summary

`da4bb2677` closed the anonymous read of QubeTalk history on the four **channel**
routes. It did not close the rest of the surface, and it made the gated routes
into spine endpoints without migrating any of the clients — so signed-in users
were getting 401s on surfaces that had worked the day before.

This change does three things:

1. **Migrates every client to `personaFetch`**, so authenticated users can reach
   the data they are entitled to again.
2. **Audits and gates the remaining QubeTalk routes** — messages, delegations,
   workflow invocation, the AA-API machine lane and the Marketa lane. Two of
   these carried leaks at least as serious as the original.
3. **Sweeps for the same shape elsewhere** and fixes two live leaks the first
   repair migration did not reach.

Suite: **179 files / 2865 tests green** (was 2843 — +22 canaries). `tsc --noEmit`
clean apart from the two pre-existing config errors. **23/23 mutations killed.**

---

## The two most serious findings

### 1. A hardcoded backdoor credential in the AA-API QubeTalk lane

`app/api/aa/qubetalk/route.ts` and `app/api/aa/qubetalk/channels/route.ts` both
accepted the literal string **`'demo-external-key'`** as a valid API key, in
production, commented "For development" with nothing confining it to
development. Any caller sending

```
X-API-Key: demo-external-key
X-Agent-ID: anything
```

could list channels and read the **full message history of any tenant it chose
to name**, and post messages into any channel. This is the same leak the
incident was about, reachable through a second door — the front door had just
been bolted while this one stood open behind a string committed to the repo.

The authenticator was **copy-pasted verbatim into both files**, which is how a
backdoor survives being fixed in one place. It now lives once, in
`app/api/aa/qubetalk/_lib/authenticateExternalAgent.ts`, accepts only keys from
the environment, and **fails closed** when none is configured — an unconfigured
deployment authenticates nobody rather than everybody.

> **Operator action:** if any external agent integration is live, it must now
> present a key from `AA_API_KEY` or `EXTERNAL_AGENT_API_KEY`. If neither is set
> in Amplify, the lane is closed. Nothing in this repo calls it, so no in-app
> surface breaks either way.

### 2. `SECURITY DEFINER` functions bypass the repair migration entirely

`20260906000000` revoked `select` on the QubeTalk **tables** from `anon` and left
them deny-by-default. That lockdown **does not reach**
`20260113091000_qubetalk_functions.sql`, where every helper is declared
`security definer` — such a function executes with its owner's privileges and
bypasses both the table grants and RLS.

Three of them were **granted to `anon`**:

| Function | What an anonymous caller gets |
|---|---|
| `get_channel_statistics(channel_id)` | message count, delegation count, participant count, last activity — for **any** channel in **any** tenant |
| `get_channel_message_count(channel_id)` | message volume per channel |
| `get_channel_delegation_count(channel_id)` | delegation volume per channel |

Not message bodies, but a complete traffic-analysis surface over every channel:
who is busy, when they were last active, how many parties are in the room. For
agent-to-agent channels that metadata is itself confidential — and the part-1
migration's table comments assert a protection this walks around.

Three more were granted to `authenticated` and are **write** functions —
`create_qubetalk_channel`, `add_channel_participant`,
`remove_channel_participant`. `add_channel_participant` on an arbitrary
`channel_id` is a self-service grant of read access to someone else's channel.
Being signed in is not membership; that distinction is what leaked.

### 3 (same sweep). `share_analytics` readable by `anon`, no RLS

`20251230_share_analytics.sql` grants `select` to `anon` on `share_analytics`
and three views over it, and never enables RLS. The table holds **`persona_id`**
— a T0 identifier CLAUDE.md forbids serialising anywhere — alongside
`ip_address` and `user_agent`. Anonymous read of a T0 identifier correlated with
PII, over PostgREST, requiring no credential.

Fixed here because it is the same defect class, found while sweeping for it, and
it is live. Every application read goes through `/api/analytics/*` under the
service role, so revoking `anon` changes no working surface.

---

## SQL the operator must run

Run this in the Supabase SQL editor. It is `supabase/migrations/20260907000000_qubetalk_security_definer_backdoor_and_anon_analytics.sql`, complete and inline.

```sql
begin;

-- ── A. Close the SECURITY DEFINER bypass ───────────────────────────────────
-- These functions run as their OWNER, so they bypass BOTH the table grants and
-- the deny-by-default RLS established by 20260906000000. That migration's
-- table lockdown does not constrain them at all.

revoke execute on function get_channel_statistics(text)       from anon;
revoke execute on function get_channel_message_count(text)    from anon;
revoke execute on function get_channel_delegation_count(text) from anon;

revoke execute on function get_channel_statistics(text)       from authenticated;
revoke execute on function get_channel_message_count(text)    from authenticated;
revoke execute on function get_channel_delegation_count(text) from authenticated;

revoke execute on function create_qubetalk_channel(text, text, text[])  from authenticated;
revoke execute on function add_channel_participant(text, text)          from authenticated;
revoke execute on function remove_channel_participant(text, text)       from authenticated;

-- set_tenant_context / get_tenant_context set and read the
-- `app.current_tenant_id` GUC that 20260906000000 retired. Nothing calls them;
-- they are the leftover half of the inert-RLS mechanism. Revoked so the dead
-- mechanism cannot be picked up and re-used as though it were load-bearing.
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
```

---

## Task 1 — clients migrated to `personaFetch`

| File:line | Change |
|---|---|
| `components/metame/MetaMeRuntimeClient.tsx:2971` | `fetch("/api/qubetalk/channels?tenant_id=metame")` → `personaFetch("/api/qubetalk/channels", { personaIdHint: activePersonaId })`. **`?tenant_id=` dropped** — the server derives it. |
| `components/qubetalk/QubeTalkConsole.tsx:268,292,313,~540,~556,~578` | all six calls → `personaFetch`. **`?tenant_id=` KEPT** — see below. |
| `components/qubetalk/QubeTalkConsole.tsx:~380` | `EventSource` → `personaFetch` + manual SSE reader. See the SSE decision. |
| `components/composer/DVNReceiptsPanel.tsx:137,232` | → `personaFetch`; **`?tenant_id=` dropped** unless a host explicitly passes one. |
| `app/triad/components/codex/tabs/RelationshipBuilderTab.tsx:1291` | `fetch("/api/marketa/qubetalk")` → `personaFetch(..., { personaIdHint })`. Every other call in this file already used `personaFetch` — this was the odd transport out. |

### Where `?tenant_id=` was kept, and why

**`QubeTalkConsole`** has an operator-facing tenant selector. Naming a tenant
there *is* the deliberate cross-tenant request the gate exists to adjudicate:
honoured for an admin, 403 for everyone else. That is the correct answer for a
console that offers the selector at all. Everywhere else the parameter is gone,
because a client-chosen filter must never read as a scope.

### `DVNReceiptsPanel` — a deliberate behaviour change, flagged

Its `tenantId` prop defaulted to the hardcoded `"tnt_clawhack"`, so every mount
was a cross-tenant read request that nobody had asked for. The default is
removed: with no tenant named, the server derives the caller's own. A host that
genuinely wants another tenant can still pass the prop, and the gate will
adjudicate it. **Consequence:** in ComposerStudio (the only caller, which passes
no tenant), the DVN receipts channel now resolves within the caller's own tenant
rather than `tnt_clawhack`. If those receipts genuinely live under
`tnt_clawhack`, the panel will fall back to local receipts for non-admins. That
is the correct confidentiality posture, but it is a behaviour change worth an
operator eye.

### LockerTab — deliberately left alone

`LockerTab.tsx:258,563` call `/api/qubetalk/passport-channels` and
`/api/qubetalk/channels/bind` with `authedFetchHeaders` + raw `fetch`. Both
routes were already spine-gated before this incident, so **nothing is newly
broken** there. LockerTab is a frozen entry in `tests/persona-spine-fetch.test.ts`'s
`KNOWN_DEBT` with a stated reason (Tier 1 Locker, 10+ call sites, needs live
verification). Converting only its two QubeTalk calls would **mix transports
within one component** — precisely the pattern CLAUDE.md forbids, because the
two transports resolve two different personas and the surface self-contradicts.
It stays whole, as documented debt, for its own focused pass.

---

## The SSE decision

`/api/qubetalk/channels/[id]/stream` is now a spine endpoint, and the spine
authenticates on `Authorization: Bearer` only — `getCallerIdentityContext`
ignores cookies entirely. **`EventSource` cannot set request headers**, so it can
never satisfy that gate. Three options; only one is acceptable:

| Option | Verdict |
|---|---|
| Put the access token in the query string so `EventSource` can carry it | **Rejected.** A bearer credential in a URL lands in access logs, proxy logs and `Referer` headers. A new leak wearing the old one's clothes. |
| Exempt the stream route from the gate | **Rejected.** This route emits **full channel history on connect** (`sendRecentMessages`) — it is the single richest thing to leave open, and exempting it re-opens the anonymous read through a different door. |
| **Read the stream over `fetch`, which does carry the header** | **Chosen.** |

`QubeTalkConsole.startStream` now uses `personaFetch` with
`Accept: text/event-stream` and parses SSE frames off the response body reader.
The trade is that reconnect-on-drop is ours rather than the browser's; the
console surfaces `streamStatus: "error"` and the operator refreshes — which is
what `EventSource.onerror` did here anyway (it closed the source without
retrying). Canaried both ways: no `new EventSource(` in the console, and no
token-shaped query parameter on any QubeTalk URL.

---

## Task 2 — per-route audit

| Route | Before | Action |
|---|---|---|
| `qubetalk/messages` POST | **No auth at all.** Anonymous write of forged agent speech into any channel whose participant ids could be guessed. | **Gated.** Channel now read under the resolved tenant, not `body.tenant_id`. |
| `qubetalk/delegations` GET | **No auth**; `?tenant_id=` was the entire scope. Rows carry task prompts + iQube refs. | **Gated.** Identical defect to the original channel leak. |
| `qubetalk/delegations` POST | **No auth.** Anonymous caller could task any agent in any tenant. | **Gated.** |
| `qubetalk/delegations/[id]` GET | No auth. Reads a module-local `Map` nothing writes to — always 404, inert. | **Gated anyway.** An inert route that returns delegation content the moment someone wires the store up is a leak with a commit's delay on it. |
| `qubetalk/invoke` POST | **No auth.** `assertEnvelope` checks only that `tenantId`/`personaId` are *present*. An anonymous caller could name any identity, run a workflow and post its output into a channel as that identity. | **Gated.** The caller-claimed `personaId` is now **discarded** — the run is attributed to the spine-resolved caller. |
| `qubetalk/peer-channels/**` (7 routes incl. `share`, `copy-to-locker`, `open`) | Already spine-gated via `getActivePersona`; membership + rights enforced in `services/qubetalk/peerChannel`. | **No change — verified, not assumed.** The artifact routes are correct: `copy-to-locker` is recipient-pull only and requires `rights.copyToLocker`; `open` is membership-enforced. |
| `qubetalk/passport-channels` GET | Already spine-gated; scoped by `holder_persona_id`. | No change. |
| `qubetalk/channels/bind` POST | Already spine-gated. | No change. |
| `aa/qubetalk` + `aa/qubetalk/channels` | **Hardcoded `'demo-external-key'`**, duplicated authenticator. | **Fixed** — see finding 1. |
| `marketa/qubetalk`, `.../channels`, `.../transfers` | Authenticated on the **unverified `x-persona-id` header** against a module-level service-role client. Presenting the identifier *was* the authentication. | **Gated** via new `requireMarketaQubeTalkAccess`. Spine resolves the caller; that authenticated persona feeds the unchanged `resolveCrmPersona` tenant mapping. `transfers` was not on the brief but is in the same folder and moves content — included. |

**Nothing was gated blindly.** No route was found that must legitimately stay
open; the one candidate is flagged below rather than changed.

---

## Task 3 — the same shape elsewhere

The root pattern: *an API route trusting a caller-supplied identifier as its
authorization, while the server reads with the service-role key.*

### Flagged, deliberately NOT changed

| Route | Finding | Why not fixed here |
|---|---|---|
| `app/api/mcp/xmtp-bridge` | **No authentication of any kind.** POST writes messages into QubeTalk channels; `?tenant_id=` defaults to `tnt_clawhack`. Imports `qubetalkStore` directly, so it sits outside `/api/qubetalk` and outside this sweep's gate. GET returns config only — **no message content is read back**, so it is not a read leak. | It is an inbound webhook. Gating it needs the credential XMTP actually presents, which is not in this repo. Guessing would break the integration. **Operator: this is an unauthenticated write path into QubeTalk and should be given its own callback secret.** |
| `app/api/composer/experiences`, `composer/sessions`, `composer/localdb`, `pipeline/runs`, `workflows` | No auth; scope taken from `?tenant_id=` or an unverified `envelope`. Same shape. | Outside the QubeTalk incident, and their clients (ComposerStudio) use raw `fetch` — gating them without migrating those clients would repeat exactly the breakage this change is repairing. Needs its own pass. |
| `x-persona-id`-as-auth across `marketa/admin/*`, `marketa/lvb/bridge`, `marketa/campaigns/deploy`, `marketa/performance/aggregate` (~10 routes) | Identical defect to the Marketa QubeTalk routes just fixed. `app/(shell)/marketa/components/bridgeFetch.ts` feeds them a `DEFAULT_PERSONA` constant when none is known. | A wider architectural migration of the whole Marketa surface. Fixing the QubeTalk three was in scope; the rest needs the bridge client migrated in the same pass or the surface goes dark. |
| `crm_franchises`, `tenant_hierarchy_view` (`20260113092500`) | `grant select ... to anon, authenticated`, **no RLS on either**. Tenant/franchise structure readable anonymously over PostgREST. | Business metadata rather than personal data, and I cannot verify from the codebase that no anon-key client reads it. Reported for an operator decision. |

### Inert-GUC policies

The only migrations referencing `current_setting('app.current_tenant_id')` are
`20260113090500_qubetalk_tables.sql` (the original inert policies) and
`20260906000000` (which drops them). **No other table anywhere uses that GUC** —
the inert-RLS pattern was confined to QubeTalk and is now fully retired. The
functions that set and read the GUC are revoked in the SQL above so the dead
mechanism cannot be mistaken for a live one.

---

## Canaries and mutation results

`tests/qubetalk-confidentiality.test.ts` 15 → 37 tests.
`tests/persona-spine-fetch.test.ts` gains `/api/qubetalk/` and
`/api/marketa/qubetalk` on its allowlist — **the test was strengthened, never
weakened**, including a two-step proof chain so a route that delegates to a gate
is proven honest rather than assumed.

**23/23 mutations killed.** Every mutation was verified to have actually changed
the file before its test ran — a no-op mutation is indistinguishable from a
surviving canary.

| # | Mutation (the violation reintroduced) | Result |
|---|---|---|
| 1 | messages: remove the gate entirely | FAIL ✓ |
| 2 | messages: gate awaited, refusal **discarded** | FAIL ✓ |
| 3 | messages: read the channel under the body tenant again | FAIL ✓ |
| 4 | delegations GET: restore caller-supplied tenant scope | FAIL ✓ |
| 5 | delegations/[id]: discard the gate verdict | FAIL ✓ |
| 6 | invoke: trust the caller-claimed `personaId` again | FAIL ✓ |
| 7 | AA: put the demo backdoor key back in the source | FAIL ✓ |
| 8 | AA: accept the demo key at **runtime** (behavioural) | FAIL ✓ |
| 9 | AA: fail **open** when no key is configured | FAIL ✓ |
| 10 | AA: refuse *everything* — proves the accept-case canary is not vacuous | FAIL ✓ |
| 11 | AA: re-declare a local authenticator in a route | FAIL ✓ |
| 12 | Marketa: read `x-persona-id` again | FAIL ✓ |
| 13 | Marketa: gate only **one** of a file's two handlers | FAIL ✓ |
| 14 | Marketa gate: silently re-scope instead of 403 on tenant mismatch | FAIL ✓ |
| 15 | SSE: go back to `EventSource` | FAIL ✓ |
| 16 | SSE: smuggle the bearer token into the URL | FAIL ✓ |
| 17 | migration: drop the anon revoke on `get_channel_statistics` | FAIL ✓ |
| 18 | migration: drop the `add_channel_participant` revoke | FAIL ✓ |
| 19 | migration: drop the `share_analytics` anon revoke | FAIL ✓ |
| 20 | client: raw `fetch` against a QubeTalk spine endpoint | FAIL ✓ |
| 21 | allowlist proof: QubeTalk route stops returning the gate refusal | FAIL ✓ |
| 22 | allowlist proof: the gate stops resolving through the spine | FAIL ✓ |
| 23 | allowlist proof: gate imports the resolver but never awaits it | FAIL ✓ |

### A weak canary caught by mutation testing, and fixed

Mutation 22 **survived on the first run.** The step-2 proof asserted
`/getActivePersona|getCallerIdentityContext/` against the gate's source — so
replacing the real import with a local stub *of the same name* kept the canary
green while gutting the gate. This is the "regex matching a declaration rather
than the thing that matters" shape. The proof now requires an **import from the
canonical module** *and* an `await` of it, and mutations 22 and 23 both kill it.

Worth recording that the canary that survived was one of the *cheap* ones —
written to satisfy a checklist item rather than to catch a specific defect. The
ones written from an actual observed failure all held.

---

## Files changed

**Gates (new):** `app/api/aa/qubetalk/_lib/authenticateExternalAgent.ts`;
`requireMarketaQubeTalkAccess` in `app/api/marketa/qubetalk/_lib.ts`.
**Routes gated:** `qubetalk/{messages,delegations,delegations/[id],invoke}`,
`aa/qubetalk/{route,channels}`, `marketa/qubetalk/{route,channels,transfers}`.
**Clients:** `MetaMeRuntimeClient`, `QubeTalkConsole`, `DVNReceiptsPanel`,
`RelationshipBuilderTab`.
**Migration:** `supabase/migrations/20260907000000_qubetalk_security_definer_backdoor_and_anon_analytics.sql`.
**Tests:** `tests/qubetalk-confidentiality.test.ts`, `tests/persona-spine-fetch.test.ts`,
`tests/backend/api.integration.test.ts`, `scripts/test-backend.js` (the last two
stopped sending the retired demo key).
