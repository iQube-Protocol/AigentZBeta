# Commit Brief: `48086c8` — SmartWalletDrawer: remove mandatory persona-creation gate on sign-in

| Field | Value |
|-------|-------|
| SHA | [`48086c8`](https://github.com/iQube-Protocol/AigentZBeta/commit/48086c86e4c463e99febc53db606dd7065b84408) |
| Author | Claude |
| Date | 2026-05-31T23:37:11Z |
| Branch | dev (direct push) |
| Type | `push` |
| Repo | iQube-Protocol/AigentZBeta |

## Commit Message

```
SmartWalletDrawer: remove mandatory persona-creation gate on sign-in

CRITICAL UX UNBLOCK. Operator-reported infinite loop: a new user signs
up, creates a persona, signs back in, and the system insists they
create another persona — every sign-in. fayeofori@hotmail /
inquisitor@knyt is the operator-reported case.

Root cause: the SmartWalletDrawer useEffect at L815 auto-opens the
PersonaSetupWizard in mandatory mode whenever sessionEmail is set AND
allAvailablePersonas.length === 0. The previous comment block called
out two race-condition guards (wait-for-loading + close-when-personas-
appear) but didn't address the harder failure mode: when the persona
row exists in the DB but isn't surfacing via /api/wallet/personas
(RLS / auth_profile mismatch / consolidation gap), the user lands at
"zero personas" on every session refresh, the mandatory wizard
re-opens, they complete it again, and the cycle repeats. Mandatory
mode hides the cancel button, so there's no escape hatch.

Operator policy reversal: persona creation is no longer mandatory on
sign-in. Users can sign in without owning a persona — they land on
the cartridge, see the existing "Create your first persona" CTA in
the drawer, and open the wizard themselves when they choose.
Persona-requiring actions (compose, sign, mint) handle their own
contextual prompts at the point of need.

Change: the auto-open branch of the useEffect is gutted. The
auto-close branch (close the wizard cleanly if personas appear while
it's mounted) is preserved as defensive against legacy state or
cross-tab races. setPersonaSetupOpen and setPersonaSetupMandatory
remain wired to the explicit operator-initiated open paths (the "Add
persona" affordance, the per-cartridge first-persona CTA, the
post-action contextual prompts) — those are untouched.

The underlying data bug (inquisitor@knyt exists but doesn't surface
via /api/wallet/personas) still needs investigation as a follow-up —
likely auth_profile_id mismatch between the persona row and the
JWT user. But unblocking the sign-in loop is the priority.
```

## Body

CRITICAL UX UNBLOCK. Operator-reported infinite loop: a new user signs
up, creates a persona, signs back in, and the system insists they
create another persona — every sign-in. fayeofori@hotmail /
inquisitor@knyt is the operator-reported case.

Root cause: the SmartWalletDrawer useEffect at L815 auto-opens the
PersonaSetupWizard in mandatory mode whenever sessionEmail is set AND
allAvailablePersonas.length === 0. The previous comment block called
out two race-condition guards (wait-for-loading + close-when-personas-
appear) but didn't address the harder failure mode: when the persona
row exists in the DB but isn't surfacing via /api/wallet/personas
(RLS / auth_profile mismatch / consolidation gap), the user lands at
"zero personas" on every session refresh, the mandatory wizard
re-opens, they complete it again, and the cycle repeats. Mandatory
mode hides the cancel button, so there's no escape hatch.

Operator policy reversal: persona creation is no longer mandatory on
sign-in. Users can sign in without owning a persona — they land on
the cartridge, see the existing "Create your first persona" CTA in
the drawer, and open the wizard themselves when they choose.
Persona-requiring actions (compose, sign, mint) handle their own
contextual prompts at the point of need.

Change: the auto-open branch of the useEffect is gutted. The
auto-close branch (close the wizard cleanly if personas appear while
it's mounted) is preserved as defensive against legacy state or
cross-tab races. setPersonaSetupOpen and setPersonaSetupMandatory
remain wired to the explicit operator-initiated open paths (the "Add
persona" affordance, the per-cartridge first-persona CTA, the
post-action contextual prompts) — those are untouched.

The underlying data bug (inquisitor@knyt exists but doesn't surface
via /api/wallet/personas) still needs investigation as a follow-up —
likely auth_profile_id mismatch between the persona row and the
JWT user. But unblocking the sign-in loop is the priority.

## Files Changed

| Change | File |
|--------|------|
| Modified | `app/components/content/SmartWalletDrawer.tsx` |

## Stats

 1 file changed, 25 insertions(+), 18 deletions(-)
