# Environment Variables Setup - AigentZBeta

## 🔐 Required Environment Variables

### **Supabase (QubeBase Connection)**

AigentZBeta connects to QubeBase (Supabase) for identity and registry data.

```bash
# Supabase Project URL
SUPABASE_URL=https://bsjhfvctmduxhohtllly.supabase.co

# Supabase Anonymous/Public Key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📋 Where to Get These Values

### **1. Supabase Dashboard**

Go to: https://supabase.com/dashboard/project/bsjhfvctmduxhohtllly/settings/api

Copy:
- **Project URL** → `SUPABASE_URL`
- **Project API keys** → **anon public** → `SUPABASE_ANON_KEY`
- **Project API keys** → **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (optional)

---

## 🚀 Setup Instructions

### **Local Development**

1. **Create `.env.local` file** in project root:
   ```bash
   cd /Users/hal1/CascadeProjects/AigentZBeta
   touch .env.local
   ```

2. **Add variables**:
   ```bash
   # Copy from Supabase Dashboard
   SUPABASE_URL=https://bsjhfvctmduxhohtllly.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Restart dev server**:
   ```bash
   npm run dev
   ```

### **AWS Amplify (Production)**

1. **Go to Amplify Console**:
   - https://console.aws.amazon.com/amplify/

2. **Select AigentZBeta app**

3. **App Settings** → **Environment variables**

4. **Add variables**:
   ```
   SUPABASE_URL = https://bsjhfvctmduxhohtllly.supabase.co
   SUPABASE_ANON_KEY = [paste your anon key]
   ```

5. **Save** → Amplify will auto-redeploy

---

## ✅ Verification

### **Check if Variables are Set**

```bash
# Local
echo $SUPABASE_URL

# Or in Node.js
node -e "console.log(process.env.SUPABASE_URL)"
```

### **Test API Endpoints**

```bash
# Should work after env vars are set
curl http://localhost:3000/api/identity/persona

# Should return personas or empty array (not an error)
```

---

## 🏗️ Architecture

### **Current (Direct Connection)**
```
AigentZBeta → Supabase (QubeBase)
```

**Why This Works**:
- Simple and fast
- Supabase handles auth, RLS, and security
- Environment variables keep credentials secure

### **Future (API Layer - Recommended)**
```
AigentZBeta → QubeBase API → Supabase
```

**Benefits**:
- Centralized business logic
- Multiple apps can use QubeBase
- Easier to add caching, rate limiting, etc.
- Better separation of concerns

---

## 🔒 Security Best Practices

### **✅ DO**
- Store credentials in environment variables
- Use different credentials per environment (dev/staging/prod)
- Use `SUPABASE_ANON_KEY` for client-side (limited permissions)
- Use `SUPABASE_SERVICE_ROLE_KEY` only server-side (full permissions)
- Keep `.env.local` in `.gitignore`

### **❌ DON'T**
- Hardcode credentials in source code
- Commit credentials to Git
- Use service role key in client-side code
- Share credentials publicly

---

## 📚 Related Documentation

- **Supabase Dashboard**: https://supabase.com/dashboard/project/bsjhfvctmduxhohtllly
- **QubeBase README**: `/Users/hal1/CascadeProjects/QubeBase/README.md`
- **DiDQube Migration**: `/Users/hal1/CascadeProjects/QubeBase/MIGRATION_SUCCESS.md`

---

## 🆘 Troubleshooting

### **Error: "Supabase env not configured"**

**Cause**: Environment variables not set

**Solution**:
1. Check `.env.local` exists and has correct values
2. Restart dev server after adding variables
3. For Amplify, check environment variables in console

### **Error: "Invalid API key"**

**Cause**: Wrong or expired key

**Solution**:
1. Get fresh key from Supabase Dashboard
2. Update environment variables
3. Redeploy (Amplify) or restart (local)

### **Registry works but DiDQube doesn't**

**Cause**: Some services have fallbacks, others require env vars

**Solution**:
- Set environment variables properly
- All services should use env vars (no hardcoded fallbacks)

---

**Status**: ✅ Credentials removed from code  
**Required**: Environment variables must be set  
**Security**: Improved - no credentials in Git
