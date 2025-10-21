# FIO SDK Integration - Sprint 1

**Start Date**: October 17, 2025  
**Duration**: 2 weeks  
**Priority**: High  
**Status**: 80% Complete - Ahead of Schedule! 🚀

---

## 🎯 Objectives

Integrate FIO Protocol SDK to enable real blockchain-based handle registration and verification for DIDQube personas, replacing the current text-only input system.

---

## 📋 Prerequisites

- ✅ DIDQube Phase 3 complete (reputation system)
- ✅ Supabase persona tables configured
- ✅ Basic persona CRUD operations working
- ✅ FIO Protocol account/API access
- ✅ FIO SDK npm package installed

---

## 🏗️ Architecture Overview

### Current State
```
User Input (text) → Supabase persona.fio_handle (text field)
```

### Target State
```
User Input → FIO SDK → FIO Blockchain
                ↓
         Verification
                ↓
    Supabase persona.fio_handle (verified)
                ↓
         Status Tracking
```

---

## 📦 Components to Build

### 1. FIO SDK Service Layer
**File**: `services/identity/fioService.ts`

**Responsibilities**:
- Initialize FIO SDK connection
- Handle registration
- Verify handle ownership
- Lookup handle information
- Check handle availability

**Key Methods**:
```typescript
class FIOService {
  // Initialize SDK with API endpoint
  initialize(endpoint: string, privateKey?: string): Promise<void>
  
  // Check if handle is available
  isHandleAvailable(handle: string): Promise<boolean>
  
  // Register new FIO handle
  registerHandle(handle: string, ownerPublicKey: string): Promise<{
    txId: string;
    fioAddress: string;
    expiration: Date;
  }>
  
  // Verify handle ownership
  verifyOwnership(handle: string, publicKey: string): Promise<boolean>
  
  // Get handle information
  getHandleInfo(handle: string): Promise<{
    owner: string;
    expiration: Date;
    bundledTxs: number;
  }>
  
  // Lookup FIO address
  lookupAddress(handle: string): Promise<string | null>
}
```

---

### 2. API Endpoints

#### **POST `/api/identity/fio/check-availability`**
Check if FIO handle is available for registration.

**Request**:
```json
{
  "handle": "alice@fio"
}
```

**Response**:
```json
{
  "ok": true,
  "available": true,
  "handle": "alice@fio"
}
```

---

#### **POST `/api/identity/fio/register`**
Register a new FIO handle on the blockchain.

**Request**:
```json
{
  "handle": "alice@fio",
  "publicKey": "FIO7...",
  "personaId": "uuid"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "txId": "abc123...",
    "fioAddress": "alice@fio",
    "expiration": "2026-10-17T00:00:00Z",
    "status": "pending"
  }
}
```

---

#### **POST `/api/identity/fio/verify`**
Verify FIO handle ownership.

**Request**:
```json
{
  "handle": "alice@fio",
  "publicKey": "FIO7...",
  "personaId": "uuid"
}
```

**Response**:
```json
{
  "ok": true,
  "verified": true,
  "owner": "FIO7...",
  "expiration": "2026-10-17T00:00:00Z"
}
```

---

#### **GET `/api/identity/fio/lookup?handle=alice@fio`**
Lookup FIO handle information.

**Response**:
```json
{
  "ok": true,
  "data": {
    "handle": "alice@fio",
    "owner": "FIO7...",
    "expiration": "2026-10-17T00:00:00Z",
    "bundledTxs": 100
  }
}
```

---

### 3. Database Schema Updates

#### **Update `persona` table**:
```sql
-- Add FIO-specific fields
ALTER TABLE public.persona ADD COLUMN IF NOT EXISTS fio_public_key text;
ALTER TABLE public.persona ADD COLUMN IF NOT EXISTS fio_handle_verified boolean default false;
ALTER TABLE public.persona ADD COLUMN IF NOT EXISTS fio_handle_expiration timestamptz;
ALTER TABLE public.persona ADD COLUMN IF NOT EXISTS fio_tx_id text;
ALTER TABLE public.persona ADD COLUMN IF NOT EXISTS fio_registration_status text check (fio_registration_status in ('pending', 'confirmed', 'failed', 'expired'));

-- Add index for FIO handle lookups
CREATE INDEX IF NOT EXISTS idx_persona_fio_handle ON public.persona(fio_handle) WHERE fio_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_persona_fio_verified ON public.persona(fio_handle_verified) WHERE fio_handle_verified = true;

-- Add comments
COMMENT ON COLUMN public.persona.fio_public_key IS 'FIO Protocol public key for handle ownership';
COMMENT ON COLUMN public.persona.fio_handle_verified IS 'Whether FIO handle ownership has been verified on-chain';
COMMENT ON COLUMN public.persona.fio_handle_expiration IS 'Expiration date of FIO handle registration';
COMMENT ON COLUMN public.persona.fio_tx_id IS 'Transaction ID of FIO handle registration';
COMMENT ON COLUMN public.persona.fio_registration_status IS 'Status of FIO handle registration: pending, confirmed, failed, expired';
```

---

### 4. UI Components

#### **FIOHandleInput Component**
**File**: `components/identity/FIOHandleInput.tsx`

**Features**:
- Real-time availability checking
- Format validation (@domain suffix)
- Visual feedback (available/taken/invalid)
- Loading states
- Error handling

**Props**:
```typescript
interface FIOHandleInputProps {
  value: string;
  onChange: (value: string) => void;
  onVerificationChange?: (verified: boolean) => void;
  disabled?: boolean;
  required?: boolean;
}
```

---

#### **FIORegistrationModal Component**
**File**: `components/identity/FIORegistrationModal.tsx`

**Features**:
- Step-by-step registration flow
- Public key input/generation
- Cost estimation
- Transaction confirmation
- Status tracking

**Flow**:
1. Enter desired handle
2. Check availability
3. Review costs
4. Confirm registration
5. Show transaction status
6. Link to persona

---

#### **FIOVerificationBadge Component**
**File**: `components/identity/FIOVerificationBadge.tsx`

**Features**:
- Visual indicator of verification status
- Tooltip with verification details
- Expiration warning
- Re-verification trigger

**States**:
- ✅ Verified (green)
- ⏳ Pending (yellow)
- ❌ Failed (red)
- ⚠️ Expired (orange)
- ➖ Not registered (gray)

---

### 5. Integration Points

#### **Persona Creation Flow**
Update `app/admin/reputation/page.tsx` and persona creation forms:

1. Add FIO handle input with real-time validation
2. Optional: Generate FIO key pair
3. Register handle on FIO blockchain
4. Store registration details in Supabase
5. Show verification status

#### **Persona Display**
Update all persona display components:

1. Show FIO verification badge
2. Display expiration date
3. Add re-verification button
4. Link to FIO blockchain explorer

#### **Ops Console**
Update `components/ops/DiDQubeIdentityCard.tsx`:

1. Show FIO verification status
2. Add FIO handle lookup
3. Display registration details

---

## 🔧 Technical Implementation

### Phase 1: Setup & Service Layer (Days 1-2)

**Tasks**:
- [ ] Install FIO SDK: `npm install @fioprotocol/fiosdk`
- [ ] Create `services/identity/fioService.ts`
- [ ] Implement core FIO methods
- [ ] Add environment variables for FIO endpoints
- [ ] Write unit tests for FIO service

**Environment Variables**:
```bash
# .env.local
FIO_API_ENDPOINT=https://fio.greymass.com
FIO_CHAIN_ID=21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c
FIO_REGISTRATION_FEE=40000000000 # 40 FIO
```

---

### Phase 2: Database & API Routes (Days 3-4)

**Tasks**:
- [ ] Run Supabase migration for FIO fields
- [ ] Create `/api/identity/fio/check-availability` endpoint
- [ ] Create `/api/identity/fio/register` endpoint
- [ ] Create `/api/identity/fio/verify` endpoint
- [ ] Create `/api/identity/fio/lookup` endpoint
- [ ] Add error handling and validation
- [ ] Write API integration tests

---

### Phase 3: UI Components (Days 5-7)

**Tasks**:
- [ ] Build `FIOHandleInput` component
- [ ] Build `FIORegistrationModal` component
- [ ] Build `FIOVerificationBadge` component
- [ ] Add FIO integration to persona creation form
- [ ] Update persona display components
- [ ] Add FIO status to ops console
- [ ] Style components with dark theme

---

### Phase 4: Integration & Testing (Days 8-10)

**Tasks**:
- [ ] Integrate FIO components into existing flows
- [ ] Test registration flow end-to-end
- [ ] Test verification flow
- [ ] Test handle lookup
- [ ] Test error scenarios (network failures, invalid handles)
- [ ] Add loading states and error messages
- [ ] Update documentation

---

### Phase 5: Polish & Documentation (Days 11-14)

**Tasks**:
- [ ] Add FIO handle migration tool for existing personas
- [ ] Create admin interface for FIO management
- [ ] Add FIO analytics to admin dashboard
- [ ] Write user documentation
- [ ] Write developer documentation
- [ ] Create video tutorial
- [ ] Deploy to staging
- [ ] Final testing and bug fixes

---

## 📊 Success Metrics

### Technical Metrics
- [ ] FIO SDK successfully integrated
- [ ] 100% of new personas use verified FIO handles
- [ ] < 3 second handle availability check
- [ ] < 10 second registration completion
- [ ] 99% uptime for FIO API calls

### User Experience Metrics
- [ ] Clear visual feedback for all states
- [ ] Intuitive registration flow
- [ ] Helpful error messages
- [ ] Mobile-responsive design

---

## 🧪 Testing Strategy

### Unit Tests
- FIO service methods
- Handle validation logic
- API endpoint logic

### Integration Tests
- End-to-end registration flow
- Verification flow
- Handle lookup
- Error handling

### Manual Testing
- Registration on FIO testnet
- Verification of existing handles
- Expiration handling
- Network failure scenarios

---

## 🚨 Risks & Mitigations

### Risk: FIO API Downtime
**Mitigation**: 
- Implement retry logic with exponential backoff
- Cache handle availability checks
- Provide fallback to manual verification

### Risk: High Registration Costs
**Mitigation**:
- Display costs upfront
- Provide cost estimation
- Support testnet for development

### Risk: Key Management Complexity
**Mitigation**:
- Provide key generation tool
- Clear documentation
- Support hardware wallet integration (future)

### Risk: Handle Expiration
**Mitigation**:
- Track expiration dates
- Send renewal reminders
- Auto-renewal option (future)

---

## 📚 Resources

### FIO Protocol Documentation
- Main Docs: https://developers.fioprotocol.io/
- SDK Docs: https://github.com/fioprotocol/fiosdk_typescript
- API Reference: https://developers.fioprotocol.io/api/api-spec

### FIO Endpoints
- Mainnet: https://fio.greymass.com
- Testnet: https://fiotestnet.greymass.com

### FIO Explorer
- Mainnet: https://fio.bloks.io/
- Testnet: https://fio-test.bloks.io/

---

## 🔄 Next Steps After Completion

1. **World ID Integration** - Verify human vs agent status
2. **Persona UI Enhancements** - Full CRUD interface
3. **Agent Declaration System** - AI agent registration
4. **Handle Transfer** - Transfer ownership between personas
5. **Multi-Handle Support** - Support multiple handles per persona

---

## 📝 Notes

- FIO handles follow format: `username@domain`
- Default domain for AigentZ: `@aigent` or `@iqube`
- Registration requires FIO tokens (can be subsidized)
- Handles expire after 1 year (renewable)
- Verification should be re-checked periodically

---

**Status**: Ready to begin implementation  
**Next Action**: Install FIO SDK and create service layer  
**Estimated Completion**: October 31, 2025
