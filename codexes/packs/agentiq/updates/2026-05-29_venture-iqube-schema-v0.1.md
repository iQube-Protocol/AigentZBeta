# Venture iQube — operator-strategy schema v0.1

**Date:** 2026-05-29
**Status:** spec · v0.1 draft · candidate to promote into the iQube system
**Surface:** aigentMe (ExperienceQube hydrate + IntentQube generation)
**Schema id:** `https://aigentz.me/schemas/venture-iqube/v0.1.json`

## Purpose

A single shareable JSON file an operator (or ChatGPT acting on the operator's behalf) emits that captures:

- Personal positioning + strategic thesis
- One or more ventures with named objectives, KPIs, North Stars
- Cartridge bindings per venture (Marketa / KNYT / Qriptopian / metaMe Studio / AgentiQ OS / Venture Lab)
- Time-horizoned action plans at four bands: today / 24h / 7d / 30d / 90d
- Specialist hand-off preferences per venture

aigentMe ingests this file once, hydrates ExperienceQube + IntentQube + the NBE catalog filters, and from that point forward serves contextual Briefs, Move-forwards, Venture progress reports, and Specialist consults grounded in the operator's actual strategy instead of the cold-open templates.

The schema is **versioned + shareable** — v0.1 is intentionally narrow so a real operator (e.g. dele@metame.com with KNYT / Qriptopian / metaMe ventures) can populate it today; v0.2+ will extend with reputation hooks, runway/burn, agent grants, etc.

## The JSON Schema

Paste this into ChatGPT verbatim with a prompt like *"Populate this venture iQube schema with my strategy. I run three ventures: A, B, C. Here's what I know about each…"* and ChatGPT will emit a valid Venture iQube JSON file.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://aigentz.me/schemas/venture-iqube/v0.1.json",
  "title": "Venture iQube",
  "description": "Operator strategy + venture objectives + 24h/7d/30d/90d action plan, ingestible by aigentMe.",
  "type": "object",
  "required": ["schemaVersion", "operator", "strategy", "ventures", "plan"],
  "additionalProperties": false,
  "properties": {
    "schemaVersion": {
      "const": "venture-iqube/v0.1",
      "description": "Pin the schema version so aigentMe can validate + migrate forward."
    },
    "emittedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO timestamp of when this file was generated."
    },
    "operator": {
      "type": "object",
      "required": ["displayLabel", "archetype"],
      "additionalProperties": false,
      "properties": {
        "displayLabel": {
          "type": "string",
          "description": "The name aigentMe should use to address the operator. T1-safe — never the legal name unless the operator says so."
        },
        "archetype": {
          "type": "string",
          "enum": [
            "founder",
            "operator",
            "investor",
            "creator",
            "collector",
            "advisor",
            "specialist"
          ],
          "description": "Primary identity. Drives default NBE bias (e.g. 'founder' → ship velocity; 'investor' → diligence)."
        },
        "tagline": {
          "type": "string",
          "maxLength": 200,
          "description": "One-line public positioning. Surfaces in copilot intros."
        },
        "fioHandle": {
          "type": "string",
          "pattern": "^[^@]+@[^@]+$",
          "description": "Optional FIO handle if the operator wants Marketa / outbound flows to address them by it."
        }
      }
    },
    "strategy": {
      "type": "object",
      "required": ["headline", "thesis"],
      "additionalProperties": false,
      "properties": {
        "headline": {
          "type": "string",
          "maxLength": 140,
          "description": "One-sentence strategic thesis. The operator's North Star. Shows on every Brief header."
        },
        "thesis": {
          "type": "string",
          "maxLength": 1500,
          "description": "Long-form thesis: what the operator is building, why now, why them. Used by aigentMe LLM context."
        },
        "currentStage": {
          "type": "string",
          "enum": ["prospect", "acolyte", "keta", "keji", "first", "zero"],
          "description": "Operator's spot on the metaMe progression ladder. Drives Capsule defaults."
        },
        "blockers": {
          "type": "array",
          "items": { "type": "string", "maxLength": 300 },
          "maxItems": 5,
          "description": "Top blockers right now. aigentMe biases NBEs that unblock these first."
        },
        "constraints": {
          "type": "array",
          "items": { "type": "string", "maxLength": 300 },
          "maxItems": 5,
          "description": "Hard constraints (capital, time, regulatory, etc.) aigentMe should never violate."
        }
      }
    },
    "ventures": {
      "type": "array",
      "minItems": 1,
      "maxItems": 10,
      "items": { "$ref": "#/definitions/venture" }
    },
    "plan": {
      "type": "object",
      "required": ["today", "next24h", "next7d", "next30d", "next90d"],
      "additionalProperties": false,
      "properties": {
        "today":   { "$ref": "#/definitions/planHorizon" },
        "next24h": { "$ref": "#/definitions/planHorizon" },
        "next7d":  { "$ref": "#/definitions/planHorizon" },
        "next30d": { "$ref": "#/definitions/planHorizon" },
        "next90d": { "$ref": "#/definitions/planHorizon" }
      }
    },
    "specialistPreferences": {
      "type": "object",
      "description": "Which specialist to hand off to by default for each task class. Pure preference — aigentMe still routes via the spine.",
      "additionalProperties": false,
      "properties": {
        "outreach":         { "$ref": "#/definitions/specialistId" },
        "research":         { "$ref": "#/definitions/specialistId" },
        "drafting":         { "$ref": "#/definitions/specialistId" },
        "diligence":        { "$ref": "#/definitions/specialistId" },
        "operations":       { "$ref": "#/definitions/specialistId" },
        "treasury":         { "$ref": "#/definitions/specialistId" },
        "platformGuidance": { "$ref": "#/definitions/specialistId" }
      }
    },
    "kpiBoard": {
      "type": "array",
      "description": "Cross-venture top-level KPIs (revenue, runway, audience, holders). Each has a target + horizon.",
      "items": { "$ref": "#/definitions/kpi" },
      "maxItems": 12
    }
  },
  "definitions": {
    "specialistId": {
      "type": "string",
      "enum": [
        "marketa",
        "quill",
        "kn0w1",
        "aigent-z",
        "aigent-c",
        "aigent-nakamoto",
        "moneypenny",
        "metaye"
      ]
    },
    "cartridgeSlug": {
      "type": "string",
      "enum": [
        "metame",
        "knyt",
        "qriptopian",
        "marketa",
        "agentiq-os",
        "venture-lab",
        "avl",
        "moneypenny"
      ]
    },
    "horizon": {
      "type": "string",
      "enum": ["today", "next24h", "next7d", "next30d", "next90d"]
    },
    "kpi": {
      "type": "object",
      "required": ["name", "metric", "target", "horizon"],
      "additionalProperties": false,
      "properties": {
        "name":      { "type": "string", "maxLength": 80 },
        "metric":    { "type": "string", "maxLength": 200, "description": "What is being measured + units." },
        "current":   { "type": ["string", "number", "null"] },
        "target":    { "type": ["string", "number"] },
        "horizon":   { "$ref": "#/definitions/horizon" },
        "ventureId": { "type": "string", "description": "Optional binding to a venture in `ventures[].id`; null for cross-venture KPIs." }
      }
    },
    "objective": {
      "type": "object",
      "required": ["id", "title", "impact", "effort"],
      "additionalProperties": false,
      "properties": {
        "id":       { "type": "string", "pattern": "^[a-z0-9-]+$", "description": "Short slug, unique within the venture." },
        "title":    { "type": "string", "maxLength": 140 },
        "summary":  { "type": "string", "maxLength": 600 },
        "impact":   { "type": "string", "enum": ["low", "medium", "high", "critical"] },
        "effort":   { "type": "string", "enum": ["light", "medium", "heavy"] },
        "horizon":  { "$ref": "#/definitions/horizon" },
        "successCriteria": {
          "type": "array",
          "items": { "type": "string", "maxLength": 300 },
          "maxItems": 5
        },
        "dependencies": {
          "type": "array",
          "items": { "type": "string", "description": "objective.id this depends on (same venture or another via 'ventureId:objId')." }
        },
        "specialistHint": { "$ref": "#/definitions/specialistId" }
      }
    },
    "venture": {
      "type": "object",
      "required": ["id", "name", "objectives"],
      "additionalProperties": false,
      "properties": {
        "id":        { "type": "string", "pattern": "^[a-z0-9-]+$", "description": "Stable slug for this venture (e.g. 'meta-knight')." },
        "name":      { "type": "string", "maxLength": 140 },
        "tagline":   { "type": "string", "maxLength": 200 },
        "stage":     {
          "type": "string",
          "enum": ["idea", "validation", "build", "launch", "scale", "harvest"],
          "description": "Venture-level stage. Independent of the operator's metaMe ladder stage."
        },
        "cartridgeBindings": {
          "type": "array",
          "items": { "$ref": "#/definitions/cartridgeSlug" },
          "description": "Which cartridges this venture runs through. aigentMe scopes NBEs to these."
        },
        "northStarKpi": {
          "type": "string",
          "maxLength": 200,
          "description": "Single sentence describing the metric that, if it moves, the venture is winning."
        },
        "objectives": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "#/definitions/objective" }
        },
        "partners": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name"],
            "properties": {
              "name":    { "type": "string" },
              "role":    { "type": "string" },
              "contact": { "type": "string" },
              "status":  { "type": "string", "enum": ["target", "engaged", "active", "dormant"] }
            }
          },
          "description": "Active + target partners aigentMe / Marketa should know about for outreach drafting."
        },
        "notes": { "type": "string", "maxLength": 2000 }
      }
    },
    "planHorizon": {
      "type": "object",
      "required": ["focus", "actions"],
      "additionalProperties": false,
      "properties": {
        "focus": {
          "type": "string",
          "maxLength": 200,
          "description": "One-line description of what this horizon is about. Surfaces on the Capsule header."
        },
        "actions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["title", "ventureId"],
            "additionalProperties": false,
            "properties": {
              "title":     { "type": "string", "maxLength": 200 },
              "ventureId": { "type": "string", "description": "References ventures[].id" },
              "objectiveId": { "type": "string", "description": "Optional reference to an objectives[].id inside the venture." },
              "owner":     { "type": "string", "description": "'self' or specialist id. Defaults to 'self'." },
              "due":       { "type": "string", "format": "date-time" },
              "blocker":   { "type": "string", "description": "If this action is blocked, why." }
            }
          },
          "maxItems": 12
        }
      }
    }
  }
}
```

## Worked example skeleton

ChatGPT should be able to emit something like this for the operator's three ventures:

```jsonc
{
  "schemaVersion": "venture-iqube/v0.1",
  "emittedAt": "2026-05-29T20:00:00Z",
  "operator": {
    "displayLabel": "Dele",
    "archetype": "founder",
    "tagline": "Building the agentic-internet metaphysical layer.",
    "fioHandle": "dele@metame"
  },
  "strategy": {
    "headline": "Launch metaMe, scale KNYT, ship Qriptopian — in that order.",
    "thesis": "The agentic internet needs a sovereign-identity spine plus a story layer the operator can inhabit…",
    "currentStage": "first",
    "blockers": ["KNYT Qc launch capital", "metaMe brand site"],
    "constraints": ["Cap raise must not dilute founder stake below 60%"]
  },
  "ventures": [
    {
      "id": "metame",
      "name": "metaMe",
      "stage": "launch",
      "cartridgeBindings": ["metame", "agentiq-os"],
      "northStarKpi": "Activated daily personas",
      "objectives": [
        {
          "id": "ship-brand-site",
          "title": "Ship metame.com brand site",
          "impact": "critical",
          "effort": "medium",
          "horizon": "next7d",
          "successCriteria": ["Live on root domain", "Iframe-embeddable in cartridge"],
          "specialistHint": "marketa"
        }
      ]
    },
    {
      "id": "knyt",
      "name": "KNYT",
      "stage": "scale",
      "cartridgeBindings": ["knyt", "marketa"],
      "northStarKpi": "Confirmed Zero KNYT orders",
      "objectives": [{ "id": "lockin-funding", "title": "Secure KNYT Qc funding for launch", "impact": "critical", "effort": "heavy", "horizon": "next30d" }]
    },
    {
      "id": "qriptopian",
      "name": "Qriptopian",
      "stage": "build",
      "cartridgeBindings": ["qriptopian"],
      "northStarKpi": "Live Magazine weekly publish cadence",
      "objectives": [{ "id": "magazine-rhythm", "title": "Hit weekly Live Magazine drops", "impact": "high", "effort": "medium", "horizon": "next30d" }]
    }
  ],
  "plan": {
    "today":   { "focus": "Stabilise aigentMe TTS + finalise venture iQube", "actions": [ { "title": "Confirm Cartesia TTS in prod", "ventureId": "metame" } ] },
    "next24h": { "focus": "Brand site copy lock", "actions": [ { "title": "Approve metame.com hero copy", "ventureId": "metame" } ] },
    "next7d":  { "focus": "Ship brand site + investor email batch", "actions": [ { "title": "Send Zero KNYT Investor Update", "ventureId": "knyt", "owner": "marketa" } ] },
    "next30d": { "focus": "Close KNYT funding + sustain magazine cadence", "actions": [] },
    "next90d": { "focus": "Convert first-ship runway into investor cohort", "actions": [] }
  },
  "specialistPreferences": {
    "outreach": "marketa",
    "drafting": "quill",
    "diligence": "kn0w1",
    "platformGuidance": "aigent-z"
  }
}
```

## How aigentMe will ingest it (target wiring)

1. **Upload surface** — operator drops the Venture iQube JSON into the existing UploadDrawer with `useKind: "venture_iqube"`. New use_kind added to `UploadUseKind` union.
2. **Validation** — server-side route at `/api/persona/venture-iqube/ingest` validates against the v0.1 schema (we ship the JSON Schema as a static asset and use ajv).
3. **Hydration**:
   - `strategy.headline` → `ExperienceQubeMeta.experienceName`
   - `strategy.headline` (short form) → `ExperienceQubeMeta.primaryGoal`
   - `strategy.currentStage` → `ExperienceQubeMeta.currentStage`
   - `union(ventures[].cartridgeBindings)` → `ExperienceQubeMeta.activeCartridges`
   - Each `objective` + `plan.*.actions[]` → `IntentQubeRecord` rows pre-queued in the NBE catalog filter set
   - `kpiBoard[]` → VentureCockpit live KPI cards
4. **Sharing** — the operator can export their populated iQube as a `.venture-iqube.json` file for sharing with partners / advisors, or commit to a private `persona_uploads` entry tagged `use_kind: "venture_iqube"`.

## Why this is a sharable iQube and not just a config file

- The schema is **versioned** (`schemaVersion: "venture-iqube/v0.1"`) so future versions can migrate forward.
- The shape is **iQube-aligned** — every field maps cleanly onto ExperienceQube / IntentQube / future ReputationQube fields, which means later iterations can promote this from "schema we ingest" to "iQube class we mint" without a data-model refactor.
- It's **declarative** — the operator describes their strategy + state, aigentMe derives the live work. That separation means the same iQube file can be re-ingested at a higher stage and aigentMe will naturally drop completed-horizon actions and prioritise the next horizon.

## Roadmap

- **v0.1 (this doc)** — ingestion + ExperienceQube hydrate + IntentQube generation.
- **v0.2** — add `reputation`, `treasury`, `runway`, `team` blocks. Auto-emit DVN receipt when ingested so the operator has a chain-of-custody for their strategy file.
- **v0.3** — encrypt at rest (state-C via the spine), grant scoped access tokens to specialists per venture.
- **v1.0** — promote to a first-class iQube class (`VentureQube`); minted, owned, transferable, with content-gating across the spine.

## Not in scope (yet)

- Live progress tracking against horizon actions (a follow-on backlog item)
- Reputation hooks (`v0.2`)
- Capital structure / equity (`v0.2+`)
- Multi-operator ventures with co-founder grants (`v1.0`)
