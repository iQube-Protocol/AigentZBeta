# CopilotKit Integration Guide

## Overview

CopilotKit is integrated into Aigent Z as a **server-side orchestration layer** that provides AI-powered assistance for platform operations, tenant management, identity provisioning, wallet operations, and iQube registry management.

## Architecture

### Server-Side Primary Pattern (Standard)

```
Aigent Z Console → CopilotKit Provider → /api/copilotkit → CopilotRuntime → Backend Actions → Services
```

- **Single server-side CopilotKit instance** manages all orchestration
- All tenant/operator interactions use the same server runtime
- **Tenant isolation** via context injection and RBAC
- **No client-side CopilotKit dependencies** for thin clients (standard pattern)

### Client-Side Pattern (Advanced/Secondary)

```
Autonomous Agent → Client-side CopilotKit → AA-API → Aigent Z Services
```

- **Optional pattern** for more autonomous agents
- Requires agent to embed CopilotKit locally
- Still relies on AA-API for all operations
- Deferred for most use cases

---

## Phase 0: Baseline Integration (✅ COMPLETE)

### 1. Dependencies Added

```json
{
  "@copilotkit/react-core": "^1.3.19",
  "@copilotkit/react-ui": "^1.3.19",
  "@copilotkit/runtime": "^1.3.19",
  "@copilotkit/shared": "^1.3.19",
  "openai": "^4.77.0"
}
```

### 2. Components Created

#### `/app/api/copilotkit/route.ts`
- Edge runtime handler for CopilotKit requests
- Integrates OpenAI adapter (GPT-4o)
- Includes comprehensive **Platform Copilot System Prompt**
- Registers all backend actions

#### `/app/layout.tsx`
- Wrapped with `<CopilotKit>` provider
- Runtime URL: `/api/copilotkit`
- Enables AI assistance across entire console

#### `/app/copilot/actions/`
- **registry.ts**: iQube registry, tenant, and Aigent operations
- **wallet.ts**: Agentic Wallet status, balances, transactions
- **identity.ts**: KybeDID, Root DID, Personas, DIDQube cohorts
- **index.ts**: Central export of all actions

### 3. Read-Only Backend Actions (Phase 0)

#### Registry Tools
- `listTenants` - List all platform tenants
- `getTenant` - Get tenant details by ID/slug
- `listAigentsForTenant` - List Aigents for a tenant
- `listIQubesForTenant` - List iQubes by type

#### Wallet Tools
- `getWalletStatusForTenant` - Get Agentic Wallet configuration
- `getWalletBalances` - Get token balances across chains
- `listWalletTransactions` - List recent transactions

#### Identity Tools
- `getIdentityStatusForTenant` - Get identity summary
- `listPersonas` - List Personas for tenant
- `getKybeDIDDetails` - Get KybeDID details (use sparingly)
- `getCohortInfo` - Get DIDQube cohort information

---

## Environment Variables

Add to `.env.local`:

```bash
# Required: OpenAI API Key for CopilotKit
OPENAI_API_KEY=sk-...

# Optional: Alternative LLM providers (future)
# ANTHROPIC_API_KEY=...
# GROQ_API_KEY=...
```

---

## Platform Copilot System Prompt

The Platform Copilot understands:

### Core Mental Model

1. **iQubes**: Atomic information primitives
   - DataQubes, ContentQubes, ToolQubes, ModelQubes, AigentQubes

2. **Aigent Z**: Multi-tenant orchestration platform
   - AA-API for thin clients
   - QubeBase for registry/identity
   - Blockchain/DVN integrations

3. **Identity Layers** (Privacy-First):
   - **Persona** (Primary) - Default identity sharing surface
   - **Root DID Proxies** - Revocable real-world ID
   - **Root DID** - High-assurance for regulated contexts
   - **KybeDID** - Proof-of-personhood anchor (rarely shared)
   - **DIDQube Cohorts** - Dynamic anonymity groups sized by risk

4. **Blockchain/DVN**: Multi-chain support
   - $QOYN (QriptoCOYN), $QCT (QriptoCENT)
   - x402 protocol for agentic payments
   - Fio handles for Persona payment requests

### Copilot Responsibilities

- **Understand context**: tenant, persona, role, environment
- **Call tools**: Registry, Wallet, Identity, Smart Menu, AA-API, MCP
- **Explain and orchestrate**: Propose actions, execute, summarize
- **Stay within scope**: Platform operations only

### Tool Usage Rules

1. **Prefer tools over assumptions** - Use read-only tools to inspect, write tools to change
2. **Respect RBAC** - Only use tools allowed for current role/tenant
3. **Identity usage**:
   - **Persona** is default for most operations
   - **KybeDID** for proof-of-personhood attestations only
   - **Root DID** for high-assurance/regulated workflows
   - **Cohorts** maintain anonymity where possible
4. **Simulation mode** - Use dry-run for risky operations
5. **Chain sensitivity** - Confirm mainnet operations carefully

---

## Usage in Aigent Z Console

### Adding Platform Copilot UI

The CopilotKit provider is already integrated. To add a chat interface:

```tsx
import { CopilotChat } from "@copilotkit/react-ui";

export function PlatformCopilotPage() {
  return (
    <div className="h-full">
      <CopilotChat
        instructions="You are helping manage the Aigent Z platform."
        labels={{
          title: "Platform Copilot",
          initial: "How can I help you orchestrate the platform today?",
        }}
      />
    </div>
  );
}
```

### Using Copilot Sidebar

```tsx
import { CopilotSidebar } from "@copilotkit/react-ui";

// In your layout or page
<CopilotSidebar
  instructions="Assist with platform operations."
  labels={{
    title: "Platform Assistant",
  }}
/>
```

### Floating Copilot

```tsx
import { CopilotPopup } from "@copilotkit/react-ui";

// Anywhere in your app
<CopilotPopup labels={{ title: "Platform Copilot" }} />
```

---

## Phase 1: AigentiQ Tool Layer (🔜 UPCOMING)

### Write Operations with RBAC

#### Registry Tools
- `registry_create_iQube` - Create new iQube
- `registry_link_aigent_to_iQube` - Link Aigent to iQube
- `registry_update_iQube_metadata` - Update iQube metadata
- `registry_create_tenant` - Create new tenant

#### Wallet Tools
- `wallet_create_agentic_wallet` - Create Agentic Wallet
- `wallet_link_wallet_to_persona` - Link wallet to Persona
- `wallet_send_qct` - Send $QCT payment
- `wallet_send_qoyn` - Send $QOYN payment

#### Identity Tools
- `identity_create_kybe_did` - Issue KybeDID
- `identity_create_root_did` - Create Root DID
- `identity_issue_root_did_proxy` - Issue Root DID proxy
- `identity_create_persona` - Create Persona
- `identity_link_root_did_to_wallet` - Link Root DID to wallet

#### Smart Menu Tools
- `smartmenu_create_menu` - Create Smart Menu
- `smartmenu_attach_action` - Attach action to menu
- `smartmenu_publish` - Publish menu

#### AA-API Tools
- `a2a_register_endpoint` - Register A2A endpoint
- `a2a_send_message` - Send A2A message
- `a2a_simulate_flow` - Simulate A2A flow

### RBAC Implementation

```typescript
// Example RBAC structure
interface UserContext {
  tenantId: string;
  personaId: string;
  role: "platform_admin" | "tenant_admin" | "tenant_operator";
  environment: "dev" | "stage" | "prod";
}

function filterActionsByRole(
  actions: Action[],
  context: UserContext
): Action[] {
  // Filter tools based on role
  // Platform-only tools require platform_admin
  // Tenant tools require tenant_admin or tenant_operator
  // Scoped to tenantId
}
```

---

## Phase 2: Orchestrated Flows (🔜 UPCOMING)

### Multi-Step Workflows

1. **Agentic Wallet Deployment**
   - User: "Create Agentic Wallet for Kn0w1 on Bitcoin and Base, link to admin Persona"
   - Flow: Resolve tenant → Get Persona → Create wallet → Link to Persona → Register WalletQube

2. **KybeDID + Root DID Provisioning**
   - User: "Issue KybeDID and Root DID proxy for new tenant admin, bind to wallet"
   - Flow: Create KybeDID → Create Root DID → Issue proxy → Link to wallet → Register identity Qubes

3. **Smart Menu Configuration**
   - User: "Create Smart Menu for KNYT Books accepting $QCT on Polygon and $QOYN on Bitcoin"
   - Flow: Clarify context → Create menu → Attach payment actions → Publish → Return config

---

## Phase 3: AA-API Copilot-as-a-Service (🔜 UPCOMING)

### Endpoint Design

```
POST /aa/copilot/execute
```

**Request:**
```json
{
  "tenantId": "tenant_1",
  "personaId": "persona_1",
  "prompt": "Show me wallet balances",
  "intent": {
    "action": "get_wallet_balances",
    "params": { "chain": "polygon" }
  },
  "context": {}
}
```

**Response:**
```json
{
  "responseText": "Your Polygon wallet has 5000 QCT ($5.00) and 2.5 MATIC ($2.25).",
  "structuredResult": {
    "balances": [
      { "token": "QCT", "amount": "5000.00", "usdValue": 5.00 },
      { "token": "MATIC", "amount": "2.5", "usdValue": 2.25 }
    ]
  },
  "toolCalls": ["getWalletBalances"]
}
```

### AA-API SDK Extension

```typescript
// In @qriptoagentiq/aa-api-client
interface CopilotClient {
  execute(request: CopilotRequest): Promise<CopilotResponse>;
}

// Usage in thin client
const result = await aaApi.copilot.execute({
  tenantId: "tenant_1",
  personaId: "persona_1",
  prompt: "Create Agentic Wallet on Bitcoin",
});
```

---

## Phase 4: MCP + ToolQube Bridge (🔜 UPCOMING)

### MCP Integration

- CopilotKit acts as **MCP client** to internal Aigent Z MCP server
- ToolQubes exposed via MCP with risk/suitability metadata
- Backend actions: `toolqube_list_mcp_tools`, `toolqube_invoke_mcp_tool`
- Risk-based tool selection based on cohort behavior

---

## Phase 5: Logging & Governance (🔜 UPCOMING)

### Event Logging

All copilot tool calls logged as **EventQubes**:
- Timestamp, tenantId, personaId, tool name, args, results
- Chain tx hashes, IDs, statuses
- Simulation flag

### Simulation Mode

- Dry-run mode for testing
- Skips irreversible operations or uses simulators
- Enabled via session flag or prompt keyword ("simulate")

### RBAC & Limits

- Role-based tool access
- Per-tenant/persona rate and value limits
- Environment rules (no mainnet in dev)
- Violations logged and blocked

---

## Testing

### Phase 0 Testing

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables:**
   ```bash
   echo "OPENAI_API_KEY=sk-..." >> .env.local
   ```

3. **Start dev server:**
   ```bash
   npm run dev
   ```

4. **Access console:**
   Navigate to `http://localhost:3000`

5. **Add Copilot UI:**
   Create `/app/copilot/page.tsx`:
   ```tsx
   import { CopilotChat } from "@copilotkit/react-ui";

   export default function CopilotPage() {
     return (
       <div className="h-full p-8">
         <h1 className="text-2xl font-bold mb-4">Platform Copilot</h1>
         <CopilotChat
           instructions="Help with Aigent Z platform operations."
           labels={{
             title: "Platform Copilot",
             initial: "How can I assist with platform operations?",
           }}
         />
       </div>
     );
   }
   ```

6. **Test queries:**
   - "List all tenants"
   - "Show me wallet status for Kn0w1"
   - "Get identity summary for tenant_1"
   - "What iQubes does KNYT Books have?"

---

## Extending the Integration

### Adding New Backend Actions

1. **Create action file:**
   ```typescript
   // app/copilot/actions/new-feature.ts
   export const myNewAction = {
     name: "myNewAction",
     description: "Does something useful",
     parameters: [
       {
         name: "param1",
         type: "string" as const,
         description: "Parameter description",
         required: true,
       },
     ],
     handler: async ({ param1 }: { param1: string }) => {
       // Implementation
       return { success: true, result: "..." };
     },
   };

   export const newFeatureActions = [myNewAction];
   ```

2. **Register in index:**
   ```typescript
   // app/copilot/actions/index.ts
   import { newFeatureActions } from "./new-feature";

   export const allActions = [
     ...registryActions,
     ...walletActions,
     ...identityActions,
     ...newFeatureActions, // Add here
   ];
   ```

3. **Test the new action** via Platform Copilot chat

### Connecting to Real Services

Replace TODO comments in action handlers:

```typescript
// Before (Phase 0 mock)
handler: async ({ tenantId }) => {
  // TODO: Implement actual tenant listing from QubeBase
  return { success: true, tenants: [...mockData] };
};

// After (Phase 1 real)
handler: async ({ tenantId }) => {
  const supabase = createClient(...);
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("active", true);
  
  if (error) throw error;
  return { success: true, tenants: data };
};
```

---

## Security Considerations

1. **Never expose secrets** in tool responses
2. **Validate all inputs** in action handlers
3. **Enforce tenant isolation** via context checks
4. **Use RBAC** to restrict sensitive operations
5. **Log all operations** for audit trail
6. **Rate limit** copilot requests per tenant
7. **Sanitize prompts** to prevent injection attacks

---

## Troubleshooting

### "Cannot find module '@copilotkit/...'"

```bash
npm install
```

### "OpenAI API error"

Check `.env.local` has valid `OPENAI_API_KEY`

### "Actions not registered"

Verify actions are exported in `/app/copilot/actions/index.ts` and imported in `/app/api/copilotkit/route.ts`

### "Edge runtime error"

Ensure all dependencies are edge-compatible. Check that no Node.js-only APIs are used in actions.

---

## Future Enhancements

- [ ] **Phase 1**: Write operations with RBAC
- [ ] **Phase 2**: Orchestrated multi-step flows
- [ ] **Phase 3**: AA-API copilot endpoint for thin clients
- [ ] **Phase 4**: MCP integration with ToolQubes
- [ ] **Phase 5**: Event logging, simulation mode, governance
- [ ] Multi-LLM support (Anthropic, Groq, Ollama)
- [ ] Voice interface for Platform Copilot
- [ ] Mobile app integration
- [ ] Autonomous agent copilots with client-side CopilotKit

---

## References

- [CopilotKit Documentation](https://docs.copilotkit.ai/)
- [CopilotKit Quickstart](https://docs.copilotkit.ai/quickstart)
- [Aigent Z Architecture](./README.md)
- [Thin Client Integration](./THIN_CLIENT_INTEGRATION.md)
- [AA-API Documentation](./THIN_CLIENT_QUICKSTART.md)

---

**Last Updated**: November 24, 2025  
**Phase**: Phase 0 (Baseline Integration) ✅ Complete  
**Next Phase**: Phase 1 (AigentiQ Tool Layer with RBAC)
