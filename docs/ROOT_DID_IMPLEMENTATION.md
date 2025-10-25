# Root DID Implementation Guide

## Overview

This document outlines how to implement Root DIDs in the DIDQube protocol to enable proper identity hierarchy and multi-persona management.

---

## Current State (Phase 1)

### Database Schema
```typescript
interface Persona {
  id: string;              // Persona UUID
  root_id: string | null;  // ← Currently NULL
  fio_handle: string;
  // ...
}
```

### Problem
- Each persona is independent
- No way to link personas to same user
- Can't switch between personas
- Can't aggregate reputation
- No master identity control

---

## Target State (Phase 2)

### Database Schema (Same)
```typescript
interface Persona {
  id: string;              // Persona UUID
  root_id: string;         // ← NOW POPULATED
  fio_handle: string;
  // ...
}
```

### New Table: Root DIDs
```sql
CREATE TABLE root_did (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  did TEXT UNIQUE NOT NULL,  -- did:qube:root-{uuid}
  user_id TEXT,              -- Link to auth system (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_root_did_user ON root_did(user_id);
CREATE INDEX idx_persona_root ON persona(root_id);
```

---

## Implementation Steps

### Step 1: Create Root DID Service

```typescript
// services/identity/rootDIDService.ts

export class RootDIDService {
  private supabase: SupabaseClient;

  constructor() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey!
    );
  }

  /**
   * Create a new Root DID for a user
   */
  async createRootDID(userId?: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('root_did')
      .insert({
        did: `did:qube:root-${uuidv4()}`,
        user_id: userId || null
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Get Root DID for a user
   */
  async getRootDIDForUser(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('root_did')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data?.id || null;
  }

  /**
   * Get all personas for a Root DID
   */
  async getPersonasForRoot(rootId: string): Promise<Persona[]> {
    const { data, error } = await this.supabase
      .from('persona')
      .select('*')
      .eq('root_id', rootId);

    if (error) throw error;
    return data || [];
  }
}
```

### Step 2: Update Persona Creation

```typescript
// app/api/identity/persona/create-with-fio/route.ts

export async function POST(req: NextRequest) {
  const { fioHandle, publicKey, privateKey, userId } = await req.json();
  
  // 1. Get or create Root DID
  const rootDIDService = new RootDIDService();
  let rootId = await rootDIDService.getRootDIDForUser(userId);
  
  if (!rootId) {
    console.log('[Create Persona] Creating new Root DID for user:', userId);
    rootId = await rootDIDService.createRootDID(userId);
  }
  
  // 2. Create persona linked to Root DID
  const { data: persona, error } = await supabase
    .from('persona')
    .insert({
      root_id: rootId,  // ← Link to root
      fio_handle: fioHandle,
      fio_public_key: publicKey,
      // ...
    })
    .select()
    .single();
    
  return NextResponse.json({ ok: true, data: { persona } });
}
```

### Step 3: Add Persona Switching

```typescript
// app/api/identity/persona/switch/route.ts

export async function POST(req: NextRequest) {
  const { personaId, userId } = await req.json();
  
  // 1. Verify persona belongs to user's root DID
  const rootDIDService = new RootDIDService();
  const rootId = await rootDIDService.getRootDIDForUser(userId);
  
  const { data: persona } = await supabase
    .from('persona')
    .select('*')
    .eq('id', personaId)
    .eq('root_id', rootId)
    .single();
    
  if (!persona) {
    return NextResponse.json(
      { ok: false, error: 'Persona not found or unauthorized' },
      { status: 404 }
    );
  }
  
  // 2. Switch to persona (update session/context)
  return NextResponse.json({ ok: true, data: { persona } });
}
```

### Step 4: Add Persona List

```typescript
// app/api/identity/persona/list/route.ts

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  
  // Get all personas for user's root DID
  const rootDIDService = new RootDIDService();
  const rootId = await rootDIDService.getRootDIDForUser(userId);
  
  if (!rootId) {
    return NextResponse.json({ ok: true, data: { personas: [] } });
  }
  
  const personas = await rootDIDService.getPersonasForRoot(rootId);
  
  return NextResponse.json({ ok: true, data: { personas } });
}
```

---

## Frontend Integration

### Persona Switcher Component

```typescript
// components/identity/PersonaSwitcher.tsx

export function PersonaSwitcher() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);

  useEffect(() => {
    loadPersonas();
  }, []);

  const loadPersonas = async () => {
    const res = await fetch('/api/identity/persona/list');
    const data = await res.json();
    setPersonas(data.data.personas);
  };

  const switchPersona = async (personaId: string) => {
    const res = await fetch('/api/identity/persona/switch', {
      method: 'POST',
      body: JSON.stringify({ personaId })
    });
    
    const data = await res.json();
    setCurrentPersona(data.data.persona);
  };

  return (
    <div className="persona-switcher">
      <h3>Your Personas</h3>
      {personas.map(persona => (
        <button
          key={persona.id}
          onClick={() => switchPersona(persona.id)}
          className={currentPersona?.id === persona.id ? 'active' : ''}
        >
          {persona.fio_handle || 'Anonymous'}
        </button>
      ))}
    </div>
  );
}
```

---

## Migration Strategy

### Option 1: Backfill Existing Personas

```sql
-- Create Root DIDs for existing personas
INSERT INTO root_did (did)
SELECT DISTINCT 'did:qube:root-' || uuid_generate_v4()
FROM persona
WHERE root_id IS NULL;

-- Link personas to new Root DIDs (one-to-one for now)
UPDATE persona p
SET root_id = (
  SELECT id FROM root_did
  WHERE did = 'did:qube:root-' || p.id
)
WHERE root_id IS NULL;
```

### Option 2: Create on Demand

```typescript
// Create Root DID when user logs in
async function ensureRootDID(userId: string) {
  const rootDIDService = new RootDIDService();
  let rootId = await rootDIDService.getRootDIDForUser(userId);
  
  if (!rootId) {
    rootId = await rootDIDService.createRootDID(userId);
    
    // Link existing personas to new root
    await supabase
      .from('persona')
      .update({ root_id: rootId })
      .is('root_id', null)
      .eq('app_origin', 'aigent-z'); // Or other user identifier
  }
  
  return rootId;
}
```

---

## Reputation Aggregation (Optional)

```typescript
// services/reputation/aggregationService.ts

export class ReputationAggregationService {
  /**
   * Get aggregated reputation across all personas
   */
  async getAggregatedReputation(rootId: string): Promise<number> {
    const { data: personas } = await supabase
      .from('persona')
      .select('id')
      .eq('root_id', rootId);
      
    const personaIds = personas.map(p => p.id);
    
    const { data: reputations } = await supabase
      .from('reputation')
      .select('score')
      .in('persona_id', personaIds);
      
    // Calculate weighted average or sum
    const totalScore = reputations.reduce((sum, r) => sum + r.score, 0);
    return totalScore / reputations.length;
  }
  
  /**
   * Get reputation breakdown by persona
   */
  async getReputationByPersona(rootId: string) {
    const { data } = await supabase
      .from('persona')
      .select(`
        id,
        fio_handle,
        reputation (
          score,
          context
        )
      `)
      .eq('root_id', rootId);
      
    return data;
  }
}
```

---

## Security Considerations

### 1. Access Control
- Only root DID owner can switch personas
- Verify ownership before persona operations
- Use RLS policies to enforce root_id matching

### 2. Privacy
- Don't expose root_id in public APIs
- Allow users to unlink personas
- Support anonymous personas (no root_id)

### 3. Verifiable Credentials
```typescript
// Issue credential at root level
{
  "@context": "https://www.w3.org/2018/credentials/v1",
  "type": ["VerifiableCredential"],
  "issuer": "did:qube:issuer-123",
  "credentialSubject": {
    "id": "did:qube:root-xyz",  // ← Root DID
    "personas": [
      "did:qube:persona-abc",
      "did:qube:persona-def"
    ]
  }
}
```

---

## Testing

### Test Cases

1. **Create first persona**
   - Should create Root DID
   - Should link persona to root

2. **Create second persona**
   - Should reuse existing Root DID
   - Should link to same root

3. **Switch personas**
   - Should verify ownership
   - Should update context

4. **List personas**
   - Should return all personas for root
   - Should not return other users' personas

5. **Aggregate reputation**
   - Should calculate across all personas
   - Should handle missing reputation

---

## Rollout Plan

### Phase 1 (Current)
- ✅ Personas work independently
- ✅ FIO registration works
- ⚠️ No root DID

### Phase 2 (Next)
- 🔄 Add root_did table
- 🔄 Create Root DID on first persona
- 🔄 Link subsequent personas to root
- 🔄 Add persona switcher UI

### Phase 3 (Future)
- 📋 Reputation aggregation
- 📋 Verifiable credentials
- 📋 Cross-persona operations
- 📋 Zero-knowledge proofs

---

## Summary

**Root DID is the foundation of multi-persona identity management.**

Without it:
- ❌ Can't link personas to same user
- ❌ Can't switch between personas
- ❌ Can't aggregate reputation
- ❌ Limited privacy controls

With it:
- ✅ One user, many personas
- ✅ Context-specific identities
- ✅ Privacy-preserving
- ✅ Reputation aggregation
- ✅ Verifiable credentials
- ✅ Full DIDQube protocol support
