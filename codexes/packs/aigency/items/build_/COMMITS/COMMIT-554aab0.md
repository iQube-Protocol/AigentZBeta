# Commit Brief: `554aab0` — sprint 1 step 2 — complete PersonaQube mint to Sui+Walrus (stub mode pending packages)

| Field | Value |
|-------|-------|
| SHA | [`554aab0`](https://github.com/iQube-Protocol/AigentZBeta/commit/554aab0458621779a92d90e3adfcc1722744dde3) |
| Author | Claude |
| Date | 2026-06-13T16:34:57Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
sprint 1 step 2 — complete PersonaQube mint to Sui+Walrus (stub mode pending packages)

shipped (per 2026-06-13 hackathon plan):

- services/persona/mintPersonaToSui.ts — Sui+Walrus mint pipeline with stub
  publisher. when SUI_PACKAGE_ID + WALRUS_PUBLISHER_URL are unset the
  service emits deterministic fake IDs derived from sha256(encrypted
  payload + commitment refs). when set AND @mysten/sui + @mysten/walrus
  are installed the real publishers fire (TODO stubs in the same file
  show the call shape). T0 discipline: persona_id never serialises.

- supabase/migrations/20260613000000_persona_qube_mints.sql — new table
  for the Passport mint rail. distinct from iqube_mint_stubs (AutoDrive
  rail, KNYT/Qripto). RLS gates reads to the owning persona. unique
  index per persona — re-mints upsert in place.

- POST /api/iqube/persona/passport/mint — spine-authenticated route.
  builds public-safe descriptor (commitment refs only), encrypts with
  AES-256-GCM under PERSONA_IQUBE_ENCRYPTION_KEY, calls
  mintPersonaToSui, upserts persona_qube_mints row.
- GET /api/iqube/persona/passport/mint — returns existing mint state so
  the wallet drawer renders 'minted' on load without a re-mint.

- SmartWalletDrawer 'PersonaQube — On-Chain Identity' section:
  - replaces the half-done qripto staging path with the new passport
    route. button label transitions 'Mint PersonaQube' → 'Minting…' →
    minted card with Sui object id, Walrus blob id, and a stub-mode
    warning when on_chain=false.
  - on mount fetches the current mint via GET and pre-renders 'minted'
    when applicable.

- scripts/create-env-production.js — adds SUI_NETWORK, SUI_PACKAGE_ID,
  SUI_SPONSOR_KEY, WALRUS_PUBLISHER_URL, WALRUS_AGGREGATOR_URL, and
  PERSONA_IQUBE_ENCRYPTION_KEY to the allowlist.

drive-by fix: app/api/agents/aletheon/route.ts had unescaped
apostrophes in single-quoted strings ('The First Citizen's …') from
the previous edit — converted to double-quoted strings so the build
type-checks clean.

operator steps to enable on-chain mint:
1. set SUI_PACKAGE_ID, WALRUS_PUBLISHER_URL (and optionally _AGGREGATOR_URL)
   in amplify
2. install @mysten/sui + @mysten/walrus
3. wire the realSuiCreate / realWalrusPublish stubs in
   services/persona/mintPersonaToSui.ts (TODOs include shape)
4. run the migration in supabase sql editor
```

## Body

shipped (per 2026-06-13 hackathon plan):

- services/persona/mintPersonaToSui.ts — Sui+Walrus mint pipeline with stub
  publisher. when SUI_PACKAGE_ID + WALRUS_PUBLISHER_URL are unset the
  service emits deterministic fake IDs derived from sha256(encrypted
  payload + commitment refs). when set AND @mysten/sui + @mysten/walrus
  are installed the real publishers fire (TODO stubs in the same file
  show the call shape). T0 discipline: persona_id never serialises.

- supabase/migrations/20260613000000_persona_qube_mints.sql — new table
  for the Passport mint rail. distinct from iqube_mint_stubs (AutoDrive
  rail, KNYT/Qripto). RLS gates reads to the owning persona. unique
  index per persona — re-mints upsert in place.

- POST /api/iqube/persona/passport/mint — spine-authenticated route.
  builds public-safe descriptor (commitment refs only), encrypts with
  AES-256-GCM under PERSONA_IQUBE_ENCRYPTION_KEY, calls
  mintPersonaToSui, upserts persona_qube_mints row.
- GET /api/iqube/persona/passport/mint — returns existing mint state so
  the wallet drawer renders 'minted' on load without a re-mint.

- SmartWalletDrawer 'PersonaQube — On-Chain Identity' section:
  - replaces the half-done qripto staging path with the new passport
    route. button label transitions 'Mint PersonaQube' → 'Minting…' →
    minted card with Sui object id, Walrus blob id, and a stub-mode
    warning when on_chain=false.
  - on mount fetches the current mint via GET and pre-renders 'minted'
    when applicable.

- scripts/create-env-production.js — adds SUI_NETWORK, SUI_PACKAGE_ID,
  SUI_SPONSOR_KEY, WALRUS_PUBLISHER_URL, WALRUS_AGGREGATOR_URL, and
  PERSONA_IQUBE_ENCRYPTION_KEY to the allowlist.

drive-by fix: app/api/agents/aletheon/route.ts had unescaped
apostrophes in single-quoted strings ('The First Citizen's …') from
the previous edit — converted to double-quoted strings so the build
type-checks clean.

operator steps to enable on-chain mint:
1. set SUI_PACKAGE_ID, WALRUS_PUBLISHER_URL (and optionally _AGGREGATOR_URL)
   in amplify
2. install @mysten/sui + @mysten/walrus
3. wire the realSuiCreate / realWalrusPublish stubs in
   services/persona/mintPersonaToSui.ts (TODOs include shape)
4. run the migration in supabase sql editor

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/api/agents/aletheon/route.ts` |
| Added | `app/api/iqube/persona/passport/mint/route.ts` |
| Modified | `app/components/content/SmartWalletDrawer.tsx` |
| Modified | `scripts/create-env-production.js` |
| Added | `services/persona/mintPersonaToSui.ts` |
| Added | `supabase/migrations/20260613000000_persona_qube_mints.sql` |

## Stats

 6 files changed, 510 insertions(+), 22 deletions(-)
