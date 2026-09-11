# metaMe Companion — Chrome Web Store listing

This is the store-facing copy for the `extension/companion-observer/` package. It exists
separately from `manifest.json` because Chrome enforces a hard 132-character limit on the
manifest `description` field — anything richer than that one-line summary belongs here, not in
the manifest.

Do not fold this content back into the manifest. If the manifest description needs to change,
change it directly in `extension/companion-observer/manifest.json` and keep it under 132
characters; this file is not a source the manifest reads from.

---

## Product name

metaMe Companion

## Tagline

Your personal companion for the sovereign web.

## Short store description

Your personal companion for the sovereign web—securely access your Passport, Agent Me and metaMe
experiences.

## Long description

metaMe Companion is your gateway into the metaMe ecosystem — the sovereign identity layer that
keeps you, not a platform, in control of your data.

**Agent Me** is your personal AI companion, acting on your behalf across the sites and services
you choose to bring it into. It only sees what you explicitly let it see.

**Passport** is your portable, sovereign identity — the credential you carry with you, verifiable
without handing your data to every service that asks for it.

**SmartTriad Wallet** holds your assets, credentials, and entitlements in one place, under your
control.

Companion works through **consent-based observation**: it reads browser context only where you've
explicitly granted access, and nothing is captured without your say-so. Every capture is
**user-initiated** — you decide what crosses from a page into your metaMe experience, never the
extension deciding for you.

This is constitutional computing: identity, consent, and data sovereignty are structural
guarantees of the system, not settings you have to go find and turn on.

---

## Manifest vs. store listing — division of responsibility

| Belongs in `manifest.json` | Belongs here |
|---|---|
| Short, literal description (≤132 chars) Chrome validates at upload | Tagline, short/long description, feature narrative |
| `name` / `short_name` — the product name users see | Marketing framing of that name |
| Technical fields (`permissions`, `icons`, `background`, etc.) | Privacy narrative, constitutional-computing framing |

Internal specs (PRD numbers, increment numbers, architecture references, Companion API details)
belong in neither surface — they live in the engineering docs under `codexes/packs/` and this
repo's own history, not in anything Chrome or an end user reads.
