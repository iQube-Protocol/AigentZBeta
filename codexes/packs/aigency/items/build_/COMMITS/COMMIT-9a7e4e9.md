# Commit Brief: `9a7e4e9` — sprint 4 — polity passport locker + qubetalk channel bridge

| Field | Value |
|-------|-------|
| SHA | [`9a7e4e9`](https://github.com/iQube-Protocol/AigentZBeta/commit/9a7e4e9f578397e072d455ed38ded2237445f2f2) |
| Author | Claude |
| Date | 2026-06-13T17:37:42Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
sprint 4 — polity passport locker + qubetalk channel bridge

shipped (per 2026-06-13 hackathon plan §sprint 4):

- supabase/migrations/20260613300000_passport_locker_qubetalk.sql
  - passport_locker_items: holder-owned encrypted assets. walrus_blob_id
    + sui_object_id (Sui+Walrus rail). downloadable flag for view-only
    items. storage_mode = stub|sui-walrus. RLS gates reads to owner.
  - passport_locker_grants: per-item grants to bound agents. scope:
    read | read_download (download blocked if item.downloadable=false).
    RLS gates reads to grantor or grantee.
  - passport_qubetalk_channels: citizen<->agent channel pair, idempotent
    per (holder, delegate). created on bounded delegation grant.

- services/passport/lockerStorage.ts — publishLockerItem. mirrors the
  services/persona/mintPersonaToSui.ts pattern: stub-mode IDs derived
  from sha256(ciphertext + iv + auth_tag + holder_public_ref +
  'locker-item-v0.1') when env unset; real sui+walrus path when
  SUI_PACKAGE_ID + WALRUS_PUBLISHER_URL are set AND packages installed.

- GET/POST /api/polity-passport/locker
  - GET returns items + active grants for the active persona. soft-fails
    pre-migration with empty list + migrationPending hint.
  - POST encrypts (or accepts pre-encrypted ciphertext when
    ciphertextProvided=true), publishes via lockerStorage, inserts
    row. T0 discipline: only public_ref derived from persona_id is
    used as the storage commitment input.

- POST /api/polity-passport/locker/grant — caller-owns-item check,
  agent persona lookup via agent_persona table (sprint 3), scope guard
  refuses read_download when item.downloadable=false.
- DELETE /api/polity-passport/locker/grant?grantId=... — revoke,
  scoped to grantor.

- POST /api/qubetalk/channels/bind — idempotent provisioning of the
  citizen<->agent channel. returns the existing active channel if one
  exists, otherwise creates a new row. pre-Sprint-3-agent-persona
  fallback: writes channel with delegated_persona_id = holder as
  placeholder + delegatedPersonaPending: true in response.

- app/triad/components/codex/tabs/LockerTab.tsx — new Locker UI.
  upload form (display name + view-only toggle + file input), items
  list with grants per item, grant action per sponsored agent
  (filtered to read or read_download based on item.downloadable),
  revoke + confirm modal. on grant we also bind the qubetalk channel
  (silent failure tolerated — the grant is the source of truth).

- Locker mounted as first-class tab in:
  - POLITY_PASSPORT_BUREAU_CARTRIDGE (new 'locker' tab group, order 2)
  - AGENTIQ_CARTRIDGE.tabs (agentiq-passport-locker, order 2 in passport)
  - AGENTIQ_OS_CARTRIDGE.tabs (agentiq-os-passport-locker, order 2)
  steward shifts to order 3 in the bureau cartridge.

- TabRenderer wires LockerTab into the dynamic component map.

scope discipline (per plan Decision A): sui+walrus rail only here.
autodrive content (knyt, qripto, etc.) untouched. locker is a brand new
table, not a piggyback on iqube_mint_stubs.

operator step: run migration 20260613300000_passport_locker_qubetalk.sql
in supabase sql editor.
```

## Body

shipped (per 2026-06-13 hackathon plan §sprint 4):

- supabase/migrations/20260613300000_passport_locker_qubetalk.sql
  - passport_locker_items: holder-owned encrypted assets. walrus_blob_id
    + sui_object_id (Sui+Walrus rail). downloadable flag for view-only
    items. storage_mode = stub|sui-walrus. RLS gates reads to owner.
  - passport_locker_grants: per-item grants to bound agents. scope:
    read | read_download (download blocked if item.downloadable=false).
    RLS gates reads to grantor or grantee.
  - passport_qubetalk_channels: citizen<->agent channel pair, idempotent
    per (holder, delegate). created on bounded delegation grant.

- services/passport/lockerStorage.ts — publishLockerItem. mirrors the
  services/persona/mintPersonaToSui.ts pattern: stub-mode IDs derived
  from sha256(ciphertext + iv + auth_tag + holder_public_ref +
  'locker-item-v0.1') when env unset; real sui+walrus path when
  SUI_PACKAGE_ID + WALRUS_PUBLISHER_URL are set AND packages installed.

- GET/POST /api/polity-passport/locker
  - GET returns items + active grants for the active persona. soft-fails
    pre-migration with empty list + migrationPending hint.
  - POST encrypts (or accepts pre-encrypted ciphertext when
    ciphertextProvided=true), publishes via lockerStorage, inserts
    row. T0 discipline: only public_ref derived from persona_id is
    used as the storage commitment input.

- POST /api/polity-passport/locker/grant — caller-owns-item check,
  agent persona lookup via agent_persona table (sprint 3), scope guard
  refuses read_download when item.downloadable=false.
- DELETE /api/polity-passport/locker/grant?grantId=... — revoke,
  scoped to grantor.

- POST /api/qubetalk/channels/bind — idempotent provisioning of the
  citizen<->agent channel. returns the existing active channel if one
  exists, otherwise creates a new row. pre-Sprint-3-agent-persona
  fallback: writes channel with delegated_persona_id = holder as
  placeholder + delegatedPersonaPending: true in response.

- app/triad/components/codex/tabs/LockerTab.tsx — new Locker UI.
  upload form (display name + view-only toggle + file input), items
  list with grants per item, grant action per sponsored agent
  (filtered to read or read_download based on item.downloadable),
  revoke + confirm modal. on grant we also bind the qubetalk channel
  (silent failure tolerated — the grant is the source of truth).

- Locker mounted as first-class tab in:
  - POLITY_PASSPORT_BUREAU_CARTRIDGE (new 'locker' tab group, order 2)
  - AGENTIQ_CARTRIDGE.tabs (agentiq-passport-locker, order 2 in passport)
  - AGENTIQ_OS_CARTRIDGE.tabs (agentiq-os-passport-locker, order 2)
  steward shifts to order 3 in the bureau cartridge.

- TabRenderer wires LockerTab into the dynamic component map.

scope discipline (per plan Decision A): sui+walrus rail only here.
autodrive content (knyt, qripto, etc.) untouched. locker is a brand new
table, not a piggyback on iqube_mint_stubs.

operator step: run migration 20260613300000_passport_locker_qubetalk.sql
in supabase sql editor.

## Files Changed

| Change | File |
|--------|------|
| Added | `app/api/polity-passport/locker/grant/route.ts` |
| Added | `app/api/polity-passport/locker/route.ts` |
| Added | `app/api/qubetalk/channels/bind/route.ts` |
| Modified | `app/triad/components/codex/TabRenderer.tsx` |
| Added | `app/triad/components/codex/tabs/LockerTab.tsx` |
| Modified | `data/codex-configs.ts` |
| Added | `services/passport/lockerStorage.ts` |
| Added | `supabase/migrations/20260613300000_passport_locker_qubetalk.sql` |

## Stats

 8 files changed, 1289 insertions(+), 1 deletion(-)
