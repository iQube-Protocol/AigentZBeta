# Development Conventions & Patterns

## Core Principle: Extend, Don't Duplicate

From CLAUDE.md: This is a **mature, actively evolving codebase**. Before writing new code:

1. **Search for existing implementations** — functions, hooks, components almost certainly exist
2. **Reuse and extend** what's there
3. **Move logic, don't copy it**

---

## File Organization Discipline

### Never Create New Files For Single Concerns

- ✅ DO: Edit existing service file to add a new function
- ❌ DON'T: Create new file unless genuinely standalone concern

### Canonical Component Locations

**Never create new primitives without checking:**
- `components/ui/` — Shared UI primitives
- `components/composer/` — Composer-specific components
- `components/registry/` — Registry-specific components
- `components/` — Feature-level components

**Canonical primitives already exist:**
- `ConfirmDialog`, `IQubeCard`, `FilterSection`, `ViewModeToggle`

### Service Organization

Services live in `/services/[domain]/` and export public interfaces only.

```typescript
// ✅ GOOD: Single responsibility, clear exports
// /services/identity/personaService.ts
export async function createPersona(input: CreatePersonaInput) { /* ... */ }
export async function updateReputation(personaId: string, delta: number) { /* ... */ }

// ❌ BAD: Multiple unrelated concerns in one file
// Don't mix persona + wallet + content in one service
```

---

## TypeScript Standards

### No `any` Type

```typescript
// ❌ BAD
const data: any = await fetch(url);

// ✅ GOOD
interface ApiResponse { /* ... */ }
const data = await fetch(url).then(r => r.json() as ApiResponse);
```

### Type Guards Before Casting

```typescript
// ❌ BAD
const provider = headers['x-provider'] as 'openai' | 'venice';

// ✅ GOOD
const provider = headers['x-provider'];
if (typeof provider !== 'string') throw new Error('Invalid provider');
if (!['openai', 'venice'].includes(provider)) throw new Error('Unknown provider');
const typedProvider = provider as 'openai' | 'venice';
```

### Use Existing Utilities

```typescript
// ✅ Use asRecord() for safe unknown-to-object access
import { asRecord } from '@/utils/type-guards';
const obj = asRecord(unknownValue);

// ✅ Use cn() for className merging
import { cn } from '@/utils/cn';
const buttonClass = cn('base', variant && `variant-${variant}`);
```

### Accurate Dependency Arrays

```typescript
// ✅ GOOD: Dependencies match actual usage
const memoized = useMemo(() => {
  return data.filter(x => x.id === selectedId);
}, [data, selectedId]); // Both are used

// ❌ BAD: Missing dependencies
const memoized = useMemo(() => {
  return data.filter(x => x.id === selectedId);
}, [data]); // selectedId is used but not listed

// ❌ BAD: Over-dependencies
const memoized = useMemo(() => {
  return data.length;
}, [data, router, setLoading, userId]); // Only data is used
```

---

## State Management Boundaries

### Server-First for Critical State

Critical state lives in **Supabase** via **Next.js API routes**:
- Registry data
- Visibility & ownership
- Entitlements
- Reputation
- Transaction history

```typescript
// ✅ GOOD: Critical state on server
export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { data: persona } = await supabase
    .from('personas')
    .select('*')
    .eq('id', id)
    .single();
  return NextResponse.json(persona);
}
```

### localStorage for UX Reactivity Only

Use `localStorage` ONLY for immediate client feedback:
- `library_<id>` — Flag: "I just added this to library"
- `minted_<id>` — Flag: "I just minted this"
- UI preferences (dark mode, sidebar state)

```typescript
// ✅ GOOD: localStorage for UI feedback
const [isMinted, setIsMinted] = useState(false);

useEffect(() => {
  // Check Supabase source of truth
  fetch(`/api/registry/iqube/${id}`).then(r => {
    setIsMinted(r.data.minted);
  });
}, [id]);

const handleMint = async () => {
  setIsMinted(true); // Optimistic UI update
  localStorage.setItem(`minted_${id}`, 'true');
  
  try {
    await fetch(`/api/mint/episode`, { method: 'POST', body: JSON.stringify({ id }) });
    // Supabase reflects truth on server
  } catch {
    setIsMinted(false); // Revert on error
    localStorage.removeItem(`minted_${id}`);
  }
};
```

### Avoid SSR/CSR Mismatches

Never compute client-only conditions directly in JSX:

```typescript
// ❌ BAD: window access causes SSR/CSR mismatch
export function Component() {
  const isDark = window.localStorage.getItem('dark-mode') === 'true';
  return <div className={isDark ? 'dark' : 'light'}>...</div>;
}

// ✅ GOOD: Compute in useEffect, store in state
export function Component() {
  const [isDark, setIsDark] = useState(false);
  
  useEffect(() => {
    setIsDark(window.localStorage.getItem('dark-mode') === 'true');
  }, []);
  
  return <div className={isDark ? 'dark' : 'light'}>...</div>;
}
```

---

## Commit Discipline

### One Concern Per Commit

```bash
# ✅ GOOD: Single focused commit
git commit -m "add reputation bucket calculation to persona service"

# ❌ BAD: Multiple concerns bundled
git commit -m "fix bugs and refactor and update docs"
```

### Commit Message Format

- **Imperative**, **lowercase**, **no period**
- Examples:
  - `generate image article bundles on completion`
  - `fix identity resolution for fio aliases`
  - `refactor x402 signature verification`
  - `add reputation bucket calculation`

### Never Skip Hooks or Bypass Signing

```bash
# ❌ NEVER DO THIS
git commit --no-verify
git commit --no-gpg-sign

# ✅ ALWAYS DO THIS
git commit -m "..."  # Runs hooks, enforces signing
```

### Staging Strategy

**Prefer adding specific files over `git add -A`:**

```bash
# ✅ GOOD: Explicit file selection
git add services/identity/personaService.ts app/api/identity/persona/route.ts
git commit -m "add persona reputation calculation"

# ❌ BAD: Could accidentally commit .env or other secrets
git add -A
git commit -m "..."
```

---

## Change Sizing

### No Over-Engineering

```typescript
// ❌ BAD: Premature abstraction for 1-off operation
export function createFilterFactory<T>(predicate: (item: T) => boolean) {
  return {
    filter: (items: T[]) => items.filter(predicate),
    count: (items: T[]) => items.filter(predicate).length,
    // ... 5 more methods
  };
}

// ✅ GOOD: Inline the logic where it's used
const filteredItems = items.filter(item => item.status === 'active');
const count = filteredItems.length;
```

### No Speculative Features

Only implement what's explicitly requested or clearly required:

```typescript
// ❌ BAD: Preparing for future features that don't exist
export interface PersonaQube {
  // ... fields ...
  futureNftGalleryConfig?: NftGalleryConfig;
  potentialVotingRights?: VotingRights;
  hypotheticalL2Bridge?: L2BridgeConfig;
}

// ✅ GOOD: Only fields that are actually used
export interface PersonaQube {
  id: string;
  fioHandle: string;
  rootDid: string;
  evmKey: EvmKeyPair;
  reputationScore: number;
  // ... other active fields ...
}
```

### No Defensive Code for Impossible Scenarios

```typescript
// ❌ BAD: Over-defensive
if (result === undefined || result === null || typeof result === 'object' && result.value === undefined) {
  // Handle case that can't happen per TypeScript
}

// ✅ GOOD: Trust TypeScript
if (!result) {
  // Handle legitimate case
}
```

### Three Similar Lines = Better Than Premature Abstraction

```typescript
// ✅ GOOD: Repetition is fine at this scale
const ethereumBalance = await getEVMBalance(address, 'ethereum');
const optimismBalance = await getEVMBalance(address, 'optimism');
const arbitrumBalance = await getEVMBalance(address, 'arbitrum');

// ❌ BAD: Over-abstracted for 3 lines
const chains = ['ethereum', 'optimism', 'arbitrum'];
const balances = await Promise.all(
  chains.map(chain => getEVMBalance(address, chain))
);
// (Later need to iterate, extract individual values, etc.)
```

---

## Security Practices

### Never Hardcode Secrets

```typescript
// ❌ BAD: Secrets in code
const API_KEY = "sk-abc123xyz789";
const DB_PASSWORD = "prod_password_123";

// ✅ GOOD: Environment variables only
const API_KEY = process.env.OPENAI_API_KEY;
const DB_PASSWORD = process.env.SUPABASE_SERVICE_ROLE_KEY;
```

### NEXT_PUBLIC_ Prefix Rules

```typescript
// ✅ GOOD: Public values only
export const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const NEXT_PUBLIC_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION;

// ❌ BAD: Private keys exposed to browser
const NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const NEXT_PUBLIC_OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_KEY;
```

### Encryption-First for Sensitive Data

All sensitive data is encrypted at rest:

```typescript
// From /services/identity/personaService.ts
export interface EncryptedKey {
  ciphertext: string;      // AES-256-GCM encrypted
  iv: string;              // Initialization vector
  salt: string;            // Key derivation salt
  authTag: string;         // Auth tag for GCM
}

// Private key is NEVER stored unencrypted
const encrypted = encryptPrivateKey(privateKeyHex, password);
// Store encrypted in Supabase
await supabase.from('personas').insert({
  evm_key_encrypted: encrypted,
  // ... other fields
});
```

### Follow Zero-Knowledge Patterns for iQubes

Metadata is public, but sensitive content is encrypted:

```typescript
// ✅ GOOD: Metadata public, content encrypted
export interface SmartContentQube {
  // Public
  id: string;
  title: string;
  description: string;
  contentType: 'episode' | 'article';
  pricingModel: PricingKind;
  
  // Encrypted / access-controlled
  content: ContentReference;  // Encrypted URI
  relationMetadata: JSONB;    // May be encrypted
}
```

---

## Architecture Layer Boundaries

Each layer has clear responsibilities:

### Context Layer

Semantics, RAG, iQube content intelligence

```typescript
// /services/copilot/composer/
export async function buildComposerPromptParts(context: ComposerSessionContext) {
  // Build semantic prompt from KB + user context
  // Return prompt parts for LLM
}
```

### Service Layer

API integration, wallet operations, CRUD

```typescript
// /services/identity/personaService.ts
export async function createPersona(input: CreatePersonaInput) {
  // Generate EVM key
  // Encrypt private key
  // Register FIO handle
  // Insert to Supabase
}
```

### State Layer

Blockchain-backed persistence, audit trail

```typescript
// Supabase tables: personas, x402_messages, x402_settlements
// ICP canisters: Persistent smart contracts
// All mutations are immutable audit logs
```

**Don't mix:** Don't put blockchain queries in components. Don't put UI logic in services.

---

## Naming Conventions

### Files & Directories

```
/services/identity/         ← domain folder (singular)
  personaService.ts        ← service file (camelCase + Service)
  fioService.ts
  identityResolver.ts      ← resolver/helper (camelCase + verb)

/app/api/identity/
  persona/
    route.ts              ← Next.js route file

/components/identity/
  PersonaSelector.tsx     ← component (PascalCase)
  usePersonaContext.ts    ← hook (camelCase + use prefix)

/types/
  persona.ts              ← type file (singular, lowercase)
```

### Functions & Variables

```typescript
// ✅ GOOD: Clear, descriptive names
export async function resolveIdentity(subject: string): Promise<ResolvedIdentity>
export function cn(...inputs: ClassValue[]): string
export const logger = new StructuredLogger()

// ❌ BAD: Abbreviations, unclear
export async function resolveId(s: string)
export function merge(...inputs)
export const log = { /* ... */ }
```

### React Components

```typescript
// ✅ GOOD: PascalCase, descriptive
export function PersonaSelector({ value, onChange }: Props) { /* ... */ }
export const PersonaCard = memo(Component);

// ❌ BAD: camelCase, generic
export function personaSelector() { /* ... */ }
export const Card = memo(Component);
```

### Hooks

```typescript
// ✅ GOOD: use prefix, clear purpose
export function usePersonaContext() { /* ... */ }
export function useBalances(personaId: string) { /* ... */ }
export function useCopilotAction() { /* ... */ }

// ❌ BAD: No prefix or unclear
export function personaContext() { /* ... */ }
export function getBalances() { /* ... */ }
```

---

## Import & Module Patterns

### Path Aliases

Always use `@/` alias for root imports:

```typescript
// ✅ GOOD
import { PersonaService } from '@/services/identity/personaService';
import { cn } from '@/utils/cn';
import { PersonaQube } from '@/types/persona';

// ❌ BAD: Relative paths get messy
import { PersonaService } from '../../../services/identity/personaService';
import { cn } from '../../../utils/cn';
```

### Organize Imports

```typescript
// ✅ GOOD: Logical grouping
// External libraries
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Internal services
import { PersonaService } from '@/services/identity/personaService';
import { resolveIdentity } from '@/services/identity/identityResolver';

// Internal types
import { PersonaQube } from '@/types/persona';

// Internal utils
import { logger } from '@/utils/structuredLogger';
```

---

## Logging & Observability

### Use Structured Logger

```typescript
// ✅ GOOD
import { logger } from '@/utils/structuredLogger';

logger.info('persona created', {
  personaId: persona.id,
  fioHandle: persona.fioHandle,
  context: 'persona-service'
});

// ❌ BAD: console.log
console.log('Created persona:', persona);
```

### Include Context

```typescript
// ✅ GOOD: Always include context
const { withStructuredLogger } = await import('@/utils/structuredLogger');
const apiLog = withStructuredLogger({ endpoint: '/api/identity/persona' });

apiLog.debug('fetching persona', { personaId });
```

---

## Error Handling

### Always Return Meaningful Errors

```typescript
// ✅ GOOD
return NextResponse.json(
  { ok: false, error: 'Persona not found', code: 'PERSONA_NOT_FOUND' },
  { status: 404 }
);

// ❌ BAD
return NextResponse.json({ ok: false, error: 'Error' }, { status: 500 });
```

### Validate Early, Fail Fast

```typescript
// ✅ GOOD: Zod validation early
const parsed = personaSchema.safeParse(input);
if (!parsed.success) {
  return NextResponse.json(
    { ok: false, error: 'Invalid input', details: parsed.error.flatten() },
    { status: 400 }
  );
}

// ❌ BAD: Unvalidated input used downstream
const persona = await createPersona(input); // May fail mysteriously later
```

---

## Testing Patterns

### Unit Test Services in Isolation

```typescript
// ✅ GOOD: Test service logic independently
describe('PersonaService', () => {
  it('should encrypt private key', () => {
    const key = generateKey();
    const encrypted = encryptPrivateKey(key, 'password');
    expect(encrypted).toHaveProperty('ciphertext');
    expect(encrypted).toHaveProperty('iv');
  });
});
```

### Integration Tests for API Routes

```typescript
// ✅ GOOD: Test full flow
describe('POST /api/identity/persona', () => {
  it('should create persona with FIO handle', async () => {
    const res = await fetch('/api/identity/persona', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.data.fioHandle).toBe(input.username + '@' + input.domain);
  });
});
```

---

## Summary: Development Ethos

| Principle | Application |
|-----------|-------------|
| **DRY** | Search first, extend existing, don't duplicate |
| **Type Safety** | No `any`, use type guards, trust TypeScript |
| **Single Responsibility** | One concern per file/function/component |
| **Server-First State** | Critical data on Supabase, UI state in localStorage |
| **Security First** | Encrypt sensitive data, no hardcoded secrets |
| **Clarity Over Cleverness** | Readable code beats clever code |
| **Fail Fast** | Validate early, return meaningful errors |
| **Composable** | Modules, packages, protocols that work together |

All conventions are **enforced by CLAUDE.md** and **reviewed in code review**.
```


