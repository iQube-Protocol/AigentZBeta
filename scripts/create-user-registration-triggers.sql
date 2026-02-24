-- ============================================================================
-- User Registration Triggers for SmartWallet SDK
-- ============================================================================
-- This script creates the database triggers needed for automatic user
-- provisioning when a new user signs up via Supabase Auth.
--
-- Run this in Supabase SQL Editor or via migration.
-- ============================================================================

-- ============================================================================
-- 1. Create profiles table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES public.persona(id) ON DELETE SET NULL,
  display_name TEXT,
  avatar_url TEXT,
  wallet_addresses JSONB DEFAULT '{}',
  trading_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. Create user_did_mapping table if it doesn't exist
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_did_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  did TEXT NOT NULL,
  persona_id UUID REFERENCES public.persona(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS on user_did_mapping
ALTER TABLE public.user_did_mapping ENABLE ROW LEVEL SECURITY;

-- Users can read their own DID mapping
DROP POLICY IF EXISTS "Users can view own DID mapping" ON public.user_did_mapping;
CREATE POLICY "Users can view own DID mapping"
  ON public.user_did_mapping FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own DID mapping
DROP POLICY IF EXISTS "Users can update own DID mapping" ON public.user_did_mapping;
CREATE POLICY "Users can update own DID mapping"
  ON public.user_did_mapping FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own DID mapping
DROP POLICY IF EXISTS "Users can insert own DID mapping" ON public.user_did_mapping;
CREATE POLICY "Users can insert own DID mapping"
  ON public.user_did_mapping FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. handle_new_user() - Creates profile on signup
-- ============================================================================
-- This function is triggered AFTER INSERT on auth.users
-- It creates a basic profile for the new user (persona is created during onboarding)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  -- Create profile for the new user
  -- Note: persona_id is NULL initially, set during onboarding
  INSERT INTO public.profiles (
    id,
    display_name,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. auto_assign_admin_role() - Auto-assigns admin to approved emails
-- ============================================================================
-- This function auto-assigns admin role to pre-approved email addresses

CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  admin_role_id UUID;
  approved_emails TEXT[] := ARRAY[
    'cd@cryptopolitics.us',
    'dele@metame.cm',
    'kt@cryptopolitics.us',
    'lisawattslimitless@gmail.com'
    -- Add more approved admin emails here
  ];
BEGIN
  -- Check if the new user's email is in the approved list
  IF NEW.email = ANY(approved_emails) THEN
    -- Find the admin role ID
    SELECT r.id INTO admin_role_id
    FROM roles r
    JOIN tenants t ON r.tenant_id = t.id
    WHERE r.name = 'admin' AND t.name = 'default'
    LIMIT 1;

    -- If admin role exists, assign it to the user
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id)
      VALUES (NEW.id, admin_role_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;
      
      RAISE NOTICE 'Auto-assigned admin role to user: %', NEW.email;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for auto admin assignment
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_admin_role();

-- ============================================================================
-- 5. update_updated_at() - Generic updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Apply updated_at trigger to user_did_mapping
DROP TRIGGER IF EXISTS update_user_did_mapping_updated_at ON public.user_did_mapping;
CREATE TRIGGER update_user_did_mapping_updated_at
  BEFORE UPDATE ON public.user_did_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- 6. Grant permissions
-- ============================================================================
-- Allow authenticated users to access their own data
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_did_mapping TO authenticated;

-- Allow service role full access
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_did_mapping TO service_role;

-- ============================================================================
-- Verification queries (run these to verify setup)
-- ============================================================================
-- Check if triggers exist:
-- SELECT * FROM pg_trigger WHERE tgname LIKE 'on_auth_user%';

-- Check if functions exist:
-- SELECT proname FROM pg_proc WHERE proname IN ('handle_new_user', 'auto_assign_admin_role');

-- Test profile creation (after signup):
-- SELECT * FROM profiles WHERE id = '<user-id>';

COMMENT ON FUNCTION public.handle_new_user() IS 
  'Creates a profile record when a new user signs up via Supabase Auth';

COMMENT ON FUNCTION public.auto_assign_admin_role() IS 
  'Auto-assigns admin role to pre-approved email addresses on signup';
