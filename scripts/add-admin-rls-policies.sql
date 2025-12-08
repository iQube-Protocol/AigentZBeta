-- ════════════════════════════════════════════════════════
-- Add Admin Portal RLS Policies
-- ════════════════════════════════════════════════════════
--
-- Purpose: Enable read/write operations for admin portal in development
-- Run this in Supabase SQL Editor
--
-- WARNING: These policies are permissive for development
-- For production, restrict to specific admin users/roles
--
-- ════════════════════════════════════════════════════════

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read published content" ON content;
DROP POLICY IF EXISTS "Allow anonymous read all" ON content;
DROP POLICY IF EXISTS "Allow anonymous update" ON content;
DROP POLICY IF EXISTS "Allow anonymous insert" ON content;
DROP POLICY IF EXISTS "Allow anonymous delete" ON content;

-- ════════════════════════════════════════════════════════
-- DEVELOPMENT POLICIES (PERMISSIVE)
-- ════════════════════════════════════════════════════════

-- Allow anyone to SELECT all content (for admin portal to load data)
CREATE POLICY "Allow anonymous read all"
  ON content FOR SELECT
  USING (true);

-- Allow anyone to UPDATE content (for publish/unpublish and editing)
CREATE POLICY "Allow anonymous update"
  ON content FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow anyone to INSERT content (for creating new articles)
CREATE POLICY "Allow anonymous insert"
  ON content FOR INSERT
  WITH CHECK (true);

-- Allow anyone to DELETE content (for content management)
CREATE POLICY "Allow anonymous delete"
  ON content FOR DELETE
  USING (true);

-- ════════════════════════════════════════════════════════
-- VERIFY POLICIES
-- ════════════════════════════════════════════════════════

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'content';

-- ════════════════════════════════════════════════════════
-- PRODUCTION POLICIES (COMMENTED OUT - FOR REFERENCE)
-- ════════════════════════════════════════════════════════
--
-- For production, replace the above with:
--
-- -- Allow public to read published content only
-- CREATE POLICY "Allow public read published"
--   ON content FOR SELECT
--   USING (status = 'published');
--
-- -- Allow authenticated admins to manage content
-- CREATE POLICY "Allow admin full access"
--   ON content
--   USING (
--     auth.uid() IN (
--       SELECT user_id FROM admin_users WHERE is_active = true
--     )
--   )
--   WITH CHECK (
--     auth.uid() IN (
--       SELECT user_id FROM admin_users WHERE is_active = true
--     )
--   );
--
-- ════════════════════════════════════════════════════════

-- Enable RLS if not already enabled
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Admin portal RLS policies added successfully';
  RAISE NOTICE '⚠️  WARNING: These are development policies - DO NOT use in production';
END $$;
