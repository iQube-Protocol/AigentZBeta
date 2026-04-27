# Developer Standards

This document defines the standards for building on AgentiQ OS — cartridges, agents, skills, and experience qubes.

## Cartridge Standards

A cartridge is a self-contained experience module. Every cartridge must have:

### Required Files
```
codexes/packs/<pack-id>/
  meta.json          ← Pack identity, visibility, owner
  collections.json   ← Tab/collection structure
  items/             ← Markdown and JSON content
```

### meta.json Schema
```json
{
  "pack_id": "pack_<name>_v<version>",
  "name": "Human-readable name",
  "description": "One-sentence description",
  "version": "0.1.0",
  "visibility": "public | private | tenant",
  "orientation": "developer | end-user | admin | operator",
  "tags": ["tag1", "tag2"],
  "owner": "system | <org-slug>"
}
```

### collections.json Schema
```json
{
  "collections": [
    {
      "id": "col_<name>",
      "title": "Human-readable title",
      "items": ["items/file.md"]
    }
  ]
}
```

### Content Standards
- All items must be markdown (`.md`) or JSON (`.json`)
- Filenames: `lowercase-hyphenated.md`
- No absolute paths or environment-specific references in markdown
- Images: reference by relative path to `items/assets/`
- No hardcoded URLs — use relative doc links

---

## AigentQube Standards

Every registered agent must declare:

```typescript
interface AigentQubeRegistration {
  label: string                    // Human-readable agent name
  type: 'copilot' | 'franchise' | 'metavatar' | 'specialist'
  capabilities: AgentCapability[]  // What the agent can do
  policyBindings: PolicyBinding[]  // Access control constraints
  trustBand: TrustBand             // L1–L5 classification
  rootDid: string                  // Root DiD — accountability anchor
  systemPrompt?: string            // Base instruction (server-side only)
  modelPreference?: string         // Default model
  temperature?: number             // 0.0–1.0 (default: 0.2 for grounded agents)
}
```

### Grounding Requirement
All production agents (`L3+`) must be grounded in a declared KB. Ungrounded speculation is a policy violation. Temperature ≤ 0.3 is recommended for grounded agents.

### Policy Binding Standards
Every agent must declare at minimum:
- `access` binding — which surfaces the agent can operate on
- `content` binding — what disclosure classes the agent can read

---

## ExperienceQube Standards

An ExperienceQube packages a user journey across the depth ladder:

```
ExperienceQube
  ├── L0 pill      (≤30s, static)
  ├── L1 capsule   (≤2min, interactive)
  ├── L2 mini_runtime (≤10min, stateful)
  └── L3 codex     (persistent, copilot-enabled)
```

Each depth level must be independently deliverable. Skipping levels is not permitted by the NBE routing system.

---

## SkillQube Standards

A SkillQube is a discrete, deployable unit of agent capability:

- Single responsibility: one skill does one thing well
- Declared input/output schema (TypeScript interface)
- Version-pinned: semver, breaking changes bump major version
- Trust band: declare minimum trust band required to invoke
- No side effects outside declared output schema

---

## Naming Conventions

| Asset | Convention | Example |
|-------|-----------|---------|
| Pack ID | `pack_<name>_v<N>` | `pack_agentiq_os_v0` |
| Collection ID | `col_<slug>` | `col_start_here` |
| Tab slug | `lowercase-hyphenated` | `start-here` |
| Agent ID | `<name>-<role>` | `aigent-c-os` |
| Root DiD | `did:iqube:<name>-root` | `did:iqube:aigent-c-os-root` |

---

## Security Standards

1. **No secrets in content files** — markdown and JSON in `items/` is mirrored to the public repo
2. **No hardcoded API keys, tokens, or credentials** — ever
3. **Declare disclosure class** on all content — default to `tenant` if unsure
4. **Path traversal prevention** — the write-doc endpoint sanitizes all paths; do not attempt to write outside `items/`
5. **No sovereign data in public content** — `disclosure_class: 'sovereign'` content must never appear in pack markdown
