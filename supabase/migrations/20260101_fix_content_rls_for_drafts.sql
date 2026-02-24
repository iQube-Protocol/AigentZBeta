-- Fix RLS policies to allow authenticated users to view draft content
-- This allows admin portal users to see and manage draft articles

-- Add policy for authenticated users to view all content (including drafts)
CREATE POLICY "Authenticated users can view all content"
  ON public.content
  FOR SELECT
  TO authenticated
  USING (true);

-- Note: The existing "Published content is viewable by everyone" policy
-- will continue to allow anonymous users to see published content.
-- Authenticated users will be able to see both published and draft content.
