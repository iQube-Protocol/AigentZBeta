# TokenQube minting — Persona iQube modal integration (2026-07-29)

**Branch:** `claude/tokenqube-minting-integration-ms2yjd`
**Surface:** `components/iqube/PersonaIQubeDrawer.tsx` (KNYT + Qripto persona iQube modal)

Wires the persona iQube modal to the live on-chain mint path built in the previous session
(`iQubeNFT` at `0xaF5d81D3BE501F8aCDF77b7f99Dd0ab53882B485`, Base Sepolia / chainId 84532).

---

## The gap this closed

The mint route already worked, but nothing connected it to a persona. Staging a persona wrote an
`iqube_mint_stubs` row and nothing else — the persona had **no registry trinity**, so:

- `metaIdentifier` was a synthetic string (`iq:persona/<type>/<stubId>`) rather than a real
  `iq_meta_qubes.id`;
- no `tokenQubeId` existed, so `updateTokenQubeChainAnchor()` had nothing to write back to and every
  mint's chain anchor was lost;
- the recipient defaulted to the **deployer** wallet, so the persona never owned its own token.

## What now happens

`POST /api/iqube/persona/<type>/mint` stages the full trinity and returns its ids:

| Row | Content |
|---|---|
| `iq_meta_qubes` | public provenance (no PII) — its `id` is the on-chain `metaIdentifier` |
| `iq_blak_qubes` | encrypted payload pointer — Autonomys Auto Drive CID, Supabase fallback |
| `iq_token_qubes` | wrapped content key — receives `chain_token_id` / `chain_tx_hash` after mint |

The drawer then calls `POST /api/core/mint-tokenqube` with `metaIdentifier = metaQubeId`,
`tokenQubeId`, and `recipientAddress` = **the persona's own connected EVM address**. The deployer
signs and pays gas; it never owns the token. A persona with no EVM address gets a named error
pointing at the blakQube tab rather than a silent mint to the deployer.

`GET /api/iqube/persona/<type>/mint` reads the trinity **without staging**, so opening the drawer
never mints.

### Tabs

- **metaQube** — the registered `iq_meta_qubes` row plus its MetaQube id; falls back to the projected
  shape, clearly labelled, when the persona has not been staged.
- **blakQube** — an *Encrypted Payload* panel above the editable fields: BlakQube id, storage
  provider, Auto Drive CID, cipher, size, SHA-256 checksum. Never the plaintext, never the key.
- **tokenQube** — TokenQube id, mint status derived from the persisted anchor, and an *Anchored*
  panel that survives closing the drawer (previously only the in-session `mintResult` rendered).

Staging is idempotent per `(user, persona type)`: re-staging reuses the same MetaQube and TokenQube
ids, so a re-mint anchors the identity that already exists instead of minting a second iQube for the
same subject.

---

## Defects fixed in passing

1. **GCM auth tag was never persisted.** Staging encrypted with AES-256-GCM and discarded
   `cipher.getAuthTag()`. Every staged payload was undecryptable — GCM cannot verify or decrypt
   without its tag. Now stored (`blakqube_auth_tag`, and on the BlakQube row).
2. **`bytea` columns received a `Buffer`.** supabase-js serialises that to
   `{"type":"Buffer","data":[…]}`, which Postgres stores as the literal text of the object. Now
   encoded as the `\x<hex>` literal PostgREST expects.
3. **`/api/core/mint-tokenqube` was unauthenticated.** It spends the deployer's gas and now writes a
   chain anchor. It requires a Supabase Bearer token, and a supplied `tokenQubeId` must be
   referenced by a stub the caller owns — otherwise any authenticated caller could overwrite another
   subject's anchor, which is what key escrow later trusts. Both client callers moved to
   `personaFetch`. (This is the same `x-persona-id`-as-auth class the constitutional-ground-review
   handoff flagged as *audited, not fixed* on other routes; those remain open.)
4. **Duplicated explorer-URL mapping.** `getTxExplorerUrl` / `getTokenExplorerUrl` now live in
   `services/chain/mintChains.ts` and both callers import them. The token-list URL was hardcoded to
   `sepolia.basescan.org` regardless of chain — a mainnet mint would have linked to a testnet
   explorer.
5. **KNYT and Qripto staging routes were near-identical copies.** Both now delegate to one
   implementation in `app/api/iqube/persona/_lib.ts`. Qripto keeps its `@deprecated` marker and
   removal schedule; what remains duplicated is the route file, not the logic.

## Key handling

The content key is derived per-persona (HKDF-SHA256 over `PERSONA_IQUBE_ENCRYPTION_KEY`), used
inside a single call frame, zeroed, and persisted **only** wrapped under the master
(`iq_token_qubes.key_ciphertext`) — invariant 3, *key never leaves the process*. The dev zero-key
fallback is surfaced in the response and rendered in the blakQube tab, so dev ciphertext is never
mistaken for custody.

The MetaQube slug is a commitment (`sha256('iqube:persona:<scope>')[0:16]`), never the user id.

---

## Migration — run before using the surface

```sql
ALTER TABLE public."iqube_mint_stubs"
  ADD COLUMN IF NOT EXISTS meta_qube_id       uuid,
  ADD COLUMN IF NOT EXISTS blak_qube_id       uuid,
  ADD COLUMN IF NOT EXISTS token_qube_id      uuid,
  ADD COLUMN IF NOT EXISTS blakqube_auth_tag  bytea;

COMMENT ON COLUMN public."iqube_mint_stubs".meta_qube_id IS
  'iq_meta_qubes.id — the registry MetaQube for this persona; used as metaIdentifier when minting on-chain';
COMMENT ON COLUMN public."iqube_mint_stubs".blak_qube_id IS
  'iq_blak_qubes.id — encrypted payload pointer (Autonomys CID or Supabase fallback)';
COMMENT ON COLUMN public."iqube_mint_stubs".token_qube_id IS
  'iq_token_qubes.id — wrapped key row that receives the chain anchor after mintQube()';
COMMENT ON COLUMN public."iqube_mint_stubs".blakqube_auth_tag IS
  'AES-256-GCM auth tag for blakqube_ciphertext; without it the payload cannot be decrypted';

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, iqube_type
           ORDER BY (autonomys_cid IS NOT NULL) DESC,
                    created_at DESC NULLS LAST,
                    id DESC
         ) AS rn
    FROM public."iqube_mint_stubs"
)
DELETE FROM public."iqube_mint_stubs" s
  USING ranked r
 WHERE s.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS iqube_mint_stubs_user_type_uniq
  ON public."iqube_mint_stubs" (user_id, iqube_type);
```

The unique index is what makes staging idempotent; the `WITH ranked` block collapses the
pre-existing stub history (one row per stage) to one row per subject first. It orders on
`autonomys_cid` — a pre-existing column — deliberately, so the block is correct whether the file is
run whole or statement-by-statement in the SQL editor.

File: `supabase/migrations/20260729000000_iqube_mint_stubs_trinity_refs.sql`

## Env

Unchanged from the previous session — `IQUBE_NFT_CONTRACT_ADDRESS`, `IQUBE_NFT_CHAIN_ID`,
`IQUBE_NFT_RPC_URL`, `EVM_DEPLOYER_KEY`. `AUTONOMYS_API_KEY` enables the Auto Drive leg; without it
staging still succeeds and the BlakQube records a Supabase-held pointer.
`PERSONA_IQUBE_ENCRYPTION_KEY` (64 hex chars) is required before any of this counts as custody.

---

## Not done

- **Not verified against the live contract.** No mint was executed from this session — the flow is
  wired and typechecks, but the first real mint is the operator's to run.
- Key wrapping still uses `PERSONA_IQUBE_ENCRYPTION_KEY`, not the FIO handle PPK
  (`personaFioService.getPersonaKeys()`). Pre-existing TODO, unchanged.
- The Stage 5 unified mint saga (`POST /api/registry/iqube/[id]/mint`) still supersedes this path
  when it lands; this work extends the existing surface rather than pre-empting it.
