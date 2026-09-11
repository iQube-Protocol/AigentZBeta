# 2026-06-13 — Hackathon submission build complete (Sprints 1–7)

Session branch: `claude/optimistic-davinci-exiykx`

Commits (in order):
- Sprint 1 — UI badge + PersonaQube Sui+Walrus mint: `8a41c018`, `554aab04`
- Sprint 2 — World ID strong verification: `25260ebb`
- Sprint 3 — Agent Genesis + sponsored agents wallet + wizard: `88194cc4`, `69905ac5`
- Sprint 4 — Locker + QubeTalk channel bridge: `9a7e4e9f`
- Sprint 5 — Delegation tab + AgentKit attestation bridge: `e86dfe4a`
- Sprint 6 — Partial ProveKit (personhood + delegation): `16d854f4`
- Sprint 7 — ENS via Namestone: `23713004`

Plan reference: `/root/.claude/plans/recursive-swinging-ladybug.md` (also captured here for posterity in §Architecture below).

---

## What shipped

### Sprint 1 — UI polish + PersonaQube Sui+Walrus mint
- Citizen / Participant Application badge moved to the tier-3 row, right-justified, via `SubHeaderSlotContext` portal pattern from PassportRegistryTab. Removed single-entry `subTabs` getters in both `AGENTIQ_CARTRIDGE` and `AGENTIQ_OS_CARTRIDGE` apply tabs (same blocker pattern as the registry chips fix on 2026-06-12).
- `services/persona/mintPersonaToSui.ts` — Sui+Walrus mint pipeline. Stub mode (deterministic IDs from sha256 of encrypted payload) ships today; real mode wires when `SUI_PACKAGE_ID + WALRUS_PUBLISHER_URL` set AND `@mysten/sui` + `@mysten/walrus` installed.
- `POST/GET /api/iqube/persona/passport/mint` — spine-authenticated mint route, distinct from the deprecated Qripto/KNYT AutoDrive paths.
- `SmartWalletDrawer.tsx` — PersonaQube section transitions from "Staging…" → "Minted" with Sui object id + Walrus blob id, pre-loads existing mint on mount.
- Migration: `20260613000000_persona_qube_mints.sql`.

### Sprint 2 — World ID strong verification
- `services/passport/personhoodProof.ts` — extends with `verifyWorldIdProof` (Worldcoin Cloud Verifier). Dev fallback accepts `dev-worldid-{orb,device}` tokens.
- Migration `20260613100000_passport_world_id_verification.sql` — adds `world_id_nullifier_hash` UNIQUE (enforces one-human-one-passport), `world_id_verification_level`, `world_id_verified_at`.
- `POST /api/polity-passport/verify-worldid` — ownership-gated, distinct error shapes (23505 dup, missing-column 503, 4xx provider errors).
- `SmartWalletDrawer` PassportQube cards — "Upgrade with World ID" CTA on citizen passports, dynamic IDKit lazy-import fallback, "World ID Verified" sky badge on success.
- Non-verified passports remain first-class (PRD §6.1 contract preserved).

### Sprint 3 — Agent Genesis + sponsored agents wallet surface + wizard
- Migration `20260613200000_agent_genesis_polity_bound.sql` — extends `agent_root_identity.agent_class` enum with `polity_bound` / `polity_autonomous`. Adds `sponsor_passport_id`, `sponsor_persona_id`, `agent_card_url`, `agent_card_slug` (UNIQUE), `bound_passport_id`.
- `POST /api/agents/genesis` — citizen-passport-gated, slug validation, polity_autonomous rejected from citizen path (admin governance only).
- Dynamic card publisher `GET /api/agents/[id]/agent-card.json` — reads `agent_root_identity` by slug, renders A2A shape. Hand-curated cards (`/api/agents/aletheon`) still take precedence.
- `GET /api/persona/sponsored-agents` — joins agents to their bound passports, surfaces `worldIdVerified` flag.
- `SmartWalletDrawer` iQube tab — new "AgentQubes — Bound Delegates" section: agent class chip, description, passport status, World ID badge, View Agent Card link, did_uri.
- `PassportBureauApplyTab` — Genesis path inside the participant flow. User picks "Genesis a new agent" → enters display name + slug + sponsor passport id → backend provisions the card URL and auto-fills the rest of the submit flow.

### Sprint 4 — Locker + QubeTalk channel bridge
- Migration `20260613300000_passport_locker_qubetalk.sql` — three tables:
  - `passport_locker_items` (walrus_blob_id, sui_object_id, downloadable, storage_mode)
  - `passport_locker_grants` (per-item, scope: read | read_download, scoped revoke)
  - `passport_qubetalk_channels` (idempotent per holder↔delegate pair)
- `services/passport/lockerStorage.ts` — `publishLockerItem`, same dual-mode (stub | sui-walrus) pattern as the PersonaQube mint service.
- `GET/POST /api/polity-passport/locker` — list items + grants, upload (accepts plaintext+server-encrypt OR client-encrypted+ciphertext).
- `POST/DELETE /api/polity-passport/locker/grant` — scope guard refuses `read_download` when item.downloadable=false; revoke is grantor-scoped.
- `POST /api/qubetalk/channels/bind` — idempotent channel provisioning; pre-Sprint-3-agent-persona fallback writes channel with delegated_persona_id = holder + `delegatedPersonaPending: true`.
- `LockerTab.tsx` — first-class Passport tab. Upload form (display name + view-only toggle), items grid with per-item grants + revoke + confirm modal, grant flow auto-binds QubeTalk channel.
- Locker mounted in `POLITY_PASSPORT_BUREAU_CARTRIDGE`, `AGENTIQ_CARTRIDGE`, and `AGENTIQ_OS_CARTRIDGE`. TabRenderer registration added.

### Sprint 5 — Delegation tab in Passport + AgentKit attestation bridge
**Architecture contract:** AgentKit operates WITHIN the bounded-delegation framework, never replacing it. Our framework remains the source of truth for who-delegates-to-whom; AgentKit attaches a cryptographic attestation on top.
- Migration `20260613400000_delegation_agentkit_attestations.sql` — receipt table for attestations, additive (no changes to the existing delegation grant tables).
- `services/delegation/agentKitBridge.ts` — `issueAgentKitAttestation` + `verifyAgentKitAttestation`. Stub mode emits a JWT-shape token (base64 payload + 'agentkit-stub' + HMAC sig) keyed off `AGENTKIT_STUB_KEY` so the verify endpoint can recompute deterministically.
- `POST /api/access/delegation/agentkit-attest` — issues attestation; fetches sponsor's World ID nullifier through to the payload so verifiers see `verified_human=true` when applicable.
- `GET /api/access/delegation/agentkit-attest?token=<...>` — public verifier.
- `BoundedDelegationTab` mounted as first-class Passport tab in all three cartridges. No fork — reuses existing component.

### Sprint 6 — Partial ProveKit (personhood + delegation authority)
- `services/proof/provekit/index.ts` — `generateProveKitProof` (typed overloads per circuit) + `verifyProveKitProof`. Supported circuits emit `provekit:<circuit>:stub:<hash>.<sig>` tokens recomputable by the verifier. Phase B circuits (`passport_standing`, `document_possession`, `mobility_authorization`) return shaped placeholders with `notYetImplemented=true`.
- `POST /api/polity-passport/attest/[type]` — spine-auth; personhood validates citizen + active + claimed + ownership and threads World ID nullifier into the proof input; delegation_authority validates sponsor ownership + agent did lookup.
- `POST /api/polity-passport/verify/[type]` — public CORS-enabled. Phase B circuits return `valid=false notYetImplemented=true` with explanatory note.

### Sprint 7 — ENS via Namestone (gasless L2 subnames)
- Migration `20260613500000_persona_ens_names.sql` — `persona_ens_names` + `locker_ens_names`. ens_full UNIQUE across platform.
- `services/identity/namestoneClient.ts` — Namestone REST client. Stub mode (no API key) emits Namestone-shape response with `stub:true`.
- `POST /api/identity/persona/[id]/ens` — ownership-gated, label validated `^[a-z][a-z0-9-]{2,40}$`. ENS resolves to a public commitment hash, NEVER persona_id.
- `GET /api/identity/persona/[id]/ens` — holder lookup.
- `GET /api/identity/resolve-ens/[name]` — public + CORS-enabled reverse resolver. Returns `persona_public_ref` (T1 commitment) for persona ENS; withholds publicRef for locker ENS (only the bound delegate can map via QubeTalk).

---

## Architecture decisions captured this session

### A. Sui+Walrus rail — Passport stack only
Sui+Walrus is the canonical rail for Passports, Lockers, and PersonaQube mints. AutoDrive remains the canonical rail for content (KNYT, Qripto, etc.) — no rip-and-replace. Dual-rail by design; mixed routing inside one surface creates UX confusion.

### B. AgentKit operates within the bounded-delegation framework
**Critical contract.** AgentKit does not replace anything. Our `BoundedDelegationTab` + `agentiq-os/delegation` + `agent_persona.delegation_user_root_id` + `delegation_scopes` stay authoritative for the WHO/WHAT/WHEN. AgentKit attaches a cryptographic attestation on top so downstream verifiers can confirm "this delegation came from a verified human" without learning who. When sponsor isn't World ID verified, the grant remains valid — attestation just doesn't carry the `verified_human` flag.

Composition:
- Citizen → agent binding is OUR primitive.
- World ID is the personhood input.
- AgentKit is the proof carrier + policy enforcer at runtime.
- The three compose: framework + World ID + AgentKit = "verified citizen → polity-bound agent".

### C. Agent RootDID binding model
Agents have RootDIDs (not KybeDIDs — only humans get KybeDIDs). Default class for any new user-sponsored agent: `polity_bound`. The RootDID is owned operationally by the sponsoring citizen's persona+passport. Only admin governance (`POST /api/governance/agent/decouple`, Phase B) can flip to `polity_autonomous`.

### D. Human vs Agent flow asymmetry
| Step | Citizen (Human) | Agent (Participant) |
|---|---|---|
| 1 | Persona auto-created with generic name | — |
| 2 | Apply for Citizen Passport (CAPTCHA) | Human sponsor opens Genesis |
| 3 | Passport issued + claimed | Agent Card built (wizard or URL) |
| 4 | Personalize persona (optional) | Participant Passport issued |
| 5 | Mint persona to Sui+Walrus (optional) | Agent persona created (RootDID, bound to sponsor) |
| 6 | Mint ENS name (optional) | Agent claims Passport VC |
| 7 | Upgrade to World ID Verified (optional, anytime) | Agent persona minted to Sui+Walrus (optional) |
| 8 | — | Agent persona gets ENS name (optional) |

Anonymity is default throughout. ENS is a surface label; the citizen↔agent relationship stays obfuscated via DVN T0→T2 + ProveKit even after ENS claim.

---

## Operator actions before testing the full demo

### 1. Run all migrations in the Supabase SQL editor (in order)

```sql
-- (run each file's full contents — they're all idempotent IF NOT EXISTS guarded)
-- 20260613000000_persona_qube_mints.sql
-- 20260613100000_passport_world_id_verification.sql
-- 20260613200000_agent_genesis_polity_bound.sql
-- 20260613300000_passport_locker_qubetalk.sql
-- 20260613400000_delegation_agentkit_attestations.sql
-- 20260613500000_persona_ens_names.sql
```

### 2. Set env vars (Amplify)

All stub modes work out-of-the-box. Set these when you want to leave stub:

```bash
# PersonaQube descriptor encryption (32 bytes = 64 hex chars)
openssl rand -hex 32   # → PERSONA_IQUBE_ENCRYPTION_KEY

# Sui + Walrus (real on-chain mint)
SUI_NETWORK            # 'testnet' or 'mainnet'
SUI_PACKAGE_ID         # deployed persona-qube Move package
SUI_SPONSOR_KEY        # sponsor signer
WALRUS_PUBLISHER_URL
WALRUS_AGGREGATOR_URL

# World ID
WORLD_ID_APP_ID        # from developer.worldcoin.org
WORLD_ID_ACTION_ID     # action slug
NEXT_PUBLIC_WORLD_ID_APP_ID
NEXT_PUBLIC_WORLD_ID_ACTION_ID

# AgentKit
AGENTKIT_API_KEY
AGENTKIT_POLICY_ID
AGENTKIT_ATTEST_URL
AGENTKIT_STUB_KEY      # for stub-mode deterministic signing

# ProveKit
PROVEKIT_API_KEY
PROVEKIT_CIRCUIT_REGISTRY

# Namestone (L2 ENS)
NAMESTONE_API_KEY
NAMESTONE_API_BASE     # defaults to https://namestone.com/api/public_v1
ENS_PARENT_NAME        # defaults to polity.eth
```

### 3. Install npm packages when ready to leave stub mode

```bash
npm install @worldcoin/idkit @mysten/sui @mysten/walrus
# AgentKit + ProveKit npm packages TBD (check World/ProveKit docs)
```

### 4. Smoke-test the end-to-end demo

1. **Citizen genesis**: Apply tab → CAPTCHA → Citizen Passport issued → claim VC.
2. **Persona personalization**: Wallet → persona edit → rename to "First Citizen".
3. **Mint PersonaQube**: Wallet → iQube tab → "Mint PersonaQube" → Sui object id + Walrus blob id appear.
4. **World ID upgrade**: PassportQube card → "Upgrade with World ID" → World ID Verified badge.
5. **Agent genesis**: Apply tab → Participant → "Genesis a new agent" → Aletheon + slug → submit application.
6. **Sponsored agents visibility**: Wallet → iQube tab → "AgentQubes — Bound Delegates" → Aletheon listed.
7. **Bounded delegation + AgentKit**: Delegation tab → grant Aletheon → attest via `/api/access/delegation/agentkit-attest`. Token includes `verified_human: true` because First Citizen is World ID verified.
8. **Locker**: Locker tab → upload encrypted item → grant Aletheon read access → QubeTalk channel auto-binds.
9. **ProveKit personhood + delegation**: `POST /api/polity-passport/attest/proof_of_personhood` returns ZK token; verify endpoint confirms commitment without revealing PII.
10. **ENS**: Persona settings → claim `first-citizen.polity.eth`. Public resolver returns commitment ref, never persona_id.

---

## Sprint scope (final)

| Sprint | Plan days | Status |
|---|---|---|
| 1 — UI + PersonaQube mint | 2 | shipped |
| 2 — World ID | 3 | shipped |
| 3 — Agent genesis + persona + wizard | 5 | shipped (re-anchor script: operator one-off, deferred) |
| 4 — Locker + QubeTalk | 5 | shipped |
| 5 — Delegation tab + AgentKit | 3 | shipped |
| 6 — Partial ProveKit | 4 | shipped (personhood + delegation; 3 Phase B placeholders return notYetImplemented) |
| 7 — ENS (Namestone) | 4 | shipped |
| **Total** | **26 days** | **All shipped on 2026-06-13** |

### Phase B (post-submission)
- 3 remaining ProveKit circuits (`proof_of_passport_standing`, `proof_of_document_possession`, `proof_of_mobility_authorization`)
- Aletheon re-anchor one-off script (`scripts/reanchor-agent-passport.ts`) — to re-point her existing `polity_passport_records` row from First Citizen's persona to her own once Sprint 3 ships her agent persona
- Real Sui/Walrus publisher wiring (install packages + replace `realWalrus*` / `realSui*` TODO stubs)
- Real AgentKit + ProveKit SDK wiring (TBD on canonical package names)
- ENS L1 production naming (Sprint 7 ships L2 via Namestone)
- Polity governance flow for `polity_autonomous` agent decoupling (`POST /api/governance/agent/decouple`)

---

## Files touched

### New
- `services/persona/mintPersonaToSui.ts`
- `services/passport/lockerStorage.ts`
- `services/delegation/agentKitBridge.ts`
- `services/proof/provekit/index.ts`
- `services/identity/namestoneClient.ts`
- `app/api/iqube/persona/passport/mint/route.ts`
- `app/api/polity-passport/verify-worldid/route.ts`
- `app/api/polity-passport/locker/route.ts`
- `app/api/polity-passport/locker/grant/route.ts`
- `app/api/polity-passport/attest/[type]/route.ts`
- `app/api/polity-passport/verify/[type]/route.ts`
- `app/api/qubetalk/channels/bind/route.ts`
- `app/api/access/delegation/agentkit-attest/route.ts`
- `app/api/agents/genesis/route.ts`
- `app/api/agents/[id]/agent-card.json/route.ts`
- `app/api/persona/sponsored-agents/route.ts`
- `app/api/identity/persona/[id]/ens/route.ts`
- `app/api/identity/resolve-ens/[name]/route.ts`
- `app/triad/components/codex/tabs/LockerTab.tsx`
- Six migration files in `supabase/migrations/`

### Modified
- `data/codex-configs.ts` — apply badge subTabs removal + locker + delegation tabs in three cartridges
- `app/triad/components/codex/tabs/PassportBureauApplyTab.tsx` — tier-3 badge portal + Genesis wizard path
- `app/triad/components/codex/TabRenderer.tsx` — LockerTab registration
- `app/components/content/SmartWalletDrawer.tsx` — PersonaQube mint UI + World ID upgrade UI + sponsored agents section
- `services/passport/personhoodProof.ts` — World ID verifier added behind existing interface
- `scripts/create-env-production.js` — 11 new env var keys
- `app/api/agents/aletheon/route.ts` — apostrophe regression fix (double-quoted strings)

### Pattern notes
- **Dual-mode (stub | live) services** — every external integration (Sui+Walrus, World ID, AgentKit, ProveKit, Namestone) ships with a stub publisher that produces deterministic IDs from sha256 of the input. The flow completes end-to-end today; real wiring is gated behind env vars + npm package install. Mirrors the pattern set by `mintPersonaToSui.ts`.
- **Pre-migration graceful degradation** — every new route that references a new column or table returns 503 with the migration filename when the column is missing, never a 500.
- **T0 discipline** — every new endpoint queries persona_id server-side for ownership checks but NEVER serialises it in any response. Public commitment refs (sha256 hash, 16-char prefix) are the only identity surface that travels out.
