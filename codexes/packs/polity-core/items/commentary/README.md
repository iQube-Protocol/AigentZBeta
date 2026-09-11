# Polity Paper Series — Constitutional Commentary

This section holds **machine-readable, human-legible** extractions of the
**Polity Paper series** (published in the Qriptopian codex) as the Polity's
**constitutional commentary** — interpretive, authoritative work that the
ratified charters cross-reference where their concepts are invoked
(Proof of Work Potential, Proof of Time Saved, Time Sovereignty, Experience
Sovereignty, and the rest of the series).

Commentary is **not ratified law**. The one paper elevated to ratified
constitutional status is *The Constitution of the Agentic Polity* (the 4th
paper of the Polity series), which lives under the **Constitution** section and
in `services/polity/frameworks/constitution-agentic-polity.v1.json`.

## How this section is populated

The papers are stored as PDFs in the Qriptopian codex (`codex_media_assets`,
`series='qriptopian'`) and enumerated by `GET /api/codex/qripto/papers`. They
are converted to markdown and indexed by:

```
node scripts/ingest-polity-papers.mjs --host=https://dev-beta.aigentz.me
```

That script downloads each paper's (public) PDF, extracts the text to markdown
under `items/commentary/<series>/`, rewrites this pack's commentary collections
to list the real papers, and regenerates the machine-readable index at
`services/polity/frameworks/polity-papers-commentary.v1.json` (served via
`GET /api/polity-core/constitution`).

Until that run completes for a given environment, this placeholder stands in for
the series list.

## The three series

- **Experience Sovereignty** (`papers/experience-sovereignty`)
- **COYN Thesis** (`papers/coyn-thesis`)
- **The Polity** (`papers/polity`) — includes the Constitution of the Agentic Polity
