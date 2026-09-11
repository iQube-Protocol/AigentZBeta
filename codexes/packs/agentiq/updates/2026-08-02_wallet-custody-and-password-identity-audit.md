# Wallet custody + password identity audit (operator-requested, 2026-08-02)

Requested before implementing `persona + password` as a cross-device wallet-restoration
path. The governing question:

> Does a recoverable encrypted metaMe wallet envelope already exist outside the original
> browser/device, and can it be safely restored using persona + password without exposing
> plaintext key material?

**Answer: the envelope exists; the restoration path does not.**

---

## Classification: **B — REMOTE PACKAGE EXISTS BUT RESTORATION IS INCOMPLETE**

Not C (a remote package genuinely exists, not just a local one), not D (the server holds
ciphertext it cannot decrypt, not custodial key material), not E.

---

## The ten questions, answered from code

| # | Question | Finding |
|---|---|---|
| 1 | Encrypted wallet package persisted beyond the original device? | **Yes.** |
| 2 | Where? | Supabase `personas.evm_key` (JSONB). Written by `POST /api/wallet/persona` (`app/api/wallet/persona/route.ts:112`, `evm_key: persona.evmKey`), which `services/wallet/personaService.ts:126 storePersona()` posts the whole persona object to. |
| 3 | What does it contain? | The `EvmKeyPair`: `address`, `publicKey`, `keySource`, and `encryptedPrivateKey: { ciphertext, iv, salt, authTag }` (`types/persona.ts:57`). |
| 4 | Encryption scheme? | AES-256-GCM (`services/wallet/keyService.ts:205`). |
| 5 | What key protects it? | A PBKDF2-SHA256 key, 100,000 iterations, derived from the user's wallet password + a per-key random salt. The salt travels with the ciphertext; **the password does not**. |
| 6 | Is the wallet password sufficient to unwrap it? | **Cryptographically yes** — `decryptPrivateKey(encryptedKey, password)` needs only the envelope and the password. Nothing else is required. |
| 7 | Does the server ever see plaintext key material? | **No, for citizen wallets.** `encryptPrivateKey` runs in the browser via WebCrypto; only ciphertext is POSTed. *(Distinct and unrelated: `POST /api/admin/register-agent-keys` encrypts **platform agent** keys server-side under `AGENT_KEY_ENCRYPTION_SECRET`. That is a server-custodial mechanism for platform agents and has nothing to do with citizen wallet custody — do not conflate them.)* |
| 8 | Can it be restored on a clean device? | **No.** No route serialises it back. `POST /api/wallet/persona` and `GET/PATCH /api/wallet/persona/[id]` all use explicit column lists that **exclude** `evm_key`. `GET /api/wallet/personas` *does* select `evm_key` server-side but its mapper emits only `evmAddress` (`app/api/wallet/personas/route.ts:95`) — the ciphertext never reaches the client. There is also **no persona-handle → account lookup route** of any kind. From the client's perspective the envelope is **write-only**. |
| 9 | Integrity / versioning? | GCM `authTag` gives integrity. **No version field, no rotation metadata.** |
| 10 | Password change / rotation / revocation / compromised-device recovery? | **None exist.** No re-encrypt or rotate path anywhere in `services/wallet/` or `app/api/wallet/`. Changing a wallet password today is not a supported operation. |

### What this means

The substrate for pseudonymous cross-device recovery is **already there** — a
password-encrypted, server-opaque envelope, one per persona. What is missing is
(a) a retrieval route, (b) a client-side restore flow, and (c) the safety
architecture around both.

**(c) is the reason not to just add (a).** A naive `GET envelope?persona=X` would be an
offline brute-force oracle: anyone who could name or guess a persona could pull the
ciphertext and grind PBKDF2 offline, with no rate limit and no trace. The persona is a
*locator*, not a secret — it appears in local storage, logs, screenshots and support
requests — so the retrieval route cannot rely on it being unguessable. This is precisely
the problem an augmented PAKE (e.g. OPAQUE, RFC 9807) is designed for, and it is a
custody-architecture decision for the operator, not an inline implementation choice.

### Consequently, in the UI (this pass)

- `persona + password` is **not** offered as cross-device wallet restoration. It is not
  faked, not stubbed, and not labelled as working.
- The conventional account route is labelled **"Persona or recovery email"** as ruled, and
  an email really does sign in. A persona handle gets an explicit "not available yet"
  explanation naming the paths that *do* work — not a generic auth error, because it is
  not an authentication failure; it is an unbuilt capability, and disguising it would be
  the fake flow the ruling forbids.
- Wallet unlock on a recognised device is unchanged in substance and correct: local
  envelope + password, decrypt in-browser, sign the Passport challenge. **No email is
  involved at any point.**

---

## Password identity — the second audit, refined

Traced: Passport wizard Account step → persona creation → wallet encryption → Supabase
authentication → `UnlockModal` validation.

**They are two structurally independent credentials today. This is unchanged from the
2026-08-01 finding, and the custody audit above now explains *why* the split is load-bearing
rather than accidental.**

| Credential | Where it is set | What verifies it | Reaches the server? |
|---|---|---|---|
| Wallet-encryption password | `PersonaSetupWizard` → "Secure Your Wallet" | `keyService.decryptPrivateKey` / `verifyPassword`, entirely in-browser | **Never** |
| Supabase account password | Supabase sign-up / `useSupabaseSessionPersonas.signIn` | Supabase Auth, server-side | Yes (to Supabase) |

`UnlockModal`'s password **is** the wallet-encryption password — one credential, not a
third. The persona has no separate password of its own.

### Why they cannot simply be merged

The wallet password's security property is that **no server ever receives it**. That is
what makes `personas.evm_key` safe to store: the platform holds ciphertext it is incapable
of decrypting. A Supabase password, by construction, is transmitted to and verified by a
server. Making them literally the same secret would either send the wallet password to a
server (destroying the property that makes remote storage safe) or stop Supabase from
verifying it. The desired product model — *one user-established password* — is achievable,
but only as a **derivation**, not an equality: one user-typed secret, from which two
independent values are derived client-side (e.g. one for the account credential, one for
key wrapping), so the wrapping secret still never leaves the device.

That is a deliberate normalisation with migration consequences for every existing wallet
(re-encryption under a new derived key, requiring the current password). It is scoped, not
performed here.

**Until it is performed, the UI must keep saying they are separate, because they are.** The
copy `"a separate credential from your metaMe wallet password"` is accurate and stays.

---

## Recommended next capability (not built here)

`WALLET-BACKUP-001` — pseudonymous cross-device wallet restoration.

Required shape:

```
client creates encrypted wallet envelope        (already true today)
→ server stores ciphertext + metadata only      (already true today)
→ persona locates the envelope                  (MISSING — needs a route)
→ aPAKE-authenticated retrieval, rate-limited,
  generic responses, no existence disclosure    (MISSING — needs design)
→ integrity + version verified                  (partial: authTag, no version)
→ wallet restored locally, signs the challenge  (MISSING — needs client flow)
```

Never acceptable: `persona + password → plaintext private key returned by server`.

Also required alongside it: envelope versioning, password rotation (re-encrypt + re-upload),
revocation, and receipts — `wallet_backup_created`, `wallet_backup_restored`,
`wallet_backup_rotated`, `wallet_backup_revoked`.
