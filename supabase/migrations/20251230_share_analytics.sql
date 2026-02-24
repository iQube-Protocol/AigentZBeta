-- Create share_analytics table for tracking article shares
CREATE TABLE IF NOT EXISTS share_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id TEXT NOT NULL,
  persona_id TEXT,
  platform TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  deep_link TEXT NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT share_analytics_article_id_fkey 
    FOREIGN KEY (article_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_share_analytics_article_id ON share_analytics(article_id);
CREATE INDEX IF NOT EXISTS idx_share_analytics_persona_id ON share_analytics(persona_id);
CREATE INDEX IF NOT EXISTS idx_share_analytics_platform ON share_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_share_analytics_timestamp ON share_analytics(timestamp);

-- Add share_count column to content table if it doesn't exist
ALTER TABLE content 
ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0;

-- Create function to increment share count
CREATE OR REPLACE FUNCTION increment_share_count(content_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE content 
  SET share_count = COALESCE(share_count, 0) + 1,
      updated_at = NOW()
  WHERE id = content_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for share analytics dashboard
CREATE OR REPLACE VIEW share_analytics_summary AS
SELECT 
  c.id as article_id,
  c.title,
  c.section,
  COUNT(sa.id) as total_shares,
  COUNT(DISTINCT sa.persona_id) as unique_personas,
  COUNT(DISTINCT sa.platform) as platforms_used,
  MAX(sa.timestamp) as last_shared,
  c.share_count as cached_share_count
FROM content c
LEFT JOIN share_analytics sa ON c.id = sa.article_id
GROUP BY c.id, c.title, c.section, c.share_count
ORDER BY total_shares DESC;

-- Create view for persona sharing leaderboard
CREATE OR REPLACE VIEW persona_sharing_leaderboard AS
SELECT 
  sa.persona_id,
  COUNT(sa.id) as shares_made,
  COUNT(DISTINCT sa.article_id) as unique_articles_shared,
  COUNT(DISTINCT sa.platform) as platforms_used,
  MAX(sa.timestamp) as last_shared
FROM share_analytics sa
WHERE sa.persona_id IS NOT NULL
GROUP BY sa.persona_id
ORDER BY shares_made DESC;

-- Create view for platform analytics
CREATE OR REPLACE VIEW platform_analytics AS
SELECT 
  sa.platform,
  COUNT(sa.id) as total_shares,
  COUNT(DISTINCT sa.article_id) as unique_articles,
  COUNT(DISTINCT sa.persona_id) as unique_personas,
  DATE_TRUNC('day', sa.timestamp) as share_date
FROM share_analytics sa
GROUP BY sa.platform, DATE_TRUNC('day', sa.timestamp)
ORDER BY share_date DESC, total_shares DESC;

-- Enable RLS (Row Level Security)
ALTER TABLE share_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can insert share analytics" ON share_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view share analytics" ON share_analytics
  FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT, INSERT ON share_analytics TO authenticated;
GRANT SELECT ON share_analytics TO anon;
GRANT EXECUTE ON FUNCTION increment_share_count TO authenticated;
GRANT SELECT ON share_analytics_summary TO authenticated;
GRANT SELECT ON share_analytics_summary TO anon;
GRANT SELECT ON persona_sharing_leaderboard TO authenticated;
GRANT SELECT ON persona_sharing_leaderboard TO anon;
GRANT SELECT ON platform_analytics TO authenticated;
GRANT SELECT ON platform_analytics TO anon;
