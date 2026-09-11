# Constitutional Access Service + World ID upgrade fix — 2026-07-19

## Part 1 — Constitutional Access Service (Participation stewarding)

Operator + Aletheon consolidation: ONE invitation/grant mechanism for every
permissioned area, stewarded from the Passport Steward tab. Applications
remain participant-initiated (existing passport application flow +
Activations — not replaced); invitations are steward-initiated; both
converge into the canonical **AccessGrant**.

### Access domains (config, not code branches)

`passport` · `research-lab` · `venture-lab` · `metame-studio` ·
`developer-studio` — role catalogues per domain in
`services/passport/participationAccess.ts` (`DOMAIN_ROLES`). Adding a
domain/role = extending the const, never forking the mechanism.

### Constitutional boundaries encoded

- Bearer code = **transport, not authority**: sha256-hashed at rest, shown
  once at issuance, bounded (expiry, max uses, optional intended recipient,
  revocable). Open/named/cohort invitations are all the same object with
  different bounds (maxUses > 1 = cohort).
- **Claiming is a human constitutional act** — spine-authenticated persona
  required. Agents may prepare applications (agent-assisted =
  `personhood_proof_type='agent_declaration'`, surfaced as a count in the
  steward workspace) but cannot claim, self-delegate, or exceed privileges.
  Delegation follows Passport issuance, never precedes it.
- Every grant is **receipted** (`passport_privilege_changed`); the steward
  view shows holders as T2-safe commitments, never raw persona ids.

### Built

- `supabase/migrations/20260725000000_participation_access.sql` —
  `access_invitations` + `access_grants`.
- `services/passport/participationAccess.ts` — issue / list / revoke /
  claim (+ idempotent re-claim), domain + role config.
- `app/api/steward/participation/route.ts` — steward overview (admin).
- `app/api/steward/participation/invitations/route.ts` — issue + revoke.
- `app/api/participation/claim/route.ts` — the participant claim act.
- `app/triad/components/codex/tabs/StewardParticipationTab.tsx` — the
  **Access & Invitations** steward workspace: domain side-menu (third
  tier), issue form (role/label/recipient/uses/expiry), one-time code +
  invite-link reveal, invitation list with claim state + revoke, canonical
  grants list. Registered as a Steward sub-tab in the Polity Passport
  Bureau `steward` group → surfaces under Steward in every cartridge that
  mounts it (IRL, IRL OS, AgentiQ, metaMe).
- Locker claim box now routes BOTH invitation kinds by prefix:
  `x409-…` → agreement into the locker; `pinv-…` → access grant. Deep
  links `?x409=` and `?invite=` both pre-fill it.

### Operator runbook

```sql
-- Supabase SQL editor (once):
CREATE TABLE IF NOT EXISTS public.access_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  access_domain text NOT NULL,
  role text NOT NULL,
  label text,
  intended_recipient text,
  max_uses int NOT NULL DEFAULT 1,
  uses int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'revoked', 'expired')),
  issuer_persona_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS access_invitations_domain_idx ON public.access_invitations (access_domain, status);
CREATE TABLE IF NOT EXISTS public.access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL,
  passport_id text,
  access_domain text NOT NULL,
  role text NOT NULL,
  source text NOT NULL CHECK (source IN ('application', 'invitation', 'admin')),
  source_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  receipt_id text
);
CREATE INDEX IF NOT EXISTS access_grants_persona_idx ON public.access_grants (persona_id, access_domain, status);
CREATE INDEX IF NOT EXISTS access_grants_domain_idx ON public.access_grants (access_domain, status);
ALTER TABLE public.access_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_grants ENABLE ROW LEVEL SECURITY;
```

Then: Participation → Steward → **Access & Invitations** → pick domain →
Issue bearer invitation → copy the one-time code/link.

## Part 2 — World ID passport upgrade fix (two stacked client bugs)

After the app_id correction, proofs generated but the upgrade failed with
"passportId and proof.nullifier_hash are required". Root causes:

1. **Payload shape**: LockerTab + PassportClaimModal POSTed
   `{ passportId, ...proof }` (spread) while `/api/polity-passport/verify-worldid`
   requires `{ passportId, proof: {...} }` (nested) — `body.proof` was the
   semaphore string, so `proof.nullifier_hash` was always undefined.
   SmartWalletDrawer + PassportRegistryTab were already nested/correct.
2. **Missing signal**: `WorldIdButton` generated proofs bound to
   `signal=passportId` but never included `signal` in the emitted bundle,
   so the server called the Cloud Verifier without `signal_hash` — the
   proof would be rejected as invalid once bug 1 was fixed. The bundle now
   carries `signal`, completing the 64dc6fdd server-side hashing fix.
