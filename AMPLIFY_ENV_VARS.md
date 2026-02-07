# Required Amplify Environment Variables

## ✅ Critical Variables for Agent Key Security

Add these environment variables to your AWS Amplify console:

### 1. Supabase Connection
```
SUPABASE_URL = https://bsjhfvctmduxhohtllly.supabase.co
```

### 2. Supabase Service Role Key
```
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzamhmdmN0bWR1eGhvaHRsbGx5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzU0ODI1OCwiZXhwIjoyMDczMTI0MjU4fQ.Ex0TywZI7QD7i3KcGkwK_xsSU9SZqwDBT7nlpaQ59ng
```

### 3. Agent Master Encryption Key
```
AGENT_KEY_ENCRYPTION_SECRET = e35c7d79651daadd8723ff952c90fe55c567143065e1159d5e683ff3c9703fda
```

---

## 📋 How to Add in Amplify Console

1. Go to **AWS Amplify Console**
2. Select your app: **AigentZBeta**
3. Go to **App settings** → **Environment variables**
4. Click **Manage variables**
5. Add each variable above (name = value)
6. Click **Save**
7. Redeploy your app

---

## ⚠️ Important Notes

- **SUPABASE_SERVICE_ROLE_KEY**: Required for server-side access to encrypted agent keys
- **AGENT_KEY_ENCRYPTION_SECRET**: Required to decrypt agent private keys from Supabase
- **SUPABASE_URL**: Required to connect to your Supabase instance

Without these variables, agent-to-agent transfers will fail with:
```
❌ Missing Supabase URL or anon key
```

---

## ✅ Verification

After adding the variables and redeploying, test by:
1. Opening the app in production
2. Selecting an agent (e.g., Aigent Z)
3. Opening the wallet drawer
4. Attempting a transfer to another agent

If successful, you'll see:
```
✅ Transaction sent successfully!
```
