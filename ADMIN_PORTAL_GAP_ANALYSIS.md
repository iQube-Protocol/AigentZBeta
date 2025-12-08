# Admin Portal Gap Analysis

**Last Updated:** December 7, 2025

## Current Status Summary

### ✅ **Working**

- Admin portal imported from Lovable
- Routes configured correctly
- Development mode authentication bypass
- Content managers for all sections
- Content service CRUD operations (RLS-resilient)
- Dashboard navigation
- QubeBase connection
- **Publish/Unpublish** (fixed - RLS workaround)
- **Content Editor** (all modalities, placement, domain mapping)
- **Image positioning UI** (scale, X, Y sliders with live preview)
- **Bulk Content Importer** (validation, preview, duplicate detection)
- **Auto read duration calculation**
- **Section-to-domain mapping** (home-hero → home, etc.)

### ⚠️ **Partially Working**

- Media upload (works but depends on Supabase Storage bucket config)

### ❌ **Not Implemented (Phase 2)**

## Critical Gaps to Fix

### 1. **Database Permissions (RLS Policies)**
**Issue**: Row Level Security blocking reads after updates
**Impact**: Can't publish/unpublish, update operations fail
**Fix Required**:
```sql
-- Add to Supabase SQL Editor
-- Allow anonymous SELECT for published content
CREATE POLICY "Allow public read published content"
  ON content FOR SELECT
  USING (status = 'published');

-- Allow authenticated users to update content
CREATE POLICY "Allow authenticated update"
  ON content FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert content  
CREATE POLICY "Allow authenticated insert"
  ON content FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

### 2. **Image Upload Functionality**
**Status**: Not implemented
**Required**:
- Supabase Storage bucket configuration
- Upload UI in ContentEditor
- File handling logic
- Progress indicators
**Files to Update**:
- `ContentEditor.tsx` - Add upload button and logic
- Create `useFileUpload.tsx` hook

### 3. **Content Editor - Full Validation**
**Items to Test**:
- [ ] Title/excerpt editing
- [ ] Thumbnail URL input
- [ ] Display position slider
- [ ] Image positioning (scale, X, Y)
- [ ] Read modality (text editor, auto-duration)
- [ ] Watch modality (video URL, duration, thumbnail)
- [ ] Listen modality (audio URL, duration, cover)
- [ ] Link modality (URL, allow_embed)
- [ ] Save/publish workflow
- [ ] Preview functionality

### 4. **Bulk Content Importer**
**Status**: Component exists but needs verification
**Required**:
- JSON validation
- Preview before import
- Duplicate detection (already in script)
- Progress feedback
- Error handling

### 5. **Missing UI Components**
**Needed**:
- Rich text editor for Read modality
- Media preview components
- Drag-and-drop position reordering
- Live preview panel

## JSON Spec Compliance Check

### Required Fields (from spec):
```json
{
  "id": "string (UUID)",
  "title": "string",
  "excerpt": "string",
  "thumbnail": "string (URL)",
  "domain": "home|pennydrops|scrolls|kn0wdz|signals|staybull",
  "placement": {
    "section": "string",
    "tab": "string (optional)",
    "position": "number",
    "imageScale": "number (default 100)",
    "imageX": "number (default 50)",
    "imageY": "number (default 50)",
    "imagePosition": "string (default center)"
  },
  "modalities": {
    "read": {
      "text": "string (markdown)",
      "duration": "string (auto-calculated)"
    },
    "watch": {
      "video_url": "string",
      "duration": "string",
      "thumbnail": "string (optional)"
    },
    "listen": {
      "audio_url": "string",
      "duration": "string",
      "cover_image": "string (optional)"
    },
    "link": {
      "url": "string",
      "allow_embed": "boolean (default false)"
    }
  },
  "tags": "string[]",
  "format": "article|resource|story",
  "type": "article|guide|tutorial",
  "status": "draft|published",
  "issue_ref": "string",
  "author_id": "UUID",
  "author_type": "agent|human"
}
```

### Current Database Schema - Verification Needed
- [ ] All fields mapped correctly
- [ ] JSONB fields (placement, modalities) properly structured
- [ ] Indexes on commonly queried fields
- [ ] Foreign key constraints on author_id

## Priority Action Items

### **P0 - Critical (Blocking Usage)**
1. ✅ Fix publish/unpublish RLS issue (in progress)
2. Add RLS policies for authenticated operations
3. Verify ContentEditor save functionality

### **P1 - High (Needed Soon)**
4. Implement image upload to Supabase Storage
5. Add rich text editor for Read modality
6. Test bulk importer end-to-end
7. Add modality preview components

### **P2 - Medium (Nice to Have)**
8. Drag-and-drop position reordering
9. Content duplication feature
10. Batch operations (multi-select)
11. Content search/filter in managers

### **P3 - Low (Future Enhancement)**
12. Content versioning
13. Scheduled publishing
14. Content analytics
15. Collaborative editing

## Recommended Next Steps

1. **Immediate**: Test the RLS fix for publish/unpublish
2. **Short-term**: Add basic RLS policies for development
3. **Medium-term**: Implement image upload
4. **Long-term**: Full feature parity with Lovable version

## Notes

- Development bypass is active (auth skipped in dev mode)
- Production deployment will need proper authentication
- Some features may work in Lovable but not yet ported
- QubeBase is source of truth for all content
