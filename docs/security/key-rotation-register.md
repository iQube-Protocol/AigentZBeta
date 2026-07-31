# Key Rotation Register

**Status:** open — to be executed as a single full-stack key-rotation project at the close of the program.
**Created:** 2026-06-16
**Owner:** operator (dele@metame.com)

## Purpose

A specific, actionable register of credentials that must be rotated before launch. Compiled from findings surfaced
during development. **This document does not contain secret values** — only locations and the rotation action
required. Do not paste private keys or live secrets into this file.

## Principle

The platform will run one coordinated key rotation across the entire stack at program close. Each entry below names
*what* to rotate, *where* it lives, and the *action* required. Treat any credential ever exposed in chat, logs, or a
tracked file as compromised and rotate it regardless of perceived blast radius.

---

## Register

### 1. `aigent-z` agent EVM private key — committed in source (HIGH)

- **Location:** `scripts/encrypt-agent-keys.js` (hardcoded `evm_private_key` for the `aigent-z` agent).
- **Wallet:** `0x0e3a4FDbE83F7e206380E6C61CA016F2127FF844` (public address — already flagged compromised; treat as burned).
- **Exposure:** live private key in a git-tracked source file, present in history.
- **Action:**
  1. Generate a new keypair for the `aigent-z` agent.
  2. Remove the literal from source — read the key from an environment variable instead.
  3. Update every consumer of the agent key (the agent-keys seed/encryption flow and the `agent_keys` table).
  4. Purge the old key from git history (`git filter-repo` / BFG), coordinating on the shared `dev` branch.
  5. Move any residual funds off the burned wallet.

### 2. `apps/theqriptopian-web/.env` — tracked environment file (HIGH)

- **Location:** `apps/theqriptopian-web/.env` (git-tracked, not gitignored).
- **Exposure:** a real `.env` committed to the repo, present in history.
- **Action:**
  1. `git rm --cached apps/theqriptopian-web/.env` and add the path to `.gitignore`.
  2. Rotate every credential the file contains.
  3. Purge the file from git history.

### 3. `POLITY_ISSUER_PRIVATE_KEY` — exposed in session chat (MEDIUM)

- **Location:** Amplify environment variable (server-only); pasted into chat during development.
- **Issuer address:** `0xB66c3994b318d01d2AAA767c471a9e3dD0Bc9C73` (public — surfaced at `/api/polity-passport/issuer`).
- **Role:** EIP-191 anchor for AgentKit attestations, ProveKit proof commitments, and the CCIP-Read ENS gateway.
- **Action:**
  1. Generate a new issuer keypair.
  2. Update `POLITY_ISSUER_PRIVATE_KEY` in Amplify.
  3. Re-publish the new issuer address (verifier-side checks read `/api/polity-passport/issuer`).
  4. Re-issue/rotate any downstream attestations bound to the old issuer address as needed.

---

## Full-stack rotation checklist (program close)

- [ ] Inventory all secrets across Amplify env, `.env*` files, MCP server configs, and seed scripts.
- [ ] Confirm no private key is read from a tracked source file anywhere (all from env).
- [ ] Rotate entries 1–3 above.
- [ ] Rotate Supabase service-role keys, third-party API keys (Mailjet, Turnstile, World ID, Namestone, etc.).
- [ ] Purge any historically committed secret from git history; coordinate force-push on shared branches.
- [ ] Re-run secret scanning to confirm a clean tree and clean history.
- [ ] Document the rotation completion date here.

> Storage note: kept under `docs/security/` (not in `codexes/packs/agentiq/updates/`) so vulnerability details are not
> surfaced in the in-app AgentiQ Updates cartridge.
