# Accession invitation — the one-link entry point + Austin's email — 2026-07-19

## What was built

The invitation is now a **constitutional object with two representations**
behind one link:

- **`/invite/<code>`** — the human-readable accession page. Shows role,
  programme, the onboarding ladder (human constitutional acts marked
  "you"), the constitutional boundary, and ONE button: **Begin Review**
  (deep-links the code into IRL OS → Participation → Locker claim).
  **Observer-aware (v1 + phase-2 stub):** the page reads the invitation's
  live status — once claimed it stops surfacing onboarding and becomes the
  participant's IRL welcome ("Welcome back… Continue in the Lab"), with
  phase 2 folding fuller progress observation (agreement lifecycle,
  delegation, submissions) into the same surface.
- **`/api/public/irl/accession?code=…`** — the machine-readable twin,
  linked from the page as "For AI agents". Serves the agent's instruction
  set: schema `irl-accession/v1`, role/programme/status, the step-by-step
  workflow (with HUMAN ACT steps explicitly marked), the constitutional
  boundary statement, and every resource URL (dashboard, apply, delegation,
  locker claim, protocol doc, agreement API, results-submit API). Works for
  both `pinv-…` (access) and `x409-…` (agreement) codes. Status-aware: a
  claimed invitation returns the post-onboarding workflow.

Both invitation issuers (`/api/steward/participation/invitations` and
`/api/constitutional/agreement/invite`) now return `/invite/<code>` as the
inviteUrl — so the steward workspace hands you exactly the link to send.

**No separate JSON file needs to be attached to the email.** The page IS
the entry point; a capable agent given the page URL discovers and consumes
the accession object itself. (If Austin wants the raw JSON, it's one click
from the page.)

## How to generate Austin's link

Participation → Steward → **Access & Invitations** → Research Lab →
role `reviewer`, label `Phase 1 Independent Review — Austin`, max uses 1,
expiry as preferred → **Issue bearer invitation** → copy the invite URL.

## The email (copy, insert the link, send)

> **Subject:** Invitation to Join the Invariant Research Lab — Phase 1 Independent Review Programme
>
> Hi Austin,
>
> I'd like to invite you, together with your Claude research agent, to
> participate as an Independent Reviewer in the Invariant Research Lab's
> Phase 1 evaluation programme.
>
> The purpose is straightforward: to independently review, reproduce, and
> challenge our experimental work on Invariant Intelligence. We're not
> asking you to agree with our conclusions — we're inviting you to inspect
> our methods, execute the experiments independently, and tell us where
> we're wrong.
>
> Your participation is governed through our constitutional collaboration
> framework: explicit agreements, bounded delegation for your Claude agent,
> immutable provenance, and receipted submission of experimental results.
>
> Everything required to participate is contained in the invitation:
>
> **Begin here: [your /invite/<code> link]**
>
> The invitation page contains the programme overview, reviewer
> documentation, the experimental protocol, the constitutional agreement,
> and the onboarding workflow — with instructions for both you and Claude.
> Give the same link to Claude: the page carries a machine-readable
> accession object your agent will use to administer your onboarding, while
> the constitutional acts (accepting terms, claiming, delegating authority)
> remain yours. Onboarding takes about 10–15 minutes.
>
> We're looking forward to your review.
>
> Many thanks,
>
> Dele Atanda
> Founder, Invariant Research Lab

## The primitive

Nothing here is Austin-specific: role, programme, and permissions are the
invitation's configuration; the page, the accession object, and the
workflow are shared. The same link pattern serves reviewers, university
researchers, enterprise pilots, auditors, and partners — and in the
Financial Services Programme it inverts cleanly: a marketer's agent hands
its prospective operator an accession link, administers their onboarding,
and receives bounded delegation back once the human completes the
constitutional acts.
