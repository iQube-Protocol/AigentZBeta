# SDK Quickstart

The AgentiQ OS SDK (`@agentiqos/agentiq-sdk`) gives you a CLI for scaffolding and publishing cartridges, plus TypeScript classes for the Registry, Persona, and Delegation APIs.

**Requirements:** Node.js 18+ · TypeScript 5+

---

## Installation

```bash
npm install @agentiqos/agentiq-sdk
# or
yarn add @agentiqos/agentiq-sdk
# or
pnpm add @agentiqos/agentiq-sdk
```

Once published to npm, the global CLI will be available as `agentiq`. Until then, invoke it via:

```bash
npx @agentiqos/agentiq-sdk init my-cartridge
# or after npm install, via package scripts:
node_modules/.bin/agentiq init my-cartridge
```

---

## Create a Cartridge

```bash
npx @agentiqos/agentiq-sdk init my-cartridge
cd my-cartridge
npm install
```

This scaffolds:

```
my-cartridge/
  codexes/packs/my-cartridge/
    meta.json             ← Pack identity and metadata
    collections.json      ← KB document structure
    items/
      start-here.md       ← Your first KB document
  agentiq.config.js       ← CLI configuration
  .env.example            ← Environment variable template
  package.json
```

---

## Configure Your Environment

Copy `.env.example` to `.env` and set your instance URL:

```env
AGENTIQ_API_URL=http://localhost:3000
AGENTIQ_PERSONA_ID=your-persona-id    # optional
```

Or set `apiUrl` in `agentiq.config.js`:

```js
module.exports = {
  slug: 'my-cartridge',
  packPath: 'codexes/packs/my-cartridge',
  trustBand: 'L1_EXPERIMENTAL',
  apiUrl: 'http://localhost:3000',
};
```

---

## Define Your Pack

Edit `codexes/packs/my-cartridge/meta.json`:

```json
{
  "pack_id": "pack_my_cartridge_v0",
  "name": "My Cartridge",
  "description": "What this cartridge does",
  "version": "0.1.0",
  "visibility": "public",
  "orientation": "developer",
  "tags": ["my-domain"],
  "owner": "your-org"
}
```

---

## Register an Asset

```typescript
import { AigentQubeRegistry } from '@agentiqos/agentiq-sdk';

// Config is read from AGENTIQ_API_URL env var if not passed
const registry = new AigentQubeRegistry({
  apiUrl: process.env.AGENTIQ_API_URL,
  personaId: 'your-persona-id',
});

const result = await registry.register({
  label: 'My Aigent',
  type: 'AigentQube',           // AigentQube | SkillQube | WorkflowQube | ConnectorQube
  description: 'What this agent does',
  capabilities: ['knowledge_retrieval', 'document_creation'],
  trustBand: 'L1_EXPERIMENTAL',
  rootDid: 'did:iqube:my-aigent-root',
  tags: ['my-domain'],
});

console.log(result.draft);       // Generated manifest JSON
console.log(result.instructions); // Next steps
```

---

## Create a Developer Persona

```typescript
import { PersonaCreation } from '@agentiqos/agentiq-sdk';

const persona = await PersonaCreation.create(
  {
    displayName: 'My Dev Persona',
    identifiability: 'pseudo',   // 'anonymous' | 'pseudo' | 'identified'
    appOrigin: 'my-cartridge',
  },
  { apiUrl: process.env.AGENTIQ_API_URL },
);

console.log(persona.id);       // Bounded persona ID
console.log(persona.rootDid);  // Root DiD — accountability anchor
```

---

## Grant Bounded Delegation

```typescript
import { DelegationService } from '@agentiqos/agentiq-sdk';

const delegation = new DelegationService({
  apiUrl: process.env.AGENTIQ_API_URL,
});

const handoff = await delegation.grant({
  personaId: persona.id,
  cartridgeScope: 'my-cartridge',
  allowedActions: ['knowledge_retrieval', 'draft_document'],
  ttlHours: 4,
  trustBand: 'L1_EXPERIMENTAL',
});

console.log(handoff.handoff_id);
console.log(handoff.policy_envelope.disclosure_class);  // 'tenant'
console.log(handoff.expires_at);

// Read state
const state = await delegation.getState(persona.id);
console.log(state.active, state.actions_taken);

// Revoke
await delegation.revoke(persona.id);
```

---

## Connect to Aigent C-OS (SmartTriad)

`SmartTriadClient` is in the separate `@agentiq/smarttriad` package (React, browser-only):

```typescript
import { SmartTriadClient } from '@agentiq/smarttriad';

const copilot = new SmartTriadClient({
  personaId: persona.id,
  cartridgeScope: 'my-cartridge',
  chatRoute: '/api/codex/chat/agentiq-os',
  enableInferenceRendering: true,
});
```

---

## Publish to Registry

```bash
# From your cartridge root:
npx @agentiqos/agentiq-sdk publish

# With overrides:
npx @agentiqos/agentiq-sdk publish --trust-band L2_VERIFIED_COMMUNITY
npx @agentiqos/agentiq-sdk publish --pack codexes/packs/my-pack --persona-id abc123
```

This generates a Registry draft manifest and emits a receipt-eligible OrchestrationEvent.
Community review can promote it from `L1_EXPERIMENTAL` to `L2_VERIFIED_COMMUNITY`.

---

## CLI Reference

```
agentiq init <name>                    Scaffold a new cartridge
agentiq publish                        Submit pack to Registry
agentiq publish --pack <path>          Specify pack directory
agentiq publish --trust-band <band>    Override trust band
agentiq publish --persona-id <id>      Set persona for submission
agentiq --version                      Print version
agentiq --help                         Show help
```

---

## Trust Bands

| Band | Description |
|------|-------------|
| `L1_EXPERIMENTAL` | Open — anyone can submit |
| `L2_VERIFIED_COMMUNITY` | Community review required |
| `L3_PRODUCTION_CANDIDATE` | Registry candidate for production |
| `L4_PRODUCTION_APPROVED` | Production approved |

---

## Further Reading

- [What Is AgentiQ OS](what-is-agentiq-os.md)
- [Protocol Reference](protocols.md)
- [Developer Standards](dev-standards.md)
- [Bounded Delegation](bounded-delegation.md)
- [Reference Runtime](reference-runtime.md)
