# Marketa Database Setup Guide

## Problem: "Could not find the table 'public.marketa_campaigns' in the schema cache"

This error occurs because the Marketa database tables haven't been created yet. The API is trying to access tables that don't exist in the database.

## 🚀 Quick Fix (One-Command Setup)

### **Option 1: Run the Setup Script**
```bash
# Make sure you have your Supabase environment variables set
export SUPABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the setup script
npm run setup-marketa
```

### **Option 2: Manual SQL Execution**
```bash
# Direct psql execution
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -f scripts/setup-marketa-tables.sql
```

### **Option 3: Copy-Paste SQL**
Copy the contents of `scripts/setup-marketa-tables.sql` and run it directly in your Supabase SQL editor.

## 🔧 What the Setup Script Does

The setup script creates all necessary Marketa tables:

### **Core Tables:**
- `marketa_campaigns` - Main campaign definitions
- `marketa_sequence_items` - Daily content for sequence campaigns
- `marketa_multi_tenant_campaigns` - Multi-tenant deployment info
- `marketa_tenant_campaign_configs` - Per-tenant campaign settings
- `marketa_partner_rewards` - Reward configurations
- `marketa_delivery_logs` - Content delivery tracking

### **Performance Features:**
- **Indexes** for fast queries on common filters
- **RLS Policies** for security (development-friendly)
- **Triggers** for automatic `updated_at` timestamps
- **Sample Data** for testing

## 📋 Step-by-Step Instructions

### **1. Get Your Database URL**
Find your Supabase database connection string:
1. Go to Supabase Dashboard → Settings → Database
2. Copy the "Connection string" (use the one with `postgres:`)
3. Replace `[YOUR-PASSWORD]` with your actual database password

### **2. Set Environment Variable**
```bash
export SUPABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
```

### **3. Run Setup**
```bash
npm run setup-marketa
```

### **4. Verify Success**
You should see output like:
```
🔧 Setting up Marketa database tables...
🎉 Marketa database setup complete!
✅ Tables created: marketa_campaigns, marketa_sequence_items, and related tables
✅ Indexes created for performance
✅ RLS policies enabled
✅ Triggers created for updated_at timestamps
🚀 You can now seed the 21 Awakenings campaign!
```

## 🎯 After Setup: Test the 21 Awakenings Campaign

Once the database is set up:

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Marketa:**
   ```
   http://localhost:3000/marketa
   ```

3. **Click "Campaign Manager" tab**

4. **Click "Seed 21 Awakenings" button**

5. **Success!** You should see:
   - ✅ Success toast notification
   - ✅ New campaign in the list
   - ✅ Purple "21 Awakenings" badge
   - ✅ Click "View" to see the 21-day sequence

## 🔍 Troubleshooting

### **Connection Issues**
```bash
# Test database connection
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" -c "SELECT version();"
```

### **Permission Issues**
Make sure your database user has CREATE privileges:
```sql
-- Check current user
SELECT current_user;

-- Grant privileges if needed
GRANT CREATE ON SCHEMA marketa TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA marketa TO postgres;
```

### **Table Still Not Found**
Verify tables were created:
```sql
-- List all Marketa tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'marketa' 
ORDER BY table_name;
```

### **Alternative: Use Supabase Dashboard**
1. Go to Supabase Dashboard → SQL Editor
2. Copy-paste the contents of `scripts/setup-marketa-tables.sql`
3. Click "Run"

## 🏗️ Database Schema Overview

### **Campaign Flow:**
```
marketa_campaigns (main campaign)
├── marketa_sequence_items (daily content)
├── marketa_multi_tenant_campaigns (deployment info)
├── marketa_tenant_campaign_configs (per-tenant settings)
├── marketa_partner_rewards (rewards)
└── marketa_delivery_logs (tracking)
```

### **Key Columns:**
- **campaigns.id**: Unique campaign identifier
- **campaigns.campaign_type**: 'wpp', 'custom', or 'sequence'
- **sequence_items.day_number**: Day in sequence (1-21 for 21 Awakenings)
- **sequence_items.asset_ref**: Reference to content asset
- **delivery_logs.platform**: 'linkedin', 'x', 'facebook', etc.

## 🚀 Next Steps

After successful setup:

1. **Test the Campaign Manager** - Seed and view campaigns
2. **Explore Asset Catalog** - Browse available content
3. **Test Admin Functions** - All admin features should work
4. **Develop New Features** - Database is ready for development

## 📞 Support

If you encounter issues:

1. **Check the logs** - Look for specific error messages
2. **Verify environment** - Ensure SUPABASE_URL is correct
3. **Check permissions** - Ensure database user has CREATE privileges
4. **Try manual setup** - Use Supabase Dashboard SQL Editor

The setup script is designed to be **idempotent** - you can run it multiple times safely. It handles:
- Existing tables (CREATE TABLE IF NOT EXISTS)
- Existing indexes (CREATE INDEX IF NOT EXISTS)
- Existing triggers (DROP TRIGGER IF EXISTS + CREATE)
- Existing policies (DROP POLICY IF EXISTS + CREATE)
- Duplicate sample data (ON CONFLICT DO NOTHING)
