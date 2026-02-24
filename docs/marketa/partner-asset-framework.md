# AgentiQ Marketa - Partner Asset Framework

## Overview

The Partner Asset Framework enables partners to discover, reference, and use QubeBase content (like the Qriptopian Shard articles) in their marketing campaigns. This system provides a unified way to access and manage content assets across the AgentiQ ecosystem.

## Architecture

### **Core Components**

1. **QubeBase Tables** - Storage for all content assets
2. **Asset Reference System** - Standardized format for referencing content
3. **Resolution Engine** - Converts references to actual content
4. **Partner Catalog API** - Content discovery and browsing
5. **Usage Analytics** - Performance tracking and insights

---

## 📊 **Database Schema**

### **Primary Content Table: `smart_content_qubes`**

```sql
CREATE TABLE smart_content_qubes (
  id UUID PRIMARY KEY,
  app TEXT NOT NULL,                    -- 'Qriptopian', 'metaKnyts', etc.
  title VARCHAR(500) NOT NULL,          -- 'Shard #1', 'Shard #21'
  slug VARCHAR(500) NOT NULL,           -- URL-friendly identifier
  description TEXT,                     -- Content description
  cover_image_uri TEXT,                 -- Thumbnail URL
  
  -- Content modalities (how content can be consumed)
  modalities JSONB DEFAULT '{}',        -- { read, watch, listen, link, view }
  
  -- Content structure
  structure JSONB DEFAULT '{}',         -- { type, category, difficulty, tags }
  
  -- Ownership
  creator_root_did VARCHAR(255),
  tenant_id VARCHAR(100),
  
  -- Status
  status VARCHAR(50) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Asset Reference Format**

Assets are referenced using the format: `[table_name]:[content_id]`

**Examples:**
```sql
-- Qriptopian Shard articles
'smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3'  -- Shard #1
'smart_content_qubes:21617275-cac1-48a1-a921-a7ea84fc0460' -- Shard #21

-- Legacy content (if applicable)
'content:article-uuid'
```

---

## 🔧 **API Endpoints**

### **Asset Catalog API**

#### **GET /api/marketa/admin/assets?action=catalog**

Retrieve available content assets for partner campaigns.

**Query Parameters:**
- `app_filter` - Filter by app (Qriptopian, metaKnyts, etc.)
- `content_type_filter` - Filter by content type (video, article, audio)
- `limit` - Number of results (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "assets": [
      {
        "content_id": "3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
        "title": "Shard #1",
        "description": "The first shard in the awakening sequence...",
        "app": "Qriptopian",
        "content_type": "video",
        "thumbnail_url": "https://images.unsplash.com/photo-...",
        "duration_seconds": 300,
        "external_url": "https://theqriptopian.netlify.app/article?id=...",
        "modalities": {
          "watch": { "video_url": "...", "duration": "300" },
          "read": { "text": "...", "duration": "5 min read" }
        },
        "asset_ref": "smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
        "availability_status": "available"
      }
    ],
    "pagination": {
      "total": 21,
      "limit": 50,
      "offset": 0,
      "has_more": false
    }
  }
}
```

#### **GET /api/marketa/admin/assets?action=resolve&asset_ref=smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3**

Resolve an asset reference to get detailed content information.

**Response:**
```json
{
  "success": true,
  "data": {
    "asset_ref": "smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
    "content_id": "3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
    "title": "Shard #1",
    "description": "The first shard in the awakening sequence...",
    "app": "Qriptopian",
    "content_type": "video",
    "thumbnail_url": "https://images.unsplash.com/photo-...",
    "duration_seconds": 300,
    "external_url": "https://theqriptopian.netlify.app/article?id=...",
    "modalities": { ... },
    "status": "published",
    "availability": "available"
  }
}
```

#### **GET /api/marketa/admin/assets?action=analytics&asset_ref=smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3**

Get usage analytics and performance insights for an asset.

**Response:**
```json
{
  "success": true,
  "data": {
    "asset_ref": "smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
    "analytics": {
      "campaign_count": 5,
      "total_deliveries": 1250,
      "unique_tenants": 3,
      "last_used": "2025-01-15",
      "performance_summary": {
        "avg_engagement_rate": 67.5,
        "total_clicks": 845,
        "total_conversions": 127
      }
    },
    "insights": [
      {
        "type": "performance",
        "message": "High engagement rate (67.5%)",
        "recommendation": "This content performs well - consider using it in more campaigns"
      }
    ]
  }
}
```

### **Asset Management API**

#### **POST /api/marketa/admin/assets**

Validate and import assets into campaigns.

**Request Body:**
```json
{
  "action": "validate_asset_refs",
  "asset_refs": [
    "smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
    "smart_content_qubes:21617275-cac1-48a1-a921-a7ea84fc0460"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "validation_results": [
      {
        "asset_ref": "smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3",
        "valid": true,
        "asset": { ... },
        "error": null
      }
    ],
    "summary": {
      "total": 2,
      "valid": 2,
      "invalid": 0
    }
  }
}
```

---

## 🎯 **Campaign Integration**

### **Using Assets in Sequence Campaigns**

When creating a sequence campaign (like 21 Awakenings), reference assets in the `marketa_sequence_items` table:

```sql
INSERT INTO marketa_sequence_items (
  campaign_id,
  day_number,
  title,
  description,
  asset_ref,
  cta_url,
  explainer,
  thumbnail_url,
  duration_seconds,
  tags,
  status
) VALUES (
  '21-awakenings-campaign',
  1,
  'Shard #1: Foundation',
  'Begin your awakening journey with foundational principles.',
  'smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3',
  'https://theqriptopian.netlify.app/article?id=3d3ed160-982f-4fba-a1c6-87dd1a4da7e3&utm_source=marketa&utm_medium=email&utm_campaign=21-awakenings',
  true,
  'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=450&fit=crop',
  300,
  ARRAY['consciousness', 'awakening', 'foundation'],
  'ready'
);
```

### **Asset Resolution in Sequence Dispatch**

The sequence dispatch system automatically resolves asset references:

```typescript
// In the dispatch system
const assetRef = sequenceItem.asset_ref;
const resolvedAsset = await resolveAssetReference(assetRef);

// Use in email/webhook payload
const payload = {
  title: sequenceItem.title,
  video_url: resolvedAsset.modalities?.watch?.video_url,
  thumbnail_url: resolvedAsset.thumbnail_url,
  duration: resolvedAsset.duration_seconds,
  cta_url: `${sequenceItem.cta_url}&utm_content=day-${dayNumber}`,
  // ... other fields
};
```

---

## 📈 **21 Awakenings Campaign Example**

### **Campaign Setup**

```sql
-- Create the campaign
INSERT INTO marketa_campaigns (
  id,
  tenant_id,
  name,
  description,
  campaign_type,
  sequence_length,
  status
) VALUES (
  '21-awakenings-campaign',
  'agq-tenant',
  '21 Awakenings',
  'A 21-day journey of consciousness expansion',
  'sequence',
  21,
  'active'
);

-- Add sequence items with real shard references
INSERT INTO marketa_sequence_items (campaign_id, day_number, title, asset_ref, ...)
VALUES 
  ('21-awakenings-campaign', 1, 'Shard #1: Foundation', 'smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3', ...),
  ('21-awakenings-campaign', 2, 'Shard #2: Awareness', 'smart_content_qubes:shard-2-id', ...),
  -- ... continue for all 21 days
  ('21-awakenings-campaign', 21, 'Shard #21: Mastery', 'smart_content_qubes:21617275-cac1-48a1-a921-a7ea84fc0460', ...);
```

### **Partner Join Flow**

1. **Discovery**: Partner browses asset catalog
2. **Selection**: Partner selects 21 Awakenings campaign
3. **Configuration**: Partner sets delivery schedule and channels
4. **Activation**: System automatically resolves shard references for daily delivery

### **Daily Dispatch Example**

```typescript
// Day 1 dispatch payload
{
  "campaign_id": "21-awakenings-campaign",
  "day_number": 1,
  "title": "Shard #1: Foundation",
  "content": {
    "video_url": "https://theqriptopian.netlify.app/article?id=3d3ed160-982f-4fba-a1c6-87dd1a4da7e3&title=Shard+%231&type=video&persona=d7b0738a-4080-4a4d-9b26-a214742c94aa&shareId=7f28023c-9ce3-4931-a041-5c445ca54a44",
    "thumbnail_url": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=450&fit=crop",
    "duration_seconds": 300,
    "description": "Begin your awakening journey with foundational principles..."
  },
  "cta_url": "https://theqriptopian.netlify.app/article?id=3d3ed160-982f-4fba-a1c6-87dd1a4da7e3&utm_source=marketa&utm_medium=email&utm_campaign=21-awakenings&utm_content=day-1",
  "utm_parameters": {
    "utm_source": "marketa",
    "utm_medium": "email",
    "utm_campaign": "21-awakenings",
    "utm_content": "day-1"
  }
}
```

---

## 🔍 **Asset Discovery & Browsing**

### **Partner Asset Browser Interface**

Create a user-friendly interface for partners to browse and select assets:

```typescript
// React component for asset browsing
const AssetBrowser = () => {
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState({
    app: null,
    content_type: null,
    search: ''
  });

  const loadAssets = async () => {
    const params = new URLSearchParams({
      action: 'catalog',
      app_filter: filters.app,
      content_type_filter: filters.content_type,
      limit: '20'
    });

    const response = await fetch(`/api/marketa/admin/assets?${params}`);
    const data = await response.json();
    setAssets(data.data.assets);
  };

  return (
    <div>
      {/* Filter controls */}
      <AssetFilters filters={filters} onChange={setFilters} />
      
      {/* Asset grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map(asset => (
          <AssetCard 
            key={asset.asset_ref} 
            asset={asset}
            onSelect={() => selectAsset(asset)}
          />
        ))}
      </div>
    </div>
  );
};
```

### **Asset Card Component**

```typescript
const AssetCard = ({ asset, onSelect }) => (
  <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
    <img 
      src={asset.thumbnail_url} 
      alt={asset.title}
      className="w-full h-32 object-cover rounded mb-3"
    />
    
    <h3 className="font-semibold text-lg mb-2">{asset.title}</h3>
    <p className="text-gray-600 text-sm mb-3">{asset.description}</p>
    
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
        {asset.app}
      </span>
      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
        {asset.content_type}
      </span>
    </div>
    
    {asset.duration_seconds && (
      <p className="text-xs text-gray-500 mb-3">
        Duration: {Math.floor(asset.duration_seconds / 60)} minutes
      </p>
    )}
    
    <button 
      onClick={onSelect}
      className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
    >
      Select Asset
    </button>
  </div>
);
```

---

## 📊 **Performance Tracking**

### **Asset Performance Metrics**

Track how assets perform across campaigns:

```sql
-- View asset performance across all campaigns
SELECT 
  sci.asset_ref,
  resolved.title as asset_title,
  resolved.app,
  COUNT(DISTINCT sci.campaign_id) as campaign_count,
  COUNT(DISTINCT mdl.id) as total_deliveries,
  COUNT(DISTINCT sci.tenant_id) as unique_tenants,
  AVG(
    CASE 
      WHEN mdl.metrics->>'opened' IS NOT NULL THEN
        (mdl.metrics->>'opened')::NUMERIC / NULLIF((mdl.metrics->>'sent')::NUMERIC, 0) * 100
    END
  ) as avg_engagement_rate
FROM marketa_sequence_items sci
LEFT JOIN LATERAL resolve_asset_reference(sci.asset_ref) resolved ON true
LEFT JOIN marketa_delivery_logs mdl ON mdl.asset_ref = sci.asset_ref
WHERE sci.status = 'ready'
GROUP BY sci.asset_ref, resolved.title, resolved.app
ORDER BY total_deliveries DESC;
```

### **Popular Assets Dashboard**

```typescript
const PopularAssetsDashboard = () => {
  const [topAssets, setTopAssets] = useState([]);

  useEffect(() => {
    const loadTopAssets = async () => {
      const response = await fetch('/api/marketa/admin/assets?action=analytics');
      const data = await response.json();
      setTopAssets(data.data.assets.filter(a => a.analytics.total_deliveries > 0));
    };
    
    loadTopAssets();
  }, []);

  return (
    <div>
      <h2>Top Performing Assets</h2>
      {topAssets.map(asset => (
        <div key={asset.asset_ref}>
          <h3>{asset.title}</h3>
          <p>{asset.analytics.total_deliveries} deliveries</p>
          <p>{asset.analytics.unique_tenants} partners using</p>
        </div>
      ))}
    </div>
  );
};
```

---

## 🛠️ **Implementation Guide**

### **1. Database Setup**

```bash
# Run the asset reference migration
supabase db push
```

### **2. Asset Import**

```bash
# Import the 21 Awakenings shard content
psql $DATABASE_URL -f supabase/migrations/20250117_asset_reference_functions.sql
```

### **3. API Testing**

```bash
# Test asset catalog
curl -H "x-persona-id: admin" \
     -H "x-tenant-id: agq-tenant" \
     "http://localhost:3000/api/marketa/admin/assets?action=catalog&app_filter=Qriptopian"

# Test asset resolution
curl -H "x-persona-id: admin" \
     -H "x-tenant-id: agq-tenant" \
     "http://localhost:3000/api/marketa/admin/assets?action=resolve&asset_ref=smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3"
```

### **4. Frontend Integration**

```typescript
// Add asset browser to partner admin interface
import { AssetBrowser } from '@/components/AssetBrowser';

// Use in campaign creation flow
const CampaignBuilder = () => {
  const [selectedAssets, setSelectedAssets] = useState([]);

  return (
    <div>
      <AssetBrowser 
        onAssetSelect={(asset) => setSelectedAssets([...selectedAssets, asset])}
      />
      <CampaignPreview assets={selectedAssets} />
    </div>
  );
};
```

---

## 🎯 **Best Practices**

### **Asset Reference Guidelines**

1. **Use Full References**: Always include table name (`smart_content_qubes:uuid`)
2. **Validate References**: Check assets exist before using in campaigns
3. **Monitor Status**: Only use `published` assets in live campaigns
4. **Track Performance**: Use analytics to optimize asset selection

### **Campaign Design**

1. **Content Variety**: Mix different content types (video, articles, audio)
2. **Progressive Difficulty**: Start with beginner content, advance to complex
3. **Engagement Hooks**: Use compelling thumbnails and titles
4. **Clear CTAs**: Include specific calls-to-action with UTM parameters

### **Performance Optimization**

1. **Thumbnail Optimization**: Use compressed images for fast loading
2. **Video Hosting**: Use CDN for video content delivery
3. **Caching**: Cache asset metadata to reduce database queries
4. **Analytics**: Track engagement to optimize future campaigns

---

## 🔧 **Troubleshooting**

### **Common Issues**

**Asset Not Found**
- Check if the asset reference format is correct
- Verify the asset exists and is published
- Check database connectivity

**Performance Issues**
- Optimize database queries with proper indexing
- Implement caching for frequently accessed assets
- Use CDN for media content delivery

**Permission Errors**
- Verify RLS policies are correctly configured
- Check tenant context is properly set
- Ensure persona has appropriate access

### **Debug Queries**

```sql
-- Check if specific asset exists
SELECT * FROM smart_content_qubes 
WHERE id = '3d3ed160-982f-4fba-a1c6-87dd1a4da7e3';

-- Test asset resolution
SELECT * FROM resolve_asset_reference('smart_content_qubes:3d3ed160-982f-4fba-a1c6-87dd1a4da7e3');

-- Check campaign assets
SELECT * FROM v_campaign_assets 
WHERE campaign_id = '21-awakenings-campaign'
ORDER BY day_number;
```

---

## 📈 **Future Enhancements**

### **Planned Features**

1. **Smart Recommendations**: AI-powered asset suggestions based on campaign goals
2. **Asset Versioning**: Support for multiple versions of the same content
3. **Dynamic Content**: Personalized content based on recipient preferences
4. **Cross-Platform Assets**: Support for TikTok, Instagram, and other platforms
5. **Asset Marketplace**: Partner-to-partner content sharing

### **Scalability Considerations**

1. **Content Delivery Network**: Global CDN for media content
2. **Database Sharding**: Multi-region database replication
3. **Caching Layer**: Redis for frequently accessed asset metadata
4. **Analytics Pipeline**: Real-time processing of engagement data

---

## 📞 **Support**

For questions about the Partner Asset Framework:

1. **Documentation**: Refer to this guide and API documentation
2. **Database Schema**: See migration files for detailed schema
3. **API Reference**: Check `/api/marketa/admin/assets` endpoints
4. **Testing**: Use the provided test scripts and examples

The Partner Asset Framework provides a robust foundation for partners to create compelling, content-rich marketing campaigns using the full power of the AgentiQ QubeBase ecosystem.
