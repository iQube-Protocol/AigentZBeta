# Homecoming Closeout WP-C6 — Gmail correspondent extraction: deferred

**Status:** Gmail correspondent extraction — blocked pending `persona_contacts.source` schema extension and confirmed Gmail read-scope authorization.

## What shipped in this pass

WP-C6 was reduced to integration of the existing contact substrate, per operator decision (2026-08-17). Nothing below required new storage or a new import path:

- Confirmed `app/api/assistant/draft-email/route.ts` already resolved recipients against `persona_contacts` (CSV, vCard, and Google Contacts imports, plus the FTS-indexed dedupe store, all pre-existing and untouched).
- Extracted that inline resolution into one canonical resolver: `services/contacts/resolveRecipient.ts` (`resolveRecipientFromPrompt`).
- Fixed the real gap: the prior inline logic took the first full-text-search match unconditionally (`.limit(1)`), silently guessing whenever more than one contact matched. The resolver now returns `'ambiguous'` with every candidate when 2+ distinct contacts match, and the route surfaces that as `recipientAmbiguity` in its response instead of guessing.
- Fixed `services/agents/draftEmail.ts`'s template (no-LLM-key) fallback path, which previously dropped a resolved recipient's email (`to: ''` unconditionally) even when one had been resolved — the LLM path already respected it via the `RESOLVED RECIPIENT` prompt block; the template path now does too.
- Proved the full chain — natural-language recipient → `persona_contacts` resolution → Gmail draft `to` field — with tests, including the template fallback path (`tests/homecoming-closeout-wpc6-contact-resolution.test.ts`).

## Why Gmail correspondent extraction was not built tonight

Two independent things are missing, and neither was authorized to change in this closeout:

1. **`persona_contacts.source` has a closed `CHECK` constraint** (`supabase/migrations/20260622100000_persona_contacts_sources.sql`): `google_contacts`, `vcard`, `icloud`, `linkedin`, `outlook`, `csv`, `manual`. There is no value that honestly represents "derived from Gmail correspondence, not a saved address-book entry." Reusing `'manual'` and hiding the real provenance in the free-text `notes` column was considered and explicitly rejected (operator decision, 2026-08-17): that would create a knowingly misleading data model and make future filtering/repair harder. Distinguishing "this address came from correspondence" from "this is a saved contact" is a real product requirement of the original closeout brief (WP-C6, Source B) — encoding it correctly requires a new allowed `source` value, which is a schema change.
2. **Gmail OAuth read authorization is unconfirmed for already-connected personas.** `services/google/oauth.ts` currently requests `gmail.compose` + `gmail.modify` for new connections. Google's official scope documentation states `gmail.modify` includes read access ("Read, compose, and send emails from your Gmail account"), which would mean no NEW scope needs requesting for personas connecting from now on — but expanding what the app actually DOES with an existing grant (reading message headers, not just composing/sending) is itself a consequential, user-facing change in what the persona should reasonably expect the connection to be used for, and is being treated as requiring explicit confirmation before implementation, not inferred from the scope string alone. Permission-surface changes are being kept as a distinct, separately-authorized step from the delegation-authority seam built in WP-C2/C3.

Per operator decision (2026-08-17), this closeout does **not** silently widen OAuth consent or add a schema migration. The existing CSV/vCard/Google Contacts substrate is the operational contact path for tomorrow.

## Exact follow-on required (separate, deliberate change)

1. Add a dedicated `persona_contacts.source` value (e.g. `gmail_correspondence`) via a real migration — extend the existing `CHECK` constraint additively, the same way `20260622100000_persona_contacts_sources.sql` added `icloud`/`linkedin`/`outlook`/`csv` to the original `google_contacts`/`vcard`/`manual` set. Never repurpose an existing value to carry a different meaning.
2. Confirm (or explicitly re-request) Gmail read-scope authorization — get an explicit operator/product decision on whether the existing `gmail.modify` grant is being knowingly used for message reads, or whether a narrower, more legible scope (e.g. `gmail.metadata`) should be requested instead and existing connections re-consented.
3. Extract only `From` / `To` / `Cc` headers and thread/timestamp metadata needed for frequency/recency ranking — never message bodies (unchanged from the original brief).
4. Merge extracted correspondents into `persona_contacts` via the existing dedupe path (`(persona_id, source, source_id)` unique index), using the new `source` value from step 1 — reuse the existing insert/merge logic, never a second contact store.
5. Keep correspondence-derived provenance visibly distinct from saved-address-book contacts everywhere it's surfaced (UI badges, search ranking, any future "is this a real contact or just someone I've emailed" distinction) — the whole point of not overloading `'manual'`.

## Reference

- Recipient resolver: `services/contacts/resolveRecipient.ts`
- Wired at: `app/api/assistant/draft-email/route.ts`
- Tests: `tests/homecoming-closeout-wpc6-contact-resolution.test.ts`
- Contact substrate (unchanged, reused): `supabase/migrations/20260622000000_persona_contacts.sql`, `20260622100000_persona_contacts_sources.sql`, `app/api/contacts/{csv-import,vcard-import,google-import}/route.ts`
