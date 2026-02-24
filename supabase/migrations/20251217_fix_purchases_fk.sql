-- Fix purchases table foreign key to reference persona (singular) instead of personas (plural)
-- The persona table is the primary table for human personas

-- Drop the existing foreign key constraint
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_persona_id_fkey;

-- Add new foreign key to persona table (singular)
ALTER TABLE purchases 
ADD CONSTRAINT purchases_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE;

-- Also fix user_entitlements if it has the same issue
ALTER TABLE user_entitlements DROP CONSTRAINT IF EXISTS user_entitlements_persona_id_fkey;
ALTER TABLE user_entitlements 
ADD CONSTRAINT user_entitlements_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE;

-- Fix reward_grants
ALTER TABLE reward_grants DROP CONSTRAINT IF EXISTS reward_grants_persona_id_fkey;
ALTER TABLE reward_grants 
ADD CONSTRAINT reward_grants_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE;

-- Fix reputation_events
ALTER TABLE reputation_events DROP CONSTRAINT IF EXISTS reputation_events_persona_id_fkey;
ALTER TABLE reputation_events 
ADD CONSTRAINT reputation_events_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE;

-- Fix episode_engagement_events
ALTER TABLE episode_engagement_events DROP CONSTRAINT IF EXISTS episode_engagement_events_persona_id_fkey;
ALTER TABLE episode_engagement_events 
ADD CONSTRAINT episode_engagement_events_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE;

-- Fix weekly_engagement_streaks
ALTER TABLE weekly_engagement_streaks DROP CONSTRAINT IF EXISTS weekly_engagement_streaks_persona_id_fkey;
ALTER TABLE weekly_engagement_streaks 
ADD CONSTRAINT weekly_engagement_streaks_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE;

-- Fix share_links
ALTER TABLE share_links DROP CONSTRAINT IF EXISTS share_links_persona_id_fkey;
ALTER TABLE share_links 
ADD CONSTRAINT share_links_persona_id_fkey 
FOREIGN KEY (persona_id) REFERENCES persona(id) ON DELETE CASCADE;

-- Fix share_signups new_persona_id
ALTER TABLE share_signups DROP CONSTRAINT IF EXISTS share_signups_new_persona_id_fkey;
ALTER TABLE share_signups 
ADD CONSTRAINT share_signups_new_persona_id_fkey 
FOREIGN KEY (new_persona_id) REFERENCES persona(id) ON DELETE SET NULL;
