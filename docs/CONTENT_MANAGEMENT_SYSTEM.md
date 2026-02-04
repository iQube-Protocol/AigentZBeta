# Content Management System Documentation

## Overview
This document describes the content management system implemented in the AigentZ platform, designed for use across multiple applications including the Qriptopian Codex in the AigentiQ platform.

## Architecture

### Database Schema
Content is stored in Supabase with the following structure:

```typescript
interface Content {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  thumbnail?: string;
  status: 'draft' | 'published' | 'archived';
  domain: string;  // e.g., 'qriptopian', 'aigentz'
  type: string;    // e.g., 'article', 'tutorial', 'resource'
  format: 'article' | 'comic' | 'video' | 'audio' | 'interactive' | 'mixed';
  placement: {
    section: string;  // e.g., '21knowdz', 'pennydrops'
    tab?: string;     // e.g., 'dev', 'creative', 'exec'
    position?: number;
  };
  modalities: {
    read?: { available: boolean; text?: string; duration?: string; };
    watch?: { available: boolean; url?: string; duration?: string; };
    listen?: { available: boolean; url?: string; duration?: string; };
    link?: { available: boolean; url?: string; allow_embed?: boolean; };
    view?: { available: boolean; url?: string; };
  };
  tags: string[];
  created_at: string;
  updated_at: string;
}
```

### Row Level Security (RLS) Policies

**Published Content (Public Access):**
```sql
CREATE POLICY "Published content is viewable by everyone"
  ON public.content
  FOR SELECT
  USING (status = 'published');
```

**Draft Content (Authenticated Users):**
```sql
CREATE POLICY "Authenticated users can view all content"
  ON public.content
  FOR SELECT
  TO authenticated
  USING (true);
```

**Content Management (Authenticated Users):**
- Users can create, update, and delete their own content
- Service role has full access to all content

## Content Service API

### Location
`apps/theqriptopian-web/src/services/contentService.ts`

### Key Functions

#### Get All Content (Admin)
```typescript
contentService.getAllContentBySection(
  section: ContentSection,
  options?: { tab?: string }
): Promise<Content[]>
```
Returns all content (published and draft) for admin portal use.

#### Get Published Content (Public)
```typescript
contentService.getContentBySection(
  section: ContentSection,
  options?: { tab?: string }
): Promise<Content[]>
```
Returns only published content for public site display.

#### Create Content
```typescript
contentService.createContent(content: Partial<Content>): Promise<Content>
```

#### Update Content
```typescript
contentService.updateContent(id: string, updates: Partial<Content>): Promise<Content>
```

#### Delete Content
```typescript
contentService.deleteContent(id: string): Promise<void>
```

## Tab Naming Convention

**Important:** Use shortened tab names consistently:
- `'dev'` (not 'developer')
- `'creative'`
- `'exec'` (not 'executive')

This ensures content syncs properly between admin portal and public site.

## Content Display Components

### Liquid UI Content Hook
```typescript
import { useLiquidUIContent } from '@/hooks/useLiquidUIContent';

const { content } = useLiquidUIContent(section: string, tab?: string);
```

### Smart Content Viewer
```typescript
import { SmartContentViewer } from '@/components/content/SmartContentViewer';

<SmartContentViewer
  items={contentItems}
  domain="section-name"
  initialIndex={0}
  onFullscreenChange={(isFullscreen) => {}}
/>
```

### Smart Content Actions
```typescript
import { SmartContentActions } from '@/components/content/SmartContentActions';

<SmartContentActions
  modalities={item.modalities}
  context="card" | "thumbnail"
  showExpand={boolean}
  showShare={boolean}
  size="sm" | "md" | "lg"
  onAction={(action) => {}}
/>
```

## Admin Portal

### Location
`apps/theqriptopian-web/src/pages/admin/content/`

### Components
- **KnowdZManager.tsx** - Manages 21knowdz section content
- **ContentEditor.tsx** - Content creation and editing interface

### Features
- View all content (published and draft)
- Create new articles and resources
- Edit existing content
- Toggle publish/unpublish status
- Delete content
- Filter by tab and type

### Publishing Workflow
1. Create content in admin portal (status: 'draft')
2. Draft content visible in admin portal only
3. Click "Publish" to change status to 'published'
4. Published content appears on public site
5. Click "Unpublish" to revert to draft (content remains in admin portal)

## API Endpoints

### Get Content by Section
```
GET /api/content/section/[section]?tab=[tab]
```
Returns published content only (for public site).

### Get Content by Section (Admin)
Use `contentService.getAllContentBySection()` in authenticated context.

## Migration Files

### Content Table Schema
`apps/theqriptopian-web/supabase/migrations/20251120050450_dce2fd8e-4adf-4dc8-bf85-9b76163e8d36.sql`

### RLS Policy Fix for Drafts
`supabase/migrations/20260101_fix_content_rls_for_drafts.sql`

### Tab Name Alignment
Script: `scripts/fix-imported-tab-names.ts`

## Implementation for Qriptopian Codex

### Required Files
Copy these files to your Next.js app:

1. **Service Layer:**
   - `src/services/contentService.ts`

2. **Hooks:**
   - `src/hooks/useLiquidUIContent.ts`

3. **Components:**
   - `src/components/content/SmartContentViewer.tsx`
   - `src/components/content/SmartContentActions.tsx`
   - `src/contexts/SmartContentActionContext.tsx`

4. **Admin Components:**
   - `src/pages/admin/content/KnowdZManager.tsx`
   - `src/pages/admin/content/ContentEditor.tsx`

5. **Drawer Components (Examples):**
   - `src/components/navigation/drawers/Kn0wdZDrawer.tsx`
   - `src/components/navigation/drawers/PennyDropsDrawer.tsx`

### Database Setup
1. Run the content table migration
2. Apply RLS policies
3. Ensure Supabase credentials are configured

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Best Practices

1. **Always use shortened tab names** ('dev', 'creative', 'exec')
2. **Filter by status** - Use `getAllContentBySection()` for admin, `getContentBySection()` for public
3. **Set required fields** - domain, type, format must be set on all content
4. **Use modalities** - Define available content modalities (read, watch, listen, etc.)
5. **Position content** - Use placement.position for custom ordering
6. **Draft workflow** - Create as draft, review, then publish

## Troubleshooting

### Draft articles disappear after unpublishing
- Ensure RLS policy for authenticated users is applied
- Run migration: `20260101_fix_content_rls_for_drafts.sql`

### Content not syncing between admin and site
- Check tab names match ('dev' vs 'developer')
- Verify status is 'published' for public content
- Check placement.section and placement.tab values

### Content not displaying
- Verify required fields: domain, type, format
- Check RLS policies are applied
- Ensure content status is 'published' for public display

## Example Usage

### Creating Content
```typescript
const newArticle = await contentService.createContent({
  title: 'Getting Started',
  slug: 'getting-started',
  excerpt: 'Learn the basics',
  domain: 'qriptopian',
  type: 'tutorial',
  format: 'article',
  status: 'draft',
  placement: {
    section: '21knowdz',
    tab: 'dev',
    position: 1
  },
  modalities: {
    read: {
      available: true,
      text: '# Content here',
      duration: '5 min read'
    }
  },
  tags: ['tutorial', 'beginner']
});
```

### Fetching Content
```typescript
// Public site - published only
const publicContent = await contentService.getContentBySection('21knowdz', { tab: 'dev' });

// Admin portal - all content
const allContent = await contentService.getAllContentBySection('21knowdz', { tab: 'dev' });
```

### Using in Components
```typescript
function MyDrawer() {
  const { content } = useLiquidUIContent('21knowdz', 'dev');
  
  return (
    <SmartContentViewer
      items={content}
      domain="21knowdz"
      initialIndex={0}
    />
  );
}
```

## Support

For questions or issues with the content management system:
1. Check this documentation
2. Review migration files in `supabase/migrations/`
3. Examine example implementations in drawer components
4. Verify RLS policies in Supabase Dashboard
