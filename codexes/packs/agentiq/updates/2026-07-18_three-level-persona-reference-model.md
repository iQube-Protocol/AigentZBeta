# Three-Level Persona Reference Model — wallet identity inventory (2026-07-18)

Operator-ratified resolution of "users need to recover and use their persona
UUIDs without breaking the T0–T2 rules." The raw persona UUID is **not** a
public key — it is the private root identifier. Three reference levels serve
three trust domains:

| Level | Identifier | Trust domain | Where it may appear |
|---|---|---|---|
| 1 | **Private Persona UUID** (raw `personas.id` / agent identity id) | Owner recovery, support, platform config (e.g. `RESULTS_STEWARD_PERSONA_ID`) | Owner-authenticated wallet self-view ONLY. Masked by default, eye-reveal + copy with warning. NEVER in receipts, broadcasts, locker metadata, chain payloads, or third-party calls. |
| 2 | **Polity Public Reference** — `sha256(personaId).hex.slice(0,16)` (same derivation as the DVN pipeline's `hashPersonaRef`) | Governed Polity/metaMe ecosystem | DVN receipts (already does), internal interoperability. Stable, one-way. NOT claimed to be unlinkable across services. |
| 3 | **Pairwise External Service Reference** — `prf_` + `HMAC-SHA256(PERSONA_PAIRWISE_REF_SECRET, personaId:audience:generation).slice(0,20)` | Third-party services | One ref per (persona, audience). Keyed, so a UUID alone can't reproduce refs. Revocable + regenerable (generation bump). Stored in `persona_external_refs` for recovery. |

## T0 clarification (operator ruling)

The client is the sovereign surface where an owner decrypts and sees their own
BlakQube-secured data — that is the point of the protocol. The T0 rule's
enforcement boundary is the **network/chain boundary**: DVN receipts, persona
broadcasts, locker metadata, the T1 `active-persona` surface. Owner-scoped,
Bearer-authenticated self-view routes (the same exposure class as
`/api/wallet/persona`) MAY return the caller's own raw persona UUIDs. Canary
tests and all receipt/broadcast paths are unchanged.

## What was built

- `supabase/migrations/20260722000000_persona_external_refs.sql` — external
  refs table (service-role only, RLS enabled, no client policies).
- `services/identity/personaReferences.ts` — derivations + issue/list/revoke.
- `app/api/wallet/identity/references/route.ts` — owner-authenticated
  inventory (GET) + external-ref management (POST). Lists every human
  persona, created agent persona, and citizen-bound delegate (with aigentMe
  marker) across the caller's canonical + merged auth-profile clusters.
- `app/components/identity/PersonaReferencesInventory.tsx` — the wallet
  Identity panel's "Persona & Agent IDs" collapsible section
  (SmartWalletDrawer, under the Root DID sub-record).
- `scripts/create-env-production.js` — `PERSONA_PAIRWISE_REF_SECRET`
  allow-listed.

## Operator action — enable external refs

Set in Amplify (server scope; any strong random works):

```bash
openssl rand -hex 32
```

Add the output as `PERSONA_PAIRWISE_REF_SECRET`, then redeploy. Run the
migration in the Supabase SQL editor:

```sql
-- paste of supabase/migrations/20260722000000_persona_external_refs.sql
CREATE TABLE IF NOT EXISTS public.persona_external_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL,
  audience text NOT NULL,
  ref text NOT NULL,
  generation int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (persona_id, audience, generation)
);
CREATE INDEX IF NOT EXISTS persona_external_refs_persona_idx
  ON public.persona_external_refs (persona_id, status);
ALTER TABLE public.persona_external_refs ENABLE ROW LEVEL SECURITY;
```

Until both are done: private UUIDs + public refs work; the external-ref
issuer shows a disabled hint.
