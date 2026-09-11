# x409 Locker Exchange (built) + Participation v1 IA (ratified) — 2026-07-18

## Part 1 — BUILT: the invitation → locker → sign workflow

The x409 agreement now travels through the Passport Locker as a claimable
contract item (operator direction: "use the locker as the bearer token; the
only integration is the x409 contracts into that workflow").

### The flow, end to end

1. **Issue invitation** (admin): `POST /api/constitutional/agreement/invite`
   `{ agreementId, label? }` → unguessable `x409-…` code + invitation URL
   pointing at IRL OS → Participation → Locker with `?x409=<code>`.
2. **Invitee claims** (Austin, signed in): the Locker tab reads `?x409=`,
   pre-fills the claim input; `POST /api/polity-passport/locker/claim-agreement`
   materialises the agreement as an encrypted locker item. Display name
   carries only the T2-safe commitment `[x409:<sha256-16>]` — the raw
   agreementId lives inside the encrypted payload and the invitation record,
   never in locker metadata (HMS identifier-isolation rule).
3. **Review & execute**: the locker item shows "Review & execute contract" —
   lifecycle chips (formed → accepted → authorized → executed), bounded-
   authority terms, and "Accept terms as the named agent," which drives the
   existing public x409 route (acceptance binds only `selectedAgentRef`).
4. **Authorization stays operator-only** on the gated route — Principal–
   Delegate Separation untouched. QubeTalk channels + locker grants (already
   live in the Locker tab) carry the ongoing exchange.

### Files

- `supabase/migrations/20260724000000_x409_invitations.sql` — invitations table
- `app/api/constitutional/agreement/invite/route.ts` — issue/list (admin)
- `app/api/polity-passport/locker/claim-agreement/route.ts` — invitee claim
- `app/api/polity-passport/locker/agreement/[itemId]/route.ts` — holder review view
- `app/triad/components/codex/tabs/LockerTab.tsx` — claim box + contract panel

### Operator runbook (Austin engagement)

```sql
-- 1. Supabase SQL editor (once):
CREATE TABLE IF NOT EXISTS public.x409_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  agreement_id text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_item_id text
);
CREATE INDEX IF NOT EXISTS x409_invitations_code_idx ON public.x409_invitations (code);
ALTER TABLE public.x409_invitations ENABLE ROW LEVEL SECURITY;
```

Then (browser console on dev-beta, signed in as admin — uses the standard
Bearer-token snippet from CLAUDE.md):

```js
(async () => {
  const k = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const parsed = JSON.parse(localStorage.getItem(k));
  const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
  const r = await fetch('/api/constitutional/agreement/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agreementId: '<the formed agreement id>', label: 'IRL Phase-1 Independent Review — project initiation' }),
  });
  console.log(await r.json()); // → { code, inviteUrl }
})();
```

Send `inviteUrl` to Austin. He signs up, lands on the Locker, claims, and the
contract is in his locker to execute.

## Part 2 — RATIFIED (design, build next): Participation v1

Operator + Aletheon consolidated IA (2026-07-18). Participation is the
constitutional runtime viewed from the participant's perspective — an
orchestration layer over capabilities that already exist (Passport, Locker,
QubeTalk, x409, delegation, wallet/identity), not a new system.

Navigation (complete v1):

```
Participation
  Overview      — constitutional status page (per-role: reviewer vs operator)
  Invitations   — invitation → agreement is the first step of every collaboration
  Passport      — as-is (identity)
  Agreements    — everything x409: incoming/outgoing/pending/active/completed/revoked
                  (open → sign → delegate → receipt — "DocuSign, but constitutional")
  Locker        — the constitutional workspace (agreement docs, reviewer kits,
                  QubeTalk conversations, receipts, submitted results — the
                  secure project room; QubeTalk = conversation around artifacts)
  Cohorts       — the collaboration layer (Phase 1 Review: Austin, Claude, Dele; later
                  universities/labs/partners)
  Standing      — reach, receipts, contribution history, validation
  Submissions   — results, reviews, comments, receipts, published, pending
```

Canonical lifecycle every collaboration follows:
invitation → agreement → passport → delegation → locker → QubeTalk →
experiment → submission → standing.

### Consolidation (operator, same day)

The executable v1 collapses further: **Agreements live inside the Locker**
(the claim box + Review & execute panel — no separate Agreements tab),
**no Cohorts tab**, and **Standing is added as a Participation tab**.
Final Participation nav: Overview · Apply · Delegation · Locker (invitations
+ agreements + QubeTalk inline) · Passport Registry · **Standing** ·
Steward (admin).

Standing shipped as `ParticipationStandingTab` (both cartridges): standing
lanes (personal/delegated/stewardship/capability + overall + band), reach
(reputation, lifetime CVs, tasks completed), and the receipted contribution
history — composed from the existing `/api/wallet/tasks` and
`/api/assistant/receipts` endpoints, no new server surface. Submissions
remains the one deferred surface.
