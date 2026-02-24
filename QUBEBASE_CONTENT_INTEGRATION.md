# QubeBase Content Integration

**Date**: December 7, 2025  
**Status**: ✅ CONNECTED - Data fetched, needs domain organization  
**Content Items**: 47 articles from QubeBase

---

## What Was Accomplished ✅

### 1. QubeBase Connection Established

**Script Created**: `scripts/fetch-qubebase-content.ts`
- Connects to QubeBase (Supabase)
- Fetches all published content
- Generates CodexQube-compliant structure
- Outputs to `apps/theqriptopian-web/src/data/issue-0.ts`

**Connection Details**:
```
URL: https://bsjhfvctmduxhohtllly.supabase.co
Table: content
Status: ✅ Connected and fetching
```

### 2. Live Data Integrated

**Before**: Dummy data (placeholders)  
**After**: 47 real articles from QubeBase  

**Command to Update**:
```bash
pnpm tsx scripts/fetch-qubebase-content.ts
```

---

## Current Issue: Domain Organization ⚠️

### Problem

All 47 content items are tagged with domain: `"qriptopian"` instead of being distributed across:
- `pennydrops` (Q¢ use cases)
- `scrolls` (Chronicles)
- `kn0wdz` (Technical knowledge)
- `signals` (Market insights - hidden)

### Root Cause

The content in QubeBase likely needs proper domain tagging. The `content` table has a `domain` column but all items appear to have the same value.

### Solution Options

**Option A: Fix in QubeBase (Recommended)**

Update the domain field in the QubeBase `content` table:

```sql
-- Example: Update specific articles to proper domains
UPDATE content 
SET domain = 'pennydrops' 
WHERE title LIKE '%Q¢%' OR tags @> ARRAY['qriptocent'];

UPDATE content 
SET domain = 'scrolls' 
WHERE type = 'narrative' OR tags @> ARRAY['chronicle'];

UPDATE content 
SET domain = 'kn0wdz' 
WHERE type = 'technical' OR tags @> ARRAY['dev', 'knowledge'];

-- Then re-fetch
```

**Option B: Add Domain Mapping Logic**

Update `fetch-qubebase-content.ts` to intelligently map content to domains based on:
- Title keywords
- Tags
- Content type
- Author type

**Option C: Admin Portal**

Build the admin portal (next section) to allow editors to assign domains via UI.

---

## Missing Component: Admin Portal 🔧

### What's Needed

The Lovable deployment likely has an admin interface for content management. The monorepo needs equivalent functionality.

### Admin Portal Requirements

**Core Features**:
1. **Content CRUD**
   - Create, edit, delete articles
   - Rich markdown editor
   - Media upload (images, videos)
   - Tags and metadata management
   
2. **Domain Management**
   - Assign articles to domains
   - Reorder sections within domains
   - Set visibility (published/hidden)
   
3. **Issue Management**
   - Create new issues
   - Archive old issues
   - Set publication dates
   
4. **Preview & Publish**
   - Preview before publish
   - Schedule publishing
   - Version history

5. **User Management**
   - Editor roles
   - Author assignments
   - Permissions

### Architecture

```
apps/
├── theqriptopian-web/      # Public-facing site (exists)
└── theqriptopian-admin/    # Admin portal (NEEDED)
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   ├── ContentEditor.tsx
    │   │   ├── DomainManager.tsx
    │   │   └── IssueManager.tsx
    │   ├── components/
    │   │   ├── RichEditor.tsx
    │   │   ├── MediaUploader.tsx
    │   │   └── ContentList.tsx
    │   └── lib/
    │       └── qubebase-admin.ts  # Admin API calls
    └── package.json
```

### Integration Points

1. **Supabase Connection**: Reuse credentials from fetch script
2. **Auth**: Supabase Auth for admin access
3. **Storage**: Supabase Storage for media uploads
4. **RLS Policies**: Row-level security for content access

---

## Immediate Next Steps

### 1. Analyze Content Domain Distribution

Check what domains actually exist in QubeBase:

```bash
# Run this query in Supabase SQL Editor
SELECT domain, COUNT(*) as count 
FROM content 
WHERE status = 'published' 
GROUP BY domain 
ORDER BY count DESC;
```

### 2. Update Content Domains

Either:
- **Manual SQL**: Update domains directly in QubeBase
- **Script**: Create a migration script
- **Admin UI**: Build admin portal for ongoing management

### 3. Re-fetch After Domains Fixed

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta
pnpm tsx scripts/fetch-qubebase-content.ts
```

### 4. Verify in App

```bash
cd apps/theqriptopian-web
pnpm dev
# Open http://localhost:8080
# Check each domain drawer has content
```

---

## CodexQube Archival Strategy 🗄️

### Purpose

Archive content in CodexQube format for:
- Historical preservation
- Offline access
- Distribution to franchises
- Version control

### Implementation

**Archive Structure**:
```
archives/
└── theqriptopian/
    ├── issue-0/
    │   ├── codex.json          # Full CodexQube
    │   ├── domains/
    │   │   ├── pennydrops.json
    │   │   ├── scrolls.json
    │   │   └── kn0wdz.json
    │   ├── content/
    │   │   ├── {article-id}.md
    │   │   └── ...
    │   └── media/
    │       └── {asset-id}.*
    └── issue-1/
        └── ...
```

**Archive Command**:
```bash
pnpm archive-issue --issue 0 --franchise theqriptopian
```

**Script** (`scripts/archive-issue.ts`):
```typescript
// 1. Fetch current issue data from QubeBase
// 2. Download all media assets
// 3. Convert to markdown files
// 4. Generate CodexQube JSON
// 5. Package for distribution
// 6. Upload to IPFS/Arweave (optional)
```

---

## Admin Portal MVP Spec

### Phase 1: Content Editor (1-2 days)

**Features**:
- List all content
- Edit existing articles (markdown)
- Change domain assignment
- Update tags and metadata
- Publish/unpublish toggle

**Tech Stack**:
- Next.js (App Router)
- Supabase JS client
- React Markdown editor (e.g., `react-md-editor`)
- Tailwind CSS

### Phase 2: Content Creator (1-2 days)

**Features**:
- Create new articles
- Upload media
- Rich preview
- Save drafts

### Phase 3: Domain Manager (1 day)

**Features**:
- Visual domain organization
- Drag-and-drop reordering
- Bulk operations

### Phase 4: Issue Manager (1 day)

**Features**:
- Create new issues
- Archive old issues
- Set featured content

---

## Data Flow

```
QubeBase (Supabase)
    ↓ (SQL queries)
Admin Portal
    ↓ (CRUD operations)
QubeBase (Supabase)
    ↓ (fetch script)
issue-0.ts (generated)
    ↓ (import)
CodexProvider
    ↓ (React Context)
Qriptopian App Components
```

---

## Current State Summary

✅ **Working**:
- QubeBase connection
- Content fetching
- CodexQube generation
- 47 articles integrated

⚠️ **Needs Attention**:
- Domain organization (all under "qriptopian")
- Content distribution across proper domains

❌ **Missing**:
- Admin portal for content management
- Domain assignment UI
- Content archival automation

---

## Recommendations

### Short-term (This Week)

1. **SQL Fix**: Manually update domains in QubeBase
2. **Re-fetch**: Run fetch script again
3. **Verify**: Test all domain drawers have content

### Medium-term (Next Sprint)

1. **Admin Portal MVP**: Build basic content editor
2. **Domain UI**: Visual domain assignment
3. **Testing**: Lovable vs Monorepo content parity

### Long-term (Future)

1. **Full Admin Portal**: Complete content management system
2. **Archival System**: Automated CodexQube archiving
3. **Distribution**: IPFS/Arweave content distribution

---

**Next Action**: Check domain distribution in QubeBase and fix domain assignments.
