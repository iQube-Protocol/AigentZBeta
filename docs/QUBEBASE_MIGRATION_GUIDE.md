# QubeBase Migration Guide - DiDQube Schema

This guide explains how to migrate the DiDQube schema from AigentZBeta to the QubeBase repository and execute it in Supabase.

---

## 📋 Overview

**Source File**: `docs/supabase-didqube.sql` (in AigentZBeta repo)  
**Target Location**: `db/migrations/` (in QubeBase repo)  
**Target Repo**: https://github.com/iQube-Protocol/QubeBase

---

## 🎯 Migration Steps

### **Step 1: Copy Migration to QubeBase**

Assuming you have both repos cloned locally:

```bash
# Navigate to AigentZBeta
cd /Users/hal1/CascadeProjects/AigentZBeta

# Copy migration to QubeBase
cp docs/supabase-didqube.sql ../QubeBase/db/migrations/20251015_didqube.sql

# Navigate to QubeBase
cd ../QubeBase
```

### **Step 2: Create PR in QubeBase**

```bash
# Create feature branch
git checkout -b feat/didqube-schema

# Add migration
git add db/migrations/20251015_didqube.sql

# Commit
git commit -m "feat(schema): Add DiDQube identity and reputation tables

- kybe_identity: Root identity with World ID integration
- root_identity: Persona root identities
- persona: User personas with FIO handles
- persona_agent_binding: Links personas to agents
- hcp_profile: Human-Centric Profile data

All tables have RLS enabled with permissive initial policies.
Related to: iQube-Protocol/AigentZBeta#<PR_NUMBER>"

# Push branch
git push origin feat/didqube-schema
```

### **Step 3: Execute Migration in Supabase**

#### **Option A: Via Supabase SQL Editor (Recommended)**

1. Navigate to Supabase Dashboard: https://app.supabase.com
2. Select your QubeBase project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy contents of `20251015_didqube.sql`
6. Paste into editor
7. Click **Run** or press `Cmd+Enter`
8. Verify success in output panel

#### **Option B: Via Supabase CLI**

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Run migration
supabase db push

# Or run specific migration
supabase db execute --file db/migrations/20251015_didqube.sql
```

#### **Option C: Via CI/CD (if configured)**

If QubeBase has automated migration CI:
1. Merge PR to `main` or `staging`
2. CI will automatically execute migrations
3. Monitor deployment logs

---

## ✅ Verification

After executing the migration, verify tables were created:

### **Check Tables Exist**

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'kybe_identity',
  'root_identity', 
  'persona',
  'persona_agent_binding',
  'hcp_profile'
);
```

Expected result: 5 rows

### **Check RLS is Enabled**

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'kybe_identity',
  'root_identity',
  'persona', 
  'persona_agent_binding',
  'hcp_profile'
);
```

Expected: All tables should have `rowsecurity = true`

### **Check Policies Exist**

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN (
  'kybe_identity',
  'root_identity',
  'persona',
  'persona_agent_binding', 
  'hcp_profile'
);
```

Expected: At least 1 policy per table (permissive initial policies)

---

## 🧪 Test Data Creation

After migration, create test data to verify AigentZBeta integration:

### **Create Test Persona**

```sql
-- Insert test kybe_identity
INSERT INTO kybe_identity (id, world_id_hash, world_id_status, created_at)
VALUES (
  gen_random_uuid(),
  'test_world_id_hash_123',
  'verified_human',
  NOW()
);

-- Insert test root_identity
INSERT INTO root_identity (id, kybe_id, created_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM kybe_identity LIMIT 1),
  NOW()
);

-- Insert test persona
INSERT INTO persona (id, root_id, fio_handle, default_identity_state, world_id_status, created_at)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM root_identity LIMIT 1),
  'test.fio',
  'semi_anonymous',
  'verified_human',
  NOW()
);

-- Verify
SELECT * FROM persona;
```

### **Test via AigentZBeta API**

```bash
# List personas (should return test persona)
curl http://localhost:3000/api/identity/persona

# Create new persona
curl -X POST http://localhost:3000/api/identity/persona \
  -H "Content-Type: application/json" \
  -d '{"fioHandle":"demo.fio","defaultState":"semi_anonymous"}'
```

---

## 🔐 Environment Variables

After migration, ensure these are set in AigentZBeta:

### **Local Development** (`.env.local`)

```bash
# QubeBase/Supabase Connection
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here  # Optional, for admin operations
```

### **Production/Staging** (AWS Amplify/Vercel)

Set the same variables in your deployment platform:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (optional)

---

## 🔄 Rollback Procedure

If you need to rollback the migration:

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS persona_agent_binding CASCADE;
DROP TABLE IF EXISTS hcp_profile CASCADE;
DROP TABLE IF EXISTS persona CASCADE;
DROP TABLE IF EXISTS root_identity CASCADE;
DROP TABLE IF EXISTS kybe_identity CASCADE;
```

**Warning**: This will delete all data in these tables. Only use in development/staging.

---

## 📊 Schema Overview

### **Tables Created**

1. **kybe_identity** (Root identity layer)
   - `id` (UUID, PK)
   - `world_id_hash` (TEXT, unique)
   - `world_id_status` (TEXT)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **root_identity** (Persona root)
   - `id` (UUID, PK)
   - `kybe_id` (UUID, FK → kybe_identity)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

3. **persona** (User personas)
   - `id` (UUID, PK)
   - `root_id` (UUID, FK → root_identity)
   - `fio_handle` (TEXT, unique, nullable)
   - `default_identity_state` (TEXT)
   - `world_id_status` (TEXT)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

4. **persona_agent_binding** (Persona-Agent links)
   - `id` (UUID, PK)
   - `persona_id` (UUID, FK → persona)
   - `agent_id` (TEXT)
   - `binding_type` (TEXT)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

5. **hcp_profile** (Human-Centric Profiles)
   - `id` (UUID, PK)
   - `persona_id` (UUID, FK → persona)
   - `profile_data` (JSONB)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

### **Indexes Created**

- `idx_kybe_identity_world_id` on `kybe_identity(world_id_hash)`
- `idx_root_identity_kybe` on `root_identity(kybe_id)`
- `idx_persona_root` on `persona(root_id)`
- `idx_persona_fio` on `persona(fio_handle)`
- `idx_persona_agent_binding_persona` on `persona_agent_binding(persona_id)`
- `idx_hcp_profile_persona` on `hcp_profile(persona_id)`

---

## 🚨 Troubleshooting

### **Issue: Migration fails with "relation already exists"**

**Solution**: Tables already exist. Either:
1. Drop existing tables (if safe)
2. Skip migration (tables already created)
3. Modify migration to use `CREATE TABLE IF NOT EXISTS`

### **Issue: Permission denied**

**Solution**: Ensure you're using a Supabase admin account or service role key.

### **Issue: RLS policies blocking queries**

**Solution**: Initial policies are permissive. If issues persist:
```sql
-- Temporarily disable RLS for debugging (NOT for production)
ALTER TABLE persona DISABLE ROW LEVEL SECURITY;
```

### **Issue: AigentZBeta can't connect to Supabase**

**Solution**: Verify environment variables:
```bash
# Check .env.local
cat .env.local | grep SUPABASE

# Test connection
curl https://your-project.supabase.co/rest/v1/persona \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"
```

---

## 📝 Next Steps After Migration

1. ✅ Verify all 5 tables created
2. ✅ Verify RLS enabled on all tables
3. ✅ Create test persona via SQL or API
4. ✅ Test AigentZBeta API routes
5. ✅ Update environment variables in production
6. ⏭️ Deploy ICP canisters (see IC deployment guide)
7. ⏭️ End-to-end testing with live canisters

---

## 📚 Related Documentation

- **DiDQube Phase 1 Summary**: `docs/DIDQUBE_PHASE1_SUMMARY.md`
- **Migration SQL**: `docs/supabase-didqube.sql`
- **IC Deployment Guide**: `docs/IC_CANISTER_DEPLOYMENT_GUIDE.md` (to be created)
- **QubeBase Repo**: https://github.com/iQube-Protocol/QubeBase

---

## 🆘 Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Verify table structure matches migration
3. Test with simple SQL queries first
4. Check AigentZBeta API logs for connection errors
5. Reach out to team for assistance

---

**Migration File**: `docs/supabase-didqube.sql`  
**Target Repo**: QubeBase  
**Status**: Ready to execute
