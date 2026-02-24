-- Asset Reference Functions for Partner Campaigns
-- Enables partners to reference QubeBase content in their campaigns

-- =============================================================================
-- 1. ASSET REFERENCE RESOLVER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION marketa.resolve_asset_reference(
  p_asset_ref TEXT
)
RETURNS TABLE (
  content_id UUID,
  title TEXT,
  description TEXT,
  app TEXT,
  content_type TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  external_url TEXT,
  modalities JSONB,
  status TEXT
) AS $$
DECLARE
  v_table_name TEXT;
  v_content_id TEXT;
BEGIN
  -- Parse asset reference format: "table_name:content_id"
  IF p_asset_ref LIKE ':%' THEN
    v_table_name := split_part(p_asset_ref, ':', 1);
    v_content_id := split_part(p_asset_ref, ':', 2);
  ELSE
    -- Legacy format - treat as direct content ID
    v_table_name := 'smart_content_qubes';
    v_content_id := p_asset_ref;
  END IF;

  -- Resolve based on table type
  CASE v_table_name
    WHEN 'smart_content_qubes' THEN
      RETURN QUERY
      SELECT 
        scq.id,
        scq.title,
        scq.description,
        scq.app,
        scq.structure_data->>'type' as content_type,
        scq.cover_image_uri as thumbnail_url,
        (scq.modalities->'watch'->'videoAssets'->0->>'duration')::INTEGER as duration_seconds,
        scq.modalities->'watch'->'videoAssets'->0->>'url' as external_url,
        scq.modalities,
        scq.status
      FROM public.smart_content_qubes scq
      WHERE scq.id = v_content_id::UUID
        AND scq.status = 'published';
    
    WHEN 'content' THEN
      RETURN QUERY
      SELECT 
        c.id,
        c.title,
        c.excerpt as description,
        c.domain as app,
        c.format as content_type,
        c.thumbnail as thumbnail_url,
        (c.modalities->'watch'->>'duration')::INTEGER as duration_seconds,
        c.modalities->'link'->>'url' as external_url,
        c.modalities,
        c.status
      FROM public.content c
      WHERE c.id = v_content_id::UUID
        AND c.status = 'published';
    
    ELSE
      -- Unsupported table type
      RETURN;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 2. CAMPAIGN ASSETS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW marketa.v_campaign_assets AS
SELECT 
  sci.campaign_id,
  sci.day_number,
  sci.title as item_title,
  sci.asset_ref,
  sci.status as item_status,
  
  -- Resolved asset information
  resolved.content_id,
  resolved.title as asset_title,
  resolved.description as asset_description,
  resolved.app as asset_app,
  resolved.content_type,
  resolved.thumbnail_url,
  resolved.duration_seconds,
  resolved.external_url,
  resolved.modalities,
  resolved.status as asset_status,
  
  -- Campaign context
  c.name as campaign_name,
  c.campaign_type,
  c.sequence_length,
  
  -- Timestamps
  sci.created_at as item_created_at
  
FROM marketa.marketa_sequence_items sci
LEFT JOIN LATERAL marketa.resolve_asset_reference(sci.asset_ref) resolved ON true
LEFT JOIN marketa.marketa_campaigns c ON c.id = sci.campaign_id
WHERE sci.status = 'ready';

-- =============================================================================
-- 3. PARTNER ASSET CATALOG FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION marketa.get_partner_asset_catalog(
  p_tenant_id TEXT DEFAULT NULL,
  p_app_filter TEXT DEFAULT NULL,
  p_content_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  content_id UUID,
  title TEXT,
  description TEXT,
  app TEXT,
  content_type TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  external_url TEXT,
  modalities JSONB,
  asset_ref TEXT,
  availability_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    scq.id,
    scq.title,
    scq.description,
    scq.app,
    scq.structure_data->>'type' as content_type,
    scq.cover_image_uri as thumbnail_url,
    (scq.modalities->'watch'->'videoAssets'->0->>'duration')::INTEGER as duration_seconds,
    scq.modalities->'watch'->'videoAssets'->0->>'url' as external_url,
    scq.modalities,
    'smart_content_qubes:' || scq.id::TEXT as asset_ref,
    CASE 
      WHEN scq.status = 'published' THEN 'available'
      ELSE 'unavailable'
    END as availability_status
  FROM public.smart_content_qubes scq
  WHERE scq.status = 'published'
    AND (p_app_filter IS NULL OR scq.app = p_app_filter)
    AND (p_content_type_filter IS NULL OR scq.structure_data->>'type' = p_content_type_filter)
  ORDER BY scq.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. ASSET USAGE ANALYTICS
-- =============================================================================

CREATE OR REPLACE FUNCTION marketa.get_asset_usage_analytics(
  p_asset_ref TEXT
)
RETURNS TABLE (
  campaign_count INTEGER,
  total_deliveries INTEGER,
  unique_tenants INTEGER,
  last_used DATE,
  performance_summary JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT sci.campaign_id)::INTEGER as campaign_count,
    COUNT(DISTINCT mdl.id)::INTEGER as total_deliveries,
    COUNT(DISTINCT sci.tenant_id)::INTEGER as unique_tenants,
    MAX(mdl.created_at)::DATE as last_used,
    jsonb_build_object(
      'avg_engagement_rate', AVG(
        CASE 
          WHEN mdl.metrics->>'opened' IS NOT NULL THEN
            (mdl.metrics->>'opened')::NUMERIC / NULLIF((mdl.metrics->>'sent')::NUMERIC, 0) * 100
          ELSE NULL
        END
      ),
      'total_clicks', SUM((mdl.metrics->>'clicked')::NUMERIC),
      'total_conversions', SUM((mdl.metrics->>'conversions')::NUMERIC)
    ) as performance_summary
  FROM marketa.marketa_sequence_items sci
  LEFT JOIN marketa.marketa_delivery_logs mdl ON mdl.asset_ref = sci.asset_ref
  WHERE sci.asset_ref = p_asset_ref
    AND sci.status = 'ready';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. SEED 21 AWAKENINGS SHARD CONTENT
-- =============================================================================

-- Insert the actual Shard articles from the URLs provided
DO $$
DECLARE
  v_shard_1_id UUID := '3d3ed160-982f-4fba-a1c6-87dd1a4da7e3';
  v_shard_21_id UUID := '21617275-cac1-48a1-a921-a7ea84fc0460';
BEGIN
  -- Insert Shard #1 if it doesn't exist
  INSERT INTO public.smart_content_qubes (
    id,
    app,
    title,
    slug,
    description,
    creator_root_did,
    tenant_id,
    modalities,
    structure_kind,
    structure_data,
    library_metadata,
    status,
    published_at
  ) VALUES (
    v_shard_1_id,
    'Qriptopian',
    'Shard #1',
    'shard-1',
    'The first shard in the awakening sequence - introducing the foundational concepts of consciousness expansion.',
    'did:iq:qriptopian:creator',
    'qriptopian',
    '{
      "watch": {
        "videoAssets": [{
          "url": "https://theqriptopian.netlify.app/article?id=3d3ed160-982f-4fba-a1c6-87dd1a4da7e3&title=Shard+%231&type=video&persona=d7b0738a-4080-4a4d-9b26-a214742c94aa&shareId=7f28023c-9ce3-4931-a041-5c445ca54a44",
          "duration": 300,
          "thumbnail": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=450&fit=crop"
        }]
      },
      "read": {
        "enabled": true,
        "textAssets": [{
          "text": "Shard #1 introduces the fundamental principles of consciousness expansion and the journey ahead.",
          "estimatedReadMinutes": 5
        }]
      }
    }',
    'article',
    '{
      "type": "video",
      "category": "awakening",
      "difficulty": "beginner",
      "tags": ["consciousness", "awakening", "foundation"]
    }',
    '{
      "category": "21knowdz",
      "tags": ["creative"],
      "recommendedShelf": "Recent",
      "featured": true,
      "sortPriority": 1
    }',
    'published',
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Insert Shard #21 if it doesn't exist
  INSERT INTO public.smart_content_qubes (
    id,
    app,
    title,
    slug,
    description,
    creator_root_did,
    tenant_id,
    modalities,
    structure_kind,
    structure_data,
    library_metadata,
    status,
    published_at
  ) VALUES (
    v_shard_21_id,
    'Qriptopian',
    'Shard #21',
    'shard-21',
    'The final shard in the awakening sequence - integration and mastery of expanded consciousness.',
    'did:iq:qriptopian:creator',
    'qriptopian',
    '{
      "watch": {
        "videoAssets": [{
          "url": "https://theqriptopian.netlify.app/article?id=21617275-cac1-48a1-a921-a7ea84fc0460&title=Shard+%2321&type=video&persona=d7b0738a-4080-4a4d-9b26-a214742c94aa&shareId=7f28023c-9ce3-4931-a041-5c445ca54a44",
          "duration": 420,
          "thumbnail": "https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=800&h=450&fit=crop"
        }]
      },
      "read": {
        "enabled": true,
        "textAssets": [{
          "text": "Shard #21 completes the awakening journey with integration practices and mastery techniques.",
          "estimatedReadMinutes": 7
        }]
      }
    }',
    'article',
    '{
      "type": "video",
      "category": "awakening",
      "difficulty": "advanced",
      "tags": ["consciousness", "integration", "mastery"]
    }',
    '{
      "category": "21knowdz",
      "tags": ["creative"],
      "recommendedShelf": "Recent",
      "featured": true,
      "sortPriority": 21
    }',
    'published',
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Update the 21 Awakenings sequence to use these actual asset references
  UPDATE marketa.marketa_sequence_items 
  SET asset_ref = 'smart_content_qubes:' || id::TEXT
  WHERE campaign_id = '21-awakenings-campaign'
    AND asset_ref LIKE 'asset-ref-%';
    
  -- Add the specific shard references
  INSERT INTO marketa.marketa_sequence_items (
    campaign_id,
    day_number,
    title,
    description,
    asset_ref,
    copy_variants,
    cta_url,
    explainer,
    thumbnail_url,
    duration_seconds,
    tags,
    status
  ) VALUES 
    ('21-awakenings-campaign', 1, 'Shard #1: Foundation', 'Begin your awakening journey with the foundational principles of consciousness expansion.', 'smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3', '{}', 'https://theqriptopian.netlify.app/article?id=3d3ed160-982f-4fba-a1c6-87dd1a4da7e3&title=Shard+%231&type=video&persona=d7b0738a-4080-4a4d-9b26-a214742c94aa&shareId=7f28023c-9ce3-4931-a041-5c445ca54a44&utm_source=marketa&utm_medium=email&utm_campaign=21-awakenings', true, 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=450&fit=crop', 300, ARRAY['consciousness', 'awakening', 'foundation'], 'ready'),
    ('21-awakenings-campaign', 21, 'Shard #21: Mastery', 'Complete your awakening journey with integration practices and mastery techniques.', 'smart_content_qubes:21617275-cac1-48a1-a921-a7ea84fc0460', '{}', 'https://theqriptopian.netlify.app/article?id=21617275-cac1-48a1-a921-a7ea84fc0460&title=Shard+%2321&type=video&persona=d7b0738a-4080-4a4d-9b26-a214742c94aa&shareId=7f28023c-9ce3-4931-a041-5c445ca54a44&utm_source=marketa&utm_medium=email&utm_campaign=21-awakenings', true, 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=800&h=450&fit=crop', 420, ARRAY['consciousness', 'integration', 'mastery'], 'ready')
  ON CONFLICT (campaign_id, day_number) DO UPDATE SET
    asset_ref = EXCLUDED.asset_ref,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    cta_url = EXCLUDED.cta_url,
    thumbnail_url = EXCLUDED.thumbnail_url,
    duration_seconds = EXCLUDED.duration_seconds,
    updated_at = NOW();

END;
$$;

-- =============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_smart_content_qubes_app_status 
ON public.smart_content_qubes(app, status) 
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_smart_content_qubes_type 
ON public.smart_content_qubes USING GIN((structure_data->'type')) 
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_sequence_items_asset_ref 
ON marketa.marketa_sequence_items(asset_ref) 
WHERE status = 'ready';

-- =============================================================================
-- 7. RLS POLICIES FOR PARTNER ACCESS
-- =============================================================================

-- Partners can read published content for campaign creation
CREATE POLICY "Partners can read published content" ON public.smart_content_qubes
  FOR SELECT
  TO authenticated
  USING (status = 'published');

-- Note: v_campaign_assets is a view, so RLS is handled by the underlying tables
-- Access control is managed through the marketa_sequence_items and smart_content_qubes policies

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
