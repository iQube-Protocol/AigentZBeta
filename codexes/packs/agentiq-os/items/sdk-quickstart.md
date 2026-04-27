# SDK Quickstart

## Installation

```bash
npm install @agentiq/sdk
# or
yarn add @agentiq/sdk
# or
pnpm add @agentiq/sdk
```

The SDK requires Node.js 18+ and TypeScript 5+.

## Create a Cartridge

```bash
npx agentiq init my-cartridge
cd my-cartridge
```

This scaffolds:
```
my-cartridge/
  codexes/packs/my-cartridge/
    meta.json
    collections.json
    items/
      start-here.md
  src/
    tabs/
      MyCartridgeTab.tsx
```

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

## Register Your Agent

```typescript
import { AigentQubeRegistry } from "@agentiq/sdk";

const registry = new AigentQubeRegistry();

await registry.register({
  label: "My Aigent",
  type: "copilot",
  capabilities: [
    { type: "knowledge_retrieval", scope: "my-cartridge-kb" },
    { type: "document_creation", scope: "my-cartridge-items" },
  ],
  policyBindings: [
    {
      policyId: "access-my-cartridge",
      policyType: "access",
      policyName: "My Cartridge Access",
      enforced: true,
      parameters: { allowed_surfaces: ["my-cartridge"] },
    },
  ],
  trustBand: "L1_EXPERIMENTAL",
  rootDid: "did:iqube:my-aigent-root",
  temperature: 0.2,
});
```

## Create a Persona

```typescript
import { PersonaCreation } from "@agentiq/sdk";

const persona = await PersonaCreation.create({
  displayName: "My Dev Persona",
  identifiability: "pseudo",
  appOrigin: "my-cartridge",
});

console.log(persona.id);       // Bounded persona ID
console.log(persona.rootDid);  // Root DiD — accountability anchor
```

## Grant Bounded Delegation

```typescript
import { DelegationService } from "@agentiq/sdk";

const delegation = new DelegationService();

const handoff = await delegation.grant({
  personaId: persona.id,
  cartridgeScope: "my-cartridge",
  allowedActions: ["document_creation", "knowledge_retrieval"],
  ttlHours: 4,
});

console.log(handoff.handoff_id);
console.log(handoff.policy_envelope.disclosure_class); // 'tenant'
```

## Connect to SmartTriad Copilot

```typescript
import { SmartTriadClient } from "@agentiq/smarttriad";

const copilot = new SmartTriadClient({
  personaId: persona.id,
  cartridgeScope: "my-cartridge",
  chatRoute: "/api/codex/chat/my-cartridge",
  enableInferenceRendering: true,
});
```

## Publish to Registry

```bash
npx agentiq publish --pack my-cartridge --trust-band L1_EXPERIMENTAL
```

This submits your pack to the Registry as `L1_EXPERIMENTAL`. Community review can promote it to `L2_VERIFIED_COMMUNITY`.

## Environment Variables

```env
# Required
AGENTIQ_SDK_KEY=your-sdk-key

# Optional — defaults shown
AGENTIQ_REGISTRY_URL=https://registry.agentiq.io
AGENTIQ_TRUST_BAND=L1_EXPERIMENTAL
AGENTIQ_DEFAULT_TTL_HOURS=4
```

## Further Reading

- [What Is AgentiQ OS](what-is-agentiq-os.md)
- [Protocol Reference](protocols.md)
- [Developer Standards](dev-standards.md)
- [Bounded Delegation](bounded-delegation.md)
- [Reference Runtime](reference-runtime.md)
