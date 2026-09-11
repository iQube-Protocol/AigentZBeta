# EXP-P1 Reviewer Agreement + invitation re-issue (operator ruling, 2026-08-02)

Closes #106. Also records the two operational actions the ruling requires the operator
to perform, and registers `WALLET-BACKUP-001`.

---

## 1. OPERATOR ACTION — re-issue Austin's invitation, revoke the unusable one

**Why:** the existing invitation was issued with role `research-participant`, which is a
real research-lab role but is **deliberately excluded** from the review-readable set
(`allRolesExcept('research-participant', 'student-researcher')`). It claims successfully
and then fails every review gate. No code change makes it work — it must be re-issued.

The issuance guard shipped in `1df88e79c` now **refuses** this combination at creation, so
this cannot recur. But the already-issued invitation predates the guard.

### Step 1 — find the bad invitation and confirm before revoking

Paste into the Supabase SQL editor:

```sql
-- Inspect first. Confirm this is the one before revoking anything.
select id, access_domain, role, label, intended_recipient, status,
       uses, max_uses, allowed_experiments, created_at
from public.access_invitations
where access_domain = 'research-lab'
  and role = 'research-participant'
order by created_at desc;
```

### Step 2 — revoke it, and issue the correct one

Replace `<BAD_INVITATION_ID>` with the `id` from step 1, and
`<ISSUER_PERSONA_ID>` with the issuing steward's persona id (the same one that appears as
`issuer_persona_id` on the row above). **Run the whole block as one paste** — it prints the
new raw code at the end, which is the only time it is recoverable.

```sql
begin;

-- Revoke the unusable invitation so two apparently-valid invitations never
-- coexist for the same purpose.
update public.access_invitations
   set status = 'revoked'
 where id = '<BAD_INVITATION_ID>';

-- Issue the correct reviewer invitation. `reviewer` is the narrowest
-- review-readable role: maySubmitReviewDecision = true, and administer-access /
-- edit-materials / award-grade / freeze / canonise / publish / Standing all false.
-- `allowed_experiments` scopes the grant to EXP-P1 and nothing else.
with new_code as (
  select 'pinv-' || encode(gen_random_bytes(16), 'hex') as raw
)
insert into public.access_invitations
  (code_hash, access_domain, role, label, intended_recipient,
   max_uses, expires_at, issuer_persona_id, allowed_experiments)
select
  encode(digest(raw, 'sha256'), 'hex'),
  'research-lab',
  'reviewer',
  'EXP-P1 Independent Review',
  'austin',
  1,
  now() + interval '30 days',
  '<ISSUER_PERSONA_ID>'::uuid,
  array['EXP-P1']
from new_code
returning
  id,
  role,
  allowed_experiments,
  (select raw from new_code) as raw_code_send_this_once;

commit;
```

> `digest()` needs `pgcrypto`. If it errors, run `create extension if not exists pgcrypto;`
> first. The hashing matches `hashCode()` in `services/passport/participationAccess.ts`
> (plain sha256 hex of the raw code).

The invitation link is `https://<host>/invite/<raw_code_send_this_once>`.

**Verify before sending** — this must return exactly one active reviewer invitation:

```sql
select role, status, allowed_experiments
from public.access_invitations
where access_domain = 'research-lab' and status = 'active';
```

### Alternative — issue through the app instead of SQL

The steward Participation surface calls `createAccessInvitation`, which now refuses the
incoherent pairing outright. Choosing role **Reviewer** and ticking **EXP-P1** produces the
identical row, and refuses with a named fix if the wrong role is chosen.

---

## 2. The EXP-P1 Independent Reviewer Agreement

**`agreement.exp-p1.independent-review.v1`** —
`services/research/reviewerAgreement.ts`.

Canonical, reusable and experiment-scoped: every EXP-P1 reviewer authorizes the *same* v1,
not a per-collaborator console artifact. The terms live in source as a frozen object with a
content hash derived from the terms themselves, so they are diffable in review and cannot
be edited silently.

### What it is, and is not

It does **not** grant review access. Access remains
`valid invitation ∩ reviewer-readable role ∩ experiment scope`. The agreement adds a
strictly separate conjunct: `reviewer consent ∩ review mandate ∩ declared independence ∩
consequence boundaries`. **Both** are required to submit; neither is derived from the other.

### Clauses (all eight required by the ruling)

`mandate` · `non-ratification` · `consequence-boundary` · `independence` · `conflict` ·
`evidence-handling` · `submission` · `supersession`

It states explicitly that findings are **evidence, not ratification**; that contested
findings remain contested pending governed resolution; that submissions are attributable to
the signing reviewer; and that the reviewer may **not** freeze, canonise, publish, alter
lifecycle state or grant Standing.

### `collaborationAgreementAuthorized` is derived, never a UI boolean

True only when the caller's own **active** authorization row matches all five conjuncts:

```
active reviewer principal ∩ experiment ∩ agreement id+version
                          ∩ current terms hash ∩ package scope
```

The hash is **pinned on the row at authorization time**. When the canonical terms change,
stored rows stop matching the recomputed hash and the gate refuses until the reviewer
authorizes the new version — v1's consent stays auditable forever, it simply stops
authorizing *new* submissions. Rows are never deleted or overwritten; revocation and
supersession are status transitions.

### The x409 refusal

`requireReviewerAgreement` returns the structured, actionable body the ruling specifies —
never a generic failure:

```json
{
  "code": "REVIEWER_AGREEMENT_REQUIRED",
  "experimentId": "EXP-P1",
  "agreementId": "agreement.exp-p1.independent-review.v1",
  "agreementVersion": "v1",
  "requiredAction": "AUTHORIZE_REVIEWER_AGREEMENT",
  "reason": "no-authorization"
}
```

`reason` distinguishes `no-authorization` · `version-superseded` · `hash-mismatch` ·
`package-scope` · `revoked` · `no-agreement-defined` · `unavailable`. The last fails
**unknown, not denied** — a store outage never renders as "you did not sign this".

### Submit Review is now three panels

`Review mandate → Reviewer agreement → Submit review`.

The mandate panel states what the reviewer may and may not do *before* they are asked to
consent. The agreement panel requires an explicit acknowledgement **and** an explicit
conflict declaration with **no default** — an unanswered conflict question is not "no
conflict". The client echoes the displayed terms hash, so if the terms changed while the
page was open the server refuses rather than record consent to text the reviewer never read.

**`visibleSections` repaired**: the Submit Review Locker is now
`['peerExchange', 'uploadToLocker']`. The `invitation` panel is **gone** from this stage —
invitation acceptance is an accession act performed before programme entry, on the
invitation page. Capability visibility is no broader than the reviewer mandate.

### MIGRATION — run this before the agreement surface works

```sql
-- supabase/migrations/20260930001000_reviewer_agreement_authorizations.sql
create table if not exists public.reviewer_agreement_authorizations (
  id                 uuid primary key default gen_random_uuid(),
  persona_id         uuid not null,
  reviewer_ref       text not null,
  passport_ref       text,
  agreement_id       text not null,
  agreement_version  text not null,
  agreement_hash     text not null,
  experiment_id      text not null,
  package_scope      jsonb not null default '"*"'::jsonb,
  conflict_declared  boolean not null default false,
  conflict_statement text,
  authorized_at      timestamptz not null default now(),
  proof_ref          text,
  receipt_id         uuid,
  status             text not null default 'active',
  constraint reviewer_agreement_status_valid
    check (status in ('active', 'revoked', 'superseded')),
  constraint reviewer_agreement_conflict_stated
    check (not conflict_declared or conflict_statement is not null)
);

create index if not exists reviewer_agreement_auth_persona_experiment_idx
  on public.reviewer_agreement_authorizations (persona_id, experiment_id, status);

create unique index if not exists reviewer_agreement_auth_unique_active_idx
  on public.reviewer_agreement_authorizations (persona_id, agreement_id, agreement_hash)
  where status = 'active';

alter table public.reviewer_agreement_authorizations enable row level security;

drop policy if exists reviewer_agreement_auth_service_role
  on public.reviewer_agreement_authorizations;
create policy reviewer_agreement_auth_service_role
  on public.reviewer_agreement_authorizations
  for all to service_role using (true) with check (true);
```

---

## 3. Freeze authority is untouched

The reviewer's sequence ends at `agreement authorized → review submitted → review receipt`.
`reviewerAgreement.ts` binds nothing from any freeze, publish or canonisation surface — the
canary asserts this by import authority, not by grep, so the module can state its own
prohibitions in prose without tripping it. Freeze remains a separate governed act by an
authorized steward or investigator.

---

## 4. `WALLET-BACKUP-001` — registered, not built

**Pseudonymous Cross-Device Encrypted Wallet Restoration.** Scoped following the custody
audit (`2026-08-02_wallet-custody-and-password-identity-audit.md`, classification **B**).

### Current implementation status (operator-ratified wording)

```
LOCAL WALLET ACCESS ............... operational
PASSKEY PASSPORT AUTHENTICATION ... operational, diagnostics still to verify
PERSONA/ACCOUNT AUTHENTICATION .... operational
CROSS-DEVICE WALLET RESTORATION ... unavailable
REMOTE ENCRYPTED ENVELOPE ......... exists, but write-only to the client
```

These remain distinct and must never be collapsed:

```
account/persona authentication
  ≠ wallet restoration
  ≠ wallet unlock
  ≠ wallet control proof
```

A valid, expected state is **session active + wallet unavailable on this device**.
Consequential signing stays blocked until the wallet is actually restored or paired.

### Hard constraint

**Do not expose `personas.evm_key` through a persona lookup endpoint.** A route returning
encrypted wallet ciphertext from a persona identifier alone is an offline brute-force and
enumeration surface — the persona is a *locator*, not a secret.

### Design questions to answer before building

- how persona lookup avoids enumeration
- how password guessing is rate-limited and server-hardened
- whether OPAQUE/aPAKE (RFC 9807) or equivalent is used
- how the envelope is released without becoming an offline oracle
- how integrity and versioning are verified
- how a password change rewraps the envelope
- how backups are revoked and rotated
- how clean-device restoration is receipted

### Required receipts

`wallet_backup_created` · `wallet_backup_restored` · `wallet_backup_rotated` ·
`wallet_backup_revoked`

### Long-term password UX target

One user-entered secret → **purpose-separated derived credentials**. Not literal reuse of
one stored credential across account authentication and wallet encryption — that would send
the wallet-wrapping secret to a server and destroy the property that makes remote envelope
storage safe. This migration is **not** part of the sign-in repair.
