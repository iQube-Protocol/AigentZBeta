# DIDQube Phase 3: Complete Integration Guide

## 🎯 Overview

Phase 3 completes the DIDQube system by integrating:
- Supabase persona database with IC RQH canister
- Evidence submission and verification system
- Admin dashboard for reputation management
- End-to-end reputation tracking

## 📋 Prerequisites

- ✅ DIDQube Phase 1 complete (Kybe, Root, Persona tables)
- ✅ DIDQube Phase 2 complete (RQH canister deployed)
- ✅ RQH Canister ID: `zdjf3-2qaaa-aaaas-qck4q-cai`
- ✅ Supabase project configured
- ✅ Environment variables set

## 🚀 Setup Instructions

### 1. Run Supabase Migration

```bash
# In Supabase SQL Editor, run:
/Users/hal1/CascadeProjects/QubeBase/supabase/migrations/20251017_didqube_reputation.sql
```

This creates:
- `reputation_bucket` table (links personas to RQH canister)
- `reputation_evidence` table (tracks evidence submissions)
- `sync_reputation_from_rqh()` function (syncs IC data to Supabase)
- `persona_with_reputation` view (joined persona + reputation data)

### 2. Verify Environment Variables

```bash
# Required in .env.local
RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai
NEXT_PUBLIC_RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Create Test Personas

```bash
# Install tsx if needed
npm install -g tsx

# Run test persona creation script
npx tsx scripts/create-test-personas.ts
```

This creates 5 test personas with varying reputation levels:
- alice_blockchain (score: 85, bucket: 4)
- bob_defi (score: 72, bucket: 3)
- charlie_nft (score: 65, bucket: 3)
- diana_web3 (score: 55, bucket: 2)
- eve_smartcontracts (score: 40, bucket: 2)

### 4. Start Development Server

```bash
npm run dev
```

## 📊 Architecture

### Data Flow

```
User Action
    ↓
Frontend Component
    ↓
API Route (/api/identity/persona/[id]/reputation)
    ↓
    ├─→ Supabase (persona lookup)
    └─→ IC RQH Canister (reputation data)
         ↓
    Sync back to Supabase
         ↓
    Return combined data
```

### Key Components

#### 1. API Endpoints

**GET `/api/identity/persona/[id]/reputation`**
- Fetches reputation for a specific persona
- Syncs IC canister data to Supabase
- Returns combined persona + reputation data

**POST `/api/identity/persona/[id]/reputation`**
- Creates new reputation bucket in RQH canister
- Links to Supabase persona
- Returns created reputation data

**POST `/api/identity/reputation/evidence`**
- Submits evidence to RQH canister
- Stores reference in Supabase
- Updates reputation score

**GET `/api/identity/reputation/evidence?bucketId=xxx`**
- Retrieves evidence from IC canister
- Includes Supabase metadata

#### 2. UI Components

**DiDQubeIdentityCard** (`components/ops/DiDQubeIdentityCard.tsx`)
- Displays personas with reputation badges
- Shows bucket level and score
- Links to detailed view

**EvidenceSubmissionForm** (`components/identity/EvidenceSubmissionForm.tsx`)
- Form for submitting reputation evidence
- Multiple evidence types supported
- Weight slider for impact level

**Admin Dashboard** (`app/admin/reputation/page.tsx`)
- Full reputation management interface
- Create reputation buckets
- Submit evidence
- View detailed stats

#### 3. Database Schema

**reputation_bucket**
```sql
- id: uuid (PK)
- persona_id: uuid (FK to persona)
- partition_id: text (used in RQH canister)
- rqh_bucket_id: text (IC canister ID)
- skill_category: text
- bucket_level: int (0-4)
- score: numeric (0-100)
- evidence_count: int
- last_synced_at: timestamptz
```

**reputation_evidence**
```sql
- id: uuid (PK)
- reputation_bucket_id: uuid (FK)
- rqh_evidence_id: text (IC canister ID)
- evidence_type: text
- evidence_data: jsonb
- weight: numeric (0-1)
- verified: boolean
- verified_by: uuid (FK to auth.users)
```

## 🧪 Testing Guide

### Test 1: Create Reputation Bucket

```bash
# Via API
curl -X POST http://localhost:3000/api/identity/persona/PERSONA_ID/reputation \
  -H "Content-Type: application/json" \
  -d '{
    "skillCategory": "blockchain_development",
    "initialScore": 75
  }'

# Expected: Reputation bucket created with bucket level 3
```

### Test 2: Submit Evidence

```bash
curl -X POST http://localhost:3000/api/identity/reputation/evidence \
  -H "Content-Type: application/json" \
  -d '{
    "bucketId": "BUCKET_ID",
    "evidenceType": "github_contribution",
    "evidenceData": {
      "title": "Implemented smart contract",
      "description": "Built and deployed ERC-20 token contract",
      "url": "https://github.com/..."
    },
    "weight": 0.7
  }'

# Expected: Evidence submitted, score updated
```

### Test 3: Verify Sync

```bash
# Get reputation from API
curl http://localhost:3000/api/identity/persona/PERSONA_ID/reputation

# Check Supabase
SELECT * FROM persona_with_reputation WHERE id = 'PERSONA_ID';

# Verify data matches between IC canister and Supabase
```

### Test 4: Admin Dashboard

1. Navigate to `http://localhost:3000/admin/reputation`
2. Select a persona from the list
3. View reputation stats
4. Submit evidence via form
5. Verify score updates in real-time

## 🎨 UI Features

### Reputation Display

**Bucket Levels:**
- **Level 4** (80-100): Emerald - Excellent
- **Level 3** (60-79): Green - Good
- **Level 2** (40-59): Yellow - Fair
- **Level 1** (20-39): Orange - Poor
- **Level 0** (0-19): Red - Very Low

**Evidence Types:**
- GitHub Contribution
- Project Completion
- Peer Endorsement
- Certification
- Code Review
- Community Contribution
- Other

**Weight Levels:**
- 0.1-0.3: Low Impact
- 0.4-0.6: Medium Impact
- 0.7-1.0: High Impact

## 🔒 Security Considerations

### RLS Policies

**reputation_bucket:**
- ✅ Anyone can read (public reputation)
- ✅ Authenticated users can create
- ✅ Authenticated users can update own

**reputation_evidence:**
- ✅ Anyone can read (transparency)
- ✅ Authenticated users can submit
- ⏳ Admin verification required (future)

### Data Validation

- Partition IDs must match persona IDs
- Scores constrained to 0-100
- Bucket levels constrained to 0-4
- Evidence weight constrained to 0-1

## 📈 Monitoring

### Key Metrics

1. **Reputation Sync Status**
   - Check `last_synced_at` timestamps
   - Verify IC canister data matches Supabase

2. **Evidence Submission Rate**
   - Track evidence count per persona
   - Monitor verification backlog

3. **Score Distribution**
   - Analyze bucket level distribution
   - Identify reputation trends

### Health Checks

```bash
# Check RQH canister health
curl http://localhost:3000/api/identity/reputation/health

# Check Supabase connection
SELECT COUNT(*) FROM reputation_bucket;

# Verify sync function
SELECT sync_reputation_from_rqh('test_partition', 3, 75.5, 5);
```

## 🚀 Production Deployment

### 1. Update AWS Amplify Environment Variables

```bash
RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai
NEXT_PUBLIC_RQH_CANISTER_ID=zdjf3-2qaaa-aaaas-qck4q-cai
```

### 2. Run Supabase Migration in Production

```sql
-- Run in production Supabase SQL editor
-- File: 20251017_didqube_reputation.sql
```

### 3. Verify Deployment

- Test API endpoints in production
- Create test persona with reputation
- Submit test evidence
- Verify admin dashboard access

### 4. Monitor Performance

- Track API response times
- Monitor IC canister cycles
- Check Supabase query performance
- Set up error alerting

## 🐛 Troubleshooting

### Issue: "RQH canister not configured"

**Solution:**
```bash
# Verify environment variables
echo $RQH_CANISTER_ID
echo $NEXT_PUBLIC_RQH_CANISTER_ID

# Should output: zdjf3-2qaaa-aaaas-qck4q-cai
```

### Issue: "Persona not found"

**Solution:**
```sql
-- Check if persona exists in Supabase
SELECT * FROM persona WHERE id = 'PERSONA_ID';

-- Create persona if missing
INSERT INTO persona (fio_handle, default_identity_state, app_origin)
VALUES ('test_user', 'semi_anonymous', 'aigentzbeta');
```

### Issue: "Failed to sync reputation"

**Solution:**
```sql
-- Check sync function exists
SELECT proname FROM pg_proc WHERE proname = 'sync_reputation_from_rqh';

-- Test sync function manually
SELECT sync_reputation_from_rqh('test_partition', 3, 75.5, 5);

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'reputation_bucket';
```

### Issue: Evidence not appearing

**Solution:**
- Verify bucket ID is correct
- Check IC canister response
- Verify Supabase insert succeeded
- Check browser console for errors

## 📚 Additional Resources

- [RQH Canister Documentation](../services/ops/idl/rqh.ts)
- [Supabase Schema](../../QubeBase/supabase/migrations/)
- [API Routes](../app/api/identity/)
- [UI Components](../components/identity/)

## ✅ Success Criteria

- [ ] Supabase migration applied successfully
- [ ] Test personas created with reputation
- [ ] Evidence submission working
- [ ] Admin dashboard accessible
- [ ] Reputation sync between IC and Supabase
- [ ] DiDQubeIdentityCard shows reputation badges
- [ ] Production environment variables configured
- [ ] End-to-end flow tested

## 🎉 Phase 3 Complete!

You now have a fully integrated decentralized identity and reputation system with:
- ✅ IC canister for trustless reputation storage
- ✅ Supabase for fast queries and caching
- ✅ Evidence submission and verification
- ✅ Admin dashboard for management
- ✅ Real-time reputation display in UI

**Next Phase:** TokenQube integration for access control and staking mechanisms.
