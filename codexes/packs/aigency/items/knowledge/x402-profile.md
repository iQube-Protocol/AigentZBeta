# Knowledge — x402-IQ Profile (v1)

Source: `docs/x402/x402-IQ.md`

Canonical header and payload specification for iQube transfers over the x402 HTTP payment protocol.

---

## Headers

| Header | Value |
|--------|-------|
| `X-402-Version` | `1` |
| `X-402-Intent` | `iqube.transfer` \| `iqube.grant` \| `iqube.deliver` |
| `X-402-Asset` | e.g., `QCT.QCENT` |
| `X-402-Amount` | string integer (q¢) |
| `X-402-Ref` | `iq:<contractOrId>/<tokenId>` |
| `X-402-Chain-From` | (optional, for transfer) |
| `X-402-Chain-To` | (optional, for transfer) |
| `X-402-Bridge` | (optional, for transfer) |
| `X-402-Sender` | `did:iq:...` or `fio:handle` |
| `X-402-Recipient` | `did:iq:...` or `fio:handle` |
| `X-402-Resolved-Sender` | `did:iq:...` (server-resolved) |
| `X-402-Resolved-Recipient` | `did:iq:...` (server-resolved) |
| `X-402-Identity-Proofs` | comma-separated URLs or hashes |
| `X-402-Proof-Hash` | `sha256:...` |
| `X-402-Signature` | `ed25519:...` |

---

## Payloads (JSON)

### Transfer (`iqube.transfer`)

```json
{
  "iqube_ref": "iq:0xA1.../1234",
  "actions": ["transfer_ownership"],
  "settlement": { "asset": "QCT.QCENT", "amount": "125" },
  "bridge": { "name": "layerzero", "nonce": 0 },
  "attestations": [{ "type": "DVN", "root": "0x..." }]
}
```

### Grant — Capability (`iqube.grant`)

```json
{
  "capability": {
    "iqube_ref": "iq:0xA1.../1234",
    "scope": ["read:model", "invoke:tool.run"],
    "ttl": "2026-01-31T23:59:59Z",
    "nonce": "..."
  },
  "acl_delta_sig": "ed25519:...",
  "settlement": { "asset": "QCT.QCENT", "amount": "5" }
}
```

### Deliver — Copy/Sync (`iqube.deliver`)

```json
{
  "meta": { "cid": "bafy...", "hash": "sha256:..." },
  "blak": { "uri": "icp://can/...", "hash": "sha256:..." },
  "license": "royalty-free-eval-30d",
  "settlement": { "asset": "QCT.QCENT", "amount": "50" }
}
```

---

## Identity and Signing

- Inputs accept DIDQube DIDs and FIO handles; server resolves to canonical DIDQube DID
- Sender signs canonicalized headers + payload with DID key (ed25519 preferred)
- Audience binding uses canonical DID; aliases recorded for UX/audit

---

## Atomicity

```
Escrow (QCT) → Proof-of-Delivery (hash-locked) → Finalize (release/refund)
```

For transfers: bind finalize to DVN/LayerZero `messageId` and verification.

---

## Audit

Log ACL deltas, identity proofs, and state proofs into iQube `metaQube` + `iqube_events`.

---

## Database Tables (from x402 migrations)

| Table | Purpose |
|-------|---------|
| `identity_aliases` | entity_did → alias mapping with TTL (expires_at, last_verified_at) |
| `fio_cache` | FIO handle lookup cache (expires_at) |
| `x402_messages` | Intent, headers, payload, state, identity snapshots |
| `x402_settlements` | message_id, asset, amount, escrow_tx, release_tx, status |
| `iqube_capabilities` | audience_did, audience_alias, scope, ttl |
| `iqube_events` | type, x402_message_id, identity_snapshot |
| `deliveries` | meta_cid, blak_uri, hashes, pod_proof, status |

---

## Policy Flags (services/identity/policy.ts)

| Flag | Values | Default | Purpose |
|------|--------|---------|---------|
| `IDENTITY_FIO_AUTOBIND` | `off\|soft\|public` | `off` | Automatic alias binding behavior |
| `IDENTITY_FIO_REQUIRE_CONSENT` | boolean | `true` | Privacy-first: require explicit consent |
| `IDENTITY_FIO_ALIAS_TTL_DAYS` | number | `90` | Alias binding lifespan |
| `AUDIT_EXPOSE_ALIAS` | boolean | `false` | Avoid public exposure by default |

---

## Settlement Strategy

- **Default**: Immediate payment (Option B) via internal A2A transfer
- **Future**: Policy gate to escrow (Option A) based on `X402_SETTLEMENT_MODE` env or threshold amount

**Environment variables**:
- `X402_SETTLEMENT_MODE`
- `X402_ESCROW_MIN_QCENT`
- `TREASURY_ADDRESS`
- `FIO_API_ENDPOINT`, `FIO_CHAIN_ID`

---

## Re-Verification

`POST /api/identity/aliases/reverify` — Finds FIO aliases expiring soon, revalidates via FIO lookup, extends `expires_at` if valid. Run daily via cron.

---

## See Also

- `items/knowledge/schemas-contracts.md` — Zod schemas for x402 payloads
- `items/architecture/protocols.md` — x402 in the protocol stack
- `items/architecture/payments-value.md` — Full payments and value flow
