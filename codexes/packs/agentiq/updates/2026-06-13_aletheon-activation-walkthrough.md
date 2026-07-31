# 2026-06-13 — Aletheon activation walkthrough (operator workflow)

Session branch: dev (post-sprints-1–7)

This is the end-to-end walkthrough for activating Aletheon as your bound delegate, now that Sprints 1–7 are shipped. Run this once after the 6 migrations are applied and the Amplify build is green.

**Pre-flight state (you have this today):**
- First Citizen persona created
- Citizen Passport claimed (PassportQube visible in wallet)
- PersonaQube minted (Sui object id + Walrus blob id stamped)
- World ID upgrade complete (Verified Citizen badge on PassportQube)
- The Polity Passport Bureau cartridge has the copilot wired (post-Sprint-8 commit `84f45d60`)

**Aletheon's current state:**
- Agent Card exists at `https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json` (hand-curated, since first session)
- An `agent_root_identity` row exists for Aletheon (or will when you run the genesis flow below — whichever path you pick)

You have two paths to activate Aletheon. **Path A** is the demo path that works today end-to-end. **Path B** is the architecturally-clean path that needs one more endpoint shipped (Phase B work) before it runs.

---

## Path A — Demo path (works today, use this for the hackathon)

This path acknowledges that Aletheon's own persona context isn't yet wired — Sprint 3 shipped the Agent Genesis endpoint and the sponsored-agents wallet surface but not the agent_persona row write + agent claim flow. For the demo, Aletheon is "your bound delegate, visible in your wallet, AgentKit-attested, with Locker access" — which is the full sponsor-side architecture story.

### Step 1 — Re-anchor Aletheon's existing passport (if she has one)

If you already submitted a participant passport application for Aletheon in a previous session, that row in `polity_passport_records` is stamped with your First Citizen `persona_id`. Confirm by checking the wallet:

- Open the wallet drawer → iQube tab → PassportQube section
- If you see TWO passports listed (one Citizen for you, one Participant for "aletheon"), Aletheon is already discoverable. Skip to Step 4.
- If only your Citizen Passport is visible, continue to Step 2.

### Step 2 — Genesis Aletheon from the Apply tab

1. Polity Passport Bureau cartridge → **Apply** tab
2. Choose **Participant**
3. Pick the **"Genesis a new agent"** path (default)
4. Fill the form:
   - **Display name**: `Aletheon`
   - **Slug**: `aletheon`
   - **Sponsor Passport ID**: copy from your wallet's PassportQube card (starts with `ppc-`)
5. Click **"Sponsor agent & generate card"**
   - This calls `POST /api/agents/genesis`
   - On success, the Agent Card URL auto-fills (`https://dev-beta.aigentz.me/api/agents/aletheon/agent-card.json`)
   - A row lands in `agent_root_identity` with `agent_class='polity_bound'`, `sponsor_passport_id=<your-passport>`, `sponsor_persona_id=<your-persona>`
6. The form pre-populates and presents the rest of the Participant submission steps:
   - Agent description (from the wizard)
   - Bounded delegation grant config (L1 EXPERIMENTAL, 4 hours — defaults)
   - Consents
   - Submit
7. The submit writes:
   - A `polity_passport_applications` row (stamped with your persona_id — you're the sponsor)
   - A pending passport row when issued
8. **Steward approval**: today this requires admin steward action via the Steward tab. For demo, you can either:
   - Have an admin approve via Steward tab
   - OR, for a self-service demo, the participant flow may auto-issue (depending on whether `participant_auto_issue` env is set)

### Step 3 — Confirm Aletheon is visible

After issuance, the wallet drawer's iQube tab should show:

- **PassportQube — Verifiable Credentials** section: now lists TWO entries:
  1. **Citizen Passport** (yours, with World ID Verified badge)
  2. **Participant Passport** for Aletheon — `ppp-...`
- **AgentQubes — Bound Delegates** section: Aletheon's card showing class `polity_bound`, passport status, "View Agent Card" link, did_uri

### Step 4 — Claim Aletheon's VC (sponsor-side)

Aletheon's Participant Passport currently belongs to YOUR persona context. So:

1. Wallet drawer → PassportQube section → Aletheon's row → click **"Claim VC"** pill (violet pulsing) OR navigate to Registry tab and use the same flow
2. The credential POST stamps `credential_claimed_at` on the row
3. The VC envelope appears in the wallet — you can view + download

This claims the passport credential **on Aletheon's behalf as her sponsor**. The credential is bound to you operationally; Aletheon's own persona context for self-claim is Phase B.

### Step 5 — Grant bounded delegation

1. Polity Passport Bureau cartridge → **Delegation** tab (the new tab from Sprint 5)
2. The `BoundedDelegationTab` lists Aletheon as a sponsored agent
3. Click **Grant** → choose **L1_EXPERIMENTAL** + **4 hours** (or longer)
4. A delegation grant row is written; receipt logged

### Step 6 — AgentKit attestation (because you're World ID verified)

After the grant lands, attach an AgentKit attestation that carries your verified-human flag:

```bash
curl -s -X POST 'https://dev-beta.aigentz.me/api/access/delegation/agentkit-attest' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-supabase-token>' \
  -d '{
    "delegationGrantId": "<grant-id-from-step-5>",
    "sponsorPassportId": "<your-citizen-passport-id>",
    "delegatedAgentRootId": "<aletheon-agent-root-id-from-step-3>"
  }' | jq
```

Expected response:
```json
{
  "ok": true,
  "attestation": {
    "attestationToken": "<base64>.agentkit-stub.<hmac>",
    "verifiedHuman": true,
    "mode": "stub",
    "verifiedHuman": true
  }
}
```

The `verifiedHuman: true` is the critical claim — because First Citizen has World ID, the AgentKit attestation carries the proof.

Verify the token (any third party can do this — no auth needed):

```bash
curl -s "https://dev-beta.aigentz.me/api/access/delegation/agentkit-attest?token=<token>" | jq
```

### Step 7 — Upload to Locker + grant Aletheon read

1. Polity Passport Bureau cartridge → **Locker** tab
2. **Upload form**: enter a display name (e.g. "Test asylum letter")
3. Toggle **"Allow delegated agents to download bytes"** OFF if you want view-only
4. Pick a file → upload completes; you see the Walrus blob id + Sui object id (stub mode for now)
5. Below the item, **"Grant to: Aletheon · read"** chip appears (read-only because downloadable was off)
6. Click it → confirm → grant lands, QubeTalk channel auto-binds between you and Aletheon

### Step 8 — ProveKit personhood proof

Generate a zero-knowledge proof of your personhood:

```bash
curl -s -X POST 'https://dev-beta.aigentz.me/api/polity-passport/attest/proof_of_personhood' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-supabase-token>' \
  -d '{"passportId": "<your-citizen-passport-id>"}' | jq
```

Verify (public endpoint):

```bash
curl -s -X POST 'https://dev-beta.aigentz.me/api/polity-passport/verify/proof_of_personhood' \
  -H 'Content-Type: application/json' \
  -d '{"proofToken": "<token>"}' | jq
```

Expected: `valid: true`, `commitmentRef: provekit:proof_of_personhood:stub:<hash>`.

### Step 9 — ProveKit delegation authority proof

```bash
curl -s -X POST 'https://dev-beta.aigentz.me/api/polity-passport/attest/proof_of_delegation_authority' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-supabase-token>' \
  -d '{
    "delegationGrantId": "<grant-id>",
    "sponsorPassportId": "<your-citizen-passport>",
    "delegatedAgentDidUri": "did:agent:root:aletheon"
  }' | jq
```

### Step 10 — Claim an ENS name (optional flourish)

```bash
curl -s -X POST "https://dev-beta.aigentz.me/api/identity/persona/<your-persona-id>/ens" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <your-supabase-token>' \
  -d '{"label": "first-citizen"}' | jq
```

Then resolve publicly:

```bash
curl -s 'https://dev-beta.aigentz.me/api/identity/resolve-ens/first-citizen' | jq
```

The resolver returns `publicRef` (a SHA-256 commitment of your persona_id), NEVER your persona_id itself. This is the anonymity guardrail in action.

---

## Path B — Architecturally clean (Phase B, needs one more endpoint)

The clean model is: Aletheon owns her own persona, separate from yours. The Phase B work to get there:

1. **Ship `POST /api/identity/persona/agent`** — provisions an `agent_persona` row referencing Aletheon's `agent_root_identity`, with `delegation_user_root_id = your root id` and `delegation_persona_id = your persona_id`. Returns the new agent_persona_id.

2. **Re-anchor Aletheon's existing passport row**: run `scripts/reanchor-agent-passport.ts` (also Phase B). This swaps `persona_id` on `polity_passport_records` from your persona to the new agent persona, stamps `re_anchored_at`, logs a receipt. After this, Aletheon's passport disappears from YOUR PassportQube section and appears under HER persona context.

3. **Persona switcher in the wallet drawer** — adds an "Act as Aletheon" toggle. Behind the scenes this re-resolves the active persona via the spine.

4. **Aletheon claims her own VC** — using the existing `PassportClaimModal` with the agent_persona_id resolved by the persona switcher.

5. **Same delegation + AgentKit + Locker + ProveKit steps as Path A** — but now Aletheon's own persona context is the actor, not yours sponsoring on her behalf.

**Estimated work for Phase B Aletheon path:** ~3 days. Not required for the hackathon submission — Path A demonstrates the full architecture from sponsor side.

---

## Quick reference — the canonical IDs

After Step 3 of Path A, capture these IDs (you'll reuse them in steps 4–9):

| Concept | Where to find it |
|---|---|
| Your Citizen Passport ID | Wallet → PassportQube card → top right (`ppc-...`) |
| Aletheon's Passport ID | Wallet → PassportQube card → Aletheon row (`ppp-...`) |
| Aletheon's agent_root_id | `GET /api/persona/sponsored-agents` → `agents[0].agentRootId` |
| Aletheon's did_uri | `did:agent:root:aletheon` (deterministic from slug) |
| Your persona_id | `GET /api/wallet/active-persona` → `personaId` |
| Delegation grant id | Returned from the grant POST in step 5 |
| AgentKit attestation token | Returned from `/api/access/delegation/agentkit-attest` POST |

---

## Verification checklist (the demo gate)

By the end of Path A, you should be able to demonstrate to a judge:

- [ ] First Citizen passport claimed + World ID verified
- [ ] PersonaQube minted (Sui object + Walrus blob ids visible in wallet)
- [ ] Aletheon agent_root_identity row created via Genesis (polity_bound class, sponsor anchored)
- [ ] Aletheon's Participant Passport claimed as VC (in your wallet's PassportQube section)
- [ ] Aletheon appears in "AgentQubes — Bound Delegates" wallet section
- [ ] Bounded delegation grant active (visible in Delegation tab)
- [ ] AgentKit attestation token returned with `verified_human: true` (because you have World ID)
- [ ] Locker item uploaded; Aletheon has a read grant; QubeTalk channel bound
- [ ] ProveKit personhood proof generated AND verified (round trip)
- [ ] ProveKit delegation-authority proof generated AND verified
- [ ] ENS name claimed; public resolver returns the commitment ref (NOT persona_id)

If any step fails, check:
- **`auth_profile_id` migration fix applied?** Re-run the 6 migrations from the dev branch after the `afdf02d2` commit.
- **Build green?** Confirm Amplify reports a successful build past commit `841a64e7` (the `@worldcoin/idkit` import fix).
- **Spine auth?** Every authenticated curl in this doc needs a fresh Supabase Bearer token — pull from localStorage via the DevTools snippet in CLAUDE.md's `personaFetch` debugging section.
