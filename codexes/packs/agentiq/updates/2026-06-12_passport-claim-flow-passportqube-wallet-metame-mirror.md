# 2026-06-12 — Passport claim flow, PassportQube wallet, registry filters in tier-3, metaMe mirror

Session branch: `claude/optimistic-davinci-exiykx` (continuation batch)
Commits: `30610ff3` (claim flow + wallet + registry filters), `9ef189b8`
(metaMe mirror tab), `04745f93` (claim POST ownership gate), `a3c6298b`
(pre-migration graceful fallback)

Operator requests addressed:

1. Passport class filters belong in the tier-3 sub-menu row of the Registry tab
2. A claim modal + flow so an approved passport can be claimed as a W3C VC and stored in the holder's wallet (or their bounded agent persona's wallet) as a PassportQube
3. Polity Passport missing from the AgentiQ OS activation inside the metaMe Cartridge

---

## 1. Registry class filters → tier-3 sub-menu row

`PassportRegistryTab` always portaled its class filter chips (All / Citizens /
Agents / Robots / Organizations) into `SubHeaderSlotContext`, but the slot
never mounted: the Registry tab in both AgentiQ cartridges carried a
`subTabs` getter that resolved to a single redundant entry (the Bureau's own
registry tab), and `CodexPanelDynamic` renders subTabs INSTEAD of the slot
when `activeSubTabs.length > 0`.

Fix: removed the `subTabs` getter from the Registry tab in both
`AGENTIQ_CARTRIDGE` and `AGENTIQ_OS_CARTRIDGE` (`data/codex-configs.ts`).
Apply and Steward keep their getters. With the slot free, the filter chips
render left-justified on the tier-3 row.

**Pattern note:** a `subTabs` array with one entry that duplicates the parent
tab buys nothing and silently blocks the SubHeaderSlot portal. Don't mirror
single-tab groups as subTabs.

## 2. Passport claim flow → PassportQube in the wallet

The Phase A credential endpoint existed (`GET
/api/polity-passport/credential/[passportId]`, lazy W3C-VC issuance) but had
no UI and no claim state. Shipped the full loop:

- **Migration** `supabase/migrations/20260612100000_passport_credential_claimed.sql`
  — adds `credential_claimed_at timestamptz` to `polity_passport_records`
  (+ partial index). **Must be run in Supabase** before claim state persists.
- **`POST /api/polity-passport/credential/[passportId]`** — claims the
  credential: same claimability gate as GET (citizen active/renewal_due;
  participant approved/provisionally_issued/restricted and not revoked),
  stamps `credential_claimed_at`, returns the VC. GET now also returns
  `claimed: boolean`.
- **`GET /api/polity-passport/wallet`** — spine-authenticated
  (`getActivePersona`); returns ALL passport records for the active persona
  with claim state + lazily built credential for claimed ones. Because it
  keys off `persona_id`, a bounded agent persona sees its own participant
  passport when active — no separate agent-wallet path needed.
- **`PassportClaimModal`** (`app/triad/components/codex/tabs/PassportClaimModal.tsx`)
  — preview → claim → claimed states; VC JSON display, copy, download
  (`passport-<id>.vc.json`). Claim POST goes through `personaFetch`.
- **Registry tab claim affordance** — the tab cross-references the public
  registry against the caller's own passports (wallet endpoint): claimable →
  pulsing violet "Claim" pill; already claimed → emerald "In Wallet" pill;
  both open the modal.
- **SmartWalletDrawer iQube tab** — new "PassportQube — Verifiable
  Credentials" section under PersonaQube: claimed credentials with class,
  status, grade, claim date, expand-to-view VC JSON, download.

T0 rule holds throughout: the credential and wallet projections carry only
commitment refs (`kybe_did_public_ref`, `persona_public_ref`) — never
`persona_id` / `kybe_identity_id` / `root_identity_id` in browser JSON.

Env: `PASSPORT_BUREAU_CREDENTIAL_SECRET` added to the
`create-env-production.js` allowlist. Unset ⇒ envelopes issue with an
explicit `PolityBureauUnsignedStub/v0` proof (functional, not
integrity-proofed). Phase C replaces the HMAC stub with an asymmetric proof.

## 3. metaMe Cartridge — Polity Passport in the agentiqos mirror

The metaMe Cartridge mirrors each AgentiQ OS tab group as a top-level entry
in its `agentiqos` group (aigentZ 40 … Governance 45, Operations 46,
Ecosystem 47), but the passport group was never added to the mirror set —
so the menu existed in the standalone AgentiQ OS cartridge but not in the
metaMe Activations rendering of it.

Fix: added `agentiqos-passport` at order 45.5 (between Governance and
Operations) with `subTabs: aiqOsTabsByGroup('passport')`, the same mirror
pattern as every other agentiqos tab.

**Steward stays admin-gated through the mirror:** the source tab carries
`adminOnly: true`, and both subTab filters in `CodexPanelDynamic`
(`activeSubTabs` and the tier-4 filter) drop `adminOnly` tabs for
non-admins. No clone-side flag needed.

**Pattern note (mirror checklists):** when a source cartridge gains a new
tab group, every mirror of that cartridge must be extended by hand —
`aiqOsTabsByGroup` only fills subTabs of mirror entries that already exist.
Mirrors of AgentiQ OS live in metaMe's `agentiqos` group; check there first
when "tab shows in cartridge X but not in metaMe".

---

## 4. Self-audit follow-ups (same session)

**Claim POST ownership gate (`04745f93`).** The claim POST shipped without
caller verification — anyone knowing (or enumerating) a passportId could
stamp another holder's `credential_claimed_at`. Now: 401 without an active
persona; 403 when the record's `persona_id` binding doesn't match the
caller. Records with no persona binding keep Phase A capability-URL
semantics for authenticated callers (externally-held agent passports).
`persona_id` is selected server-side for the gate only and never
serialises (T0). The preview GET stays public by design — the envelope is
public-safe. The wallet claim flow already used `personaFetch`, so the
legitimate path is unaffected.

**Pre-migration graceful fallback (`a3c6298b`).** The claim-flow commit
made every credential/wallet SELECT reference `credential_claimed_at`,
and Postgres fails the whole query on an unknown column — so the
previously-working public credential GET (Marketa scorecard claim link,
live since Phase A) and the wallet endpoint 500'd on dev until the
migration ran. Both routes now retry with the legacy column set when the
column is missing: GET serves the envelope with `claimed: false`, wallet
lists passports as unclaimed (claim pills still render), and the claim
POST returns 503 naming the migration file.

**Deploy-order lesson:** when a route gains a column that ships in a
migration the operator applies by hand, the route must degrade gracefully
until the migration runs — a new column in a SELECT is a breaking change
for every existing caller of that route, not just the new feature.

---

## Operator actions

1. Run the migration in the Supabase SQL editor:
   ```sql
   ALTER TABLE polity_passport_records
     ADD COLUMN IF NOT EXISTS credential_claimed_at timestamptz;

   CREATE INDEX IF NOT EXISTS idx_pp_records_claimed
     ON polity_passport_records(credential_claimed_at)
     WHERE credential_claimed_at IS NOT NULL;
   ```
2. Set `PASSPORT_BUREAU_CREDENTIAL_SECRET` in Amplify (generate locally):
   ```bash
   openssl rand -hex 32
   ```
