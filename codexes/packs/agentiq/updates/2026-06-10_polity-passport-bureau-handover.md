# Polity Passport Bureau — Workstream Handover

**Date:** 2026-06-10
**Branch:** `claude/polity-passport-bureau-mMqNv`
**Handed over by:** Claude Code session (DVN pipeline + canister ops session, branch `claude/dreamy-gates-mMqNv`)
**Status:** Workstream kickoff — requirements to be supplied by operator

---

## 1. What this workstream is

"Polity Passport Bureau" is a new workstream named by the operator. No product
spec exists in the repo yet — **do not invent requirements; get them from the
operator before writing code.** What CAN be grounded from the codebase:

- **The Polity** is the Agentic Polity — the constitutional, civic-diplomatic
  layer of the platform. Metayé is its agentic emissary
  (`app/data/personas.ts:249` — "Agentic Emissary of the Polity"), operating
  under delegated, bounded, auditable, revocable authority subject to law,
  user consent, iQube policy, DiDQube identity constraints, and DVN receipts.
- **The Passport** maps to the Root DiD in the identity architecture:
  - `docs/IDENTITY_ARCHITECTURE.md:157` — "Root DID = Your passport (ONE identity)"
  - `codexes/packs/agentiq/items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md:258` —
    Root DiD ≈ passport / driving licence: mutable, reissuable.
  - Same doc, line 335: "A kybe_DiD is to a Root DiD what a birth certificate
    is to a passport: one is the unchanging fact of personhood, the other is
    the renewable instrument of presentation."
- **Bureau** therefore plausibly means an issuance/management surface for
  Polity identity credentials (Root DiD passports) — but confirm scope,
  surfaces, and phase with the operator first.

### Required reading before any code

1. `codexes/packs/agentiq/items/AIGENT_DIDQUBE_IDENTITY_UPGRADE_NOTE.md` — the
   DiDQube layered identity model (kybe_DiD → Root DiD → personas)
2. `docs/IDENTITY_ARCHITECTURE.md` — current identity architecture
3. `codexes/packs/knyt/items/KNYT_AGENT_ONBOARDING_CONSTITUTIONAL_PILOT_FRAMEWORK.md`
   — the constitutional pilot framework ("a micro-polity of the emerging
   agentic internet")
4. `app/data/personas.ts` (Metayé section) — the Polity emissary's mandate
   and constraints
5. `CLAUDE.md` — every PARAMOUNT section, especially the Identity & Access
   Spine and DVN Pipeline Protection

---

## 2. Non-negotiable rules that bind this workstream

This workstream sits directly on top of identity and provenance
infrastructure, so the strictest repo rules all apply:

### Identity & Access Spine (PARAMOUNT)

- Every identity/asset/gating/rewards touchpoint flows through the spine:
  `getActivePersona(request)`, `userOwnsAsset()`, `evaluateAccess()`. Never
  build parallel resolvers.
- **Identifier tiers — never mix:** T0 (`personaId`, `authProfileId`,
  `rootDid`, `fioHandle`, `kybeAttestation`) is server-only and must NEVER
  appear in browser-bound JSON or chain-bound receipts. T1
  (`personaSessionToken`, `displayLabel`) is browser-safe. T2
  (`cohortAliasCommitment`, `cohortId`) is the only tier allowed in receipts.
  **A "passport" surface is exactly where T0 leakage is most tempting —
  `rootDid` is T0. The passport UI must present via T1/T2 derivatives, never
  the raw Root DiD.**
- Client-side calls to spine routes MUST use `personaFetch` from
  `utils/personaSpine` — raw `fetch` returns 401 silently.
- Files requiring operator approval to modify:
  `services/identity/getActivePersona.ts`,
  `services/identity/personaSessionToken.ts`,
  `services/access/evaluateAccess.ts`, `services/access/policyResolvers.ts`,
  `services/content/getContentDescriptor.ts`,
  `services/content/encryption.ts`, `services/content/stateCDelivery.ts`,
  `types/access.ts`. Extend by composition, not forking.
- Tests `tests/persona-broadcast-handshake.test.ts` and
  `tests/access-spine.test.ts` enforce the canary pattern — mirror it in any
  new test suite.

### DVN Pipeline Protection (PARAMOUNT)

Passport issuance/reissuance events will likely want DVN anchoring. Rules:

- Protected files (operator approval required for everything except adding an
  action type to `ANCHORABLE_ACTION_TYPES`):
  `services/dvn/activityReceiptDvnPipeline.ts`, `services/ops/icAgent.ts`,
  `services/ops/idl/cross_chain_service.ts`.
- Current anchorable types: `approval_granted`, `approval_rejected`,
  `artifact_sent`, `experience_model_updated`. Adding e.g.
  `passport_issued` to that list is the ONE permitted unilateral change.
- Receipt state machine: `local → dvn_pending → dvn_recorded / dvn_failed`.
  Failures escalate via `[DVN ESCALATION]` console.error — never silent.

### Everything else

- Extend, don't duplicate. Search before writing. One concern per commit.
- Never remove/weaken access gates without written admin consent.
- Push commit messages must name the actual content (no generic merges).
- Session docs go in `codexes/packs/agentiq/updates/` and get registered in
  `codexes/packs/agentiq/collections.json` under `col_updates`.

---

## 3. State of the infrastructure this workstream depends on (as of 2026-06-10)

The preceding session repaired the DVN/ICP ops layer. Current state:

### Canisters (mainnet, all confirmed via dfx CLI)

| Canister | ID | Cycles | Notes |
|---|---|---|---|
| DVN (cross_chain_service) | `sp5ye-2qaaa-aaaao-qkqla-cai` | ~1.14T | Anchoring receipts; submissions working |
| RQH (Reputation Hub) | `zdjf3-2qaaa-aaaas-qck4q-cai` | ~6.90T | healthy |
| RewardHub | `lvo2w-jqaaa-aaaas-qc2wa-cai` | ~3.99T | healthy |
| Proof of State | `n2hhv-aaaaa-aaaas-qccza-cai` | — | not monitored by cycles-status |
| Wallet | `ps5yq-saaaa-aaaas-qccva-cai` | topped up | routes `dfx wallet send` |

- Controllers on the 3 monitored canisters now include BOTH the operator's
  local dfx identity (`le4c3-erfdl-…-7ae`) AND the Lambda server identity
  (`6iefk-7tmjr-…-oae`, secp256k1 from `DFX_IDENTITY_PEM`), so the
  cycles-status route can call `canister_status`.
- `app/api/ops/canisters/cycles-status/route.ts` was fixed (commit
  `8b637ce1`) to pass `effectiveCanisterId` when calling the Management
  Canister — without it the boundary node returns `canister_not_found`.
  **Verification of this fix on dev was still pending at handover time.**

### DVN receipts

- All ~100 `dvn_failed` receipts were successfully retried.
- `app/api/admin/dvn-retry-all/route.ts` accepts `includeLocal: true` to also
  submit `local` receipts with anchorable action types (these existed because
  receipts created while `CROSS_CHAIN_SERVICE_CANISTER_ID` was unset stay
  `local`).
- myLedger header now has admin-only "Anchor local to DVN" and "Finalize
  pending" buttons (`app/triad/components/codex/tabs/MyLedgerTab.tsx`).
- **Open item:** the finalizer (`finalizeReadyActivityReceipts`) has no
  automatic trigger — it is manual-only (button or
  `POST /api/admin/activity-receipts/finalize`). A cron/scheduled trigger is
  the logical next infra task.

### Receipt UI

- `components/metame/cards/ActivityReceiptCard.tsx`: collapsed by default;
  full top card (chips, footer, status badge) always visible; expand bar on
  ALL receipts (label adapts: "Show receipt JSON" vs "Show chain & receipt
  JSON"); whole JSON header bar is clickable.

---

## 4. Open questions for the operator (answer before coding)

1. **Scope** — Is the Passport Bureau a user-facing surface (codex tab /
   cartridge), an admin issuance console, an API layer, or all three?
2. **Credential model** — Does "passport" mean the Root DiD itself, a
   presentable credential derived from it, or a new Polity-specific
   credential class (cf. `admin-cartridge:<slug>` credential class pattern)?
3. **Issuance authority** — Who can issue/revoke? Metayé (the Polity
   emissary)? Admin only? Is issuance DVN-anchored (new
   `ANCHORABLE_ACTION_TYPES` entry)?
4. **Cartridge placement** — New cartridge, or a tab on an existing one
   (AgentiQ / KNYT / metaMe)? Remember the dual-source registration pattern
   (`data/codex-configs.ts` vs pack auto-generation) and the skip-list rule.
5. **Phase** — Which workstream does this belong to: AgentiQ Alpha, Venture
   Lab α, or a new fourth program?

---

## 5. How to start a session on this workstream

```bash
git fetch origin claude/polity-passport-bureau-mMqNv
git checkout claude/polity-passport-bureau-mMqNv
# read section 1 docs, then confirm section 4 answers with the operator
```

Deploy flow is unchanged: push to a `claude/**` branch → auto-merge to dev →
Amplify build. Avoid doc-only pushes; batch docs with code.
