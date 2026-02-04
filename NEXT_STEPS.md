# Next Steps: Domain Assignments & Admin Portal

**Date**: December 7, 2025  
**Status**: Ready to execute  
**Session Summary**: QubeBase connected, domains analyzed, ready for assignment

---

## Task 1: Fix Domain Assignments ✅ READY

### Step 1: Run SQL in Supabase (5 minutes)

1. **Open Supabase SQL Editor**:
   ```
   https://supabase.com/dashboard/project/bsjhfvctmduxhohtllly/editor
   ```

2. **Copy SQL**:
   - File: `scripts/domain-assignments.sql`
   - Or use the commands below

3. **Execute SQL** (copy-paste to editor):

```sql
-- 📜 Scrolls (15 items)
UPDATE content SET domain = 'scrolls' WHERE id IN (
  '37266d3b-7ee1-4d0f-ac42-72e296550dc5',
  '14d03c09-461a-4055-9901-f9ef9a10e9ec',
  '17d3796d-8dea-45b6-b988-b9a946f84138',
  'a818daa3-0737-420e-a496-ff236d061bd2',
  '0b335670-b63d-4006-a89f-dfbc2e2835f7',
  'a3c56b25-326c-445b-8da2-225da1a8639d',
  '1edd2b19-c502-4e32-929c-2e79aed1fe06',
  '3e307627-7643-470f-ba99-ae928fe83566',
  '126c0e3e-ebe2-4c8f-9080-82418949ea6a',
  '19873fde-8495-46ca-a5e3-ede6d4bb1f25',
  '613f5dbe-ccd5-4a07-9c84-dc17ad893eca',
  '9a6e9be7-7187-485f-b2b5-ede1727c52e2',
  'ea4a83a8-5537-483a-9632-6a1590f0c608',
  '141cd45f-a4c8-46bb-9c4f-f15bd6fda84e',
  'd69a2436-ee82-4068-a9e4-731e8c449b92'
);

-- 💧 PennyDrops (17 items)
UPDATE content SET domain = 'pennydrops' WHERE id IN (
  '5d1c3a7d-0bac-4522-ac45-62826ea80b37',
  'bb3e3c34-8b4a-4ab0-9916-c466702fd8ae',
  'ab80184d-ccf7-448b-9532-089a3b11b5ee',
  'a47b5eab-1542-4137-8e5a-395aafbc620e',
  'a76b3c3a-71ca-4ecd-ba59-02b14d7df934',
  'f990cf0f-fbb6-4f68-a3d2-10d168ad9cb0',
  '02681a52-ee6e-4cba-9fa0-a4ab8b74a1a8',
  '45a9c162-5dba-460c-a1c3-2ae678eb71cb',
  '94585945-59d2-4dcd-b953-56b1e5c3a135',
  'd63a1602-3337-4d56-b1c5-cdcdf21e3aec',
  '266c041c-355e-4dc7-b4a1-9093ae9a502a',
  '6e074ac1-f666-46ef-ac63-ca706f18801b',
  '56f70d60-a4bc-41ef-b703-f4916b563aee',
  '889b939e-dfea-4937-8350-984bf84c93bf',
  'db1cf2b7-379a-4d46-bdca-ce22567a8da2',
  '9b7c3b59-1192-44d3-bad4-543c06000c9b',
  'd51579d4-6dad-48d6-9c1a-5b0904fd46f4'
);

-- 💻 Kn0wdZ (15 items)
UPDATE content SET domain = 'kn0wdz' WHERE id IN (
  '2335afed-bdf2-4d3e-a7ab-113a726c3723',
  '7ba84950-599a-454c-8f78-1ecd916eac56',
  'ed0a851e-1ddb-4803-a236-e447054a558e',
  '2b26df84-7573-4899-bf57-d7e0d374e066',
  '2a8b7b36-7d38-480d-b89a-032ab367c635',
  '1c89d604-106f-4ed4-8477-eafe3fd3a3a4',
  '83763ce3-b4f3-46eb-8717-1c8639fabe05',
  '19268e34-d1a7-465c-8925-8cb43ffd194c',
  '2a3b19cd-2260-4046-875d-c91c257c7e73',
  'b87fb671-2f6a-46f6-9a36-4187c727ea02',
  'e6093b39-e696-4262-ae0c-79a09e9af6d1',
  '41b262dc-9074-4929-bd01-e0d3093572ec',
  'e531a208-0ea5-416d-a994-89dadf61de5c',
  'aab61786-b3ce-4421-aa71-b7d007089de2',
  '7b47fe3e-872e-4317-a860-a03fb3bd8579'
);

-- Verify
SELECT domain, COUNT(*) FROM content WHERE status = 'published' GROUP BY domain;
```

4. **Verify Results**:
   - scrolls: 15
   - pennydrops: 17
   - kn0wdz: 15
   - **Total: 47**

### Step 2: Re-fetch Content (1 minute)

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta
pnpm tsx scripts/fetch-qubebase-content.ts
```

### Step 3: Test in App (2 minutes)

The dev server should already be running at http://localhost:8081

Click each domain icon:
- 💧 **PennyDrops** → Should show 17 Q¢ stories
- 📖 **Scrolls** → Should show 15 chronicles
- 💻 **Kn0wdZ** → Should show 15 builder articles

---

## Task 2: Build Admin Portal 🔧 NEXT SESSION

### Why Admin Portal is Needed

Currently, content management requires:
- Direct SQL queries in Supabase
- Manual domain assignments
- No preview before publish
- No easy way to edit articles

**Admin Portal provides**:
- Visual content editor
- Drag-and-drop domain organization
- Rich markdown editor
- Media uploader
- Preview before publish
- User-friendly interface

### Architecture

```
apps/
├── theqriptopian-web/      # Public site (done)
└── theqriptopian-admin/    # Admin portal (to build)
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   ├── ContentList.tsx
    │   │   ├── ContentEditor.tsx
    │   │   ├── DomainManager.tsx
    │   │   └── MediaLibrary.tsx
    │   ├── components/
    │   │   ├── RichEditor.tsx
    │   │   ├── MediaUploader.tsx
    │   │   ├── DomainSelector.tsx
    │   │   └── PublishControls.tsx
    │   └── lib/
    │       └── admin-client.ts
    └── package.json
```

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (same credentials)
- **Auth**: Supabase Auth
- **Editor**: `react-md-editor` or `@uiw/react-markdown-editor`
- **UI**: Tailwind + Radix UI (consistent with main site)
- **File Upload**: Supabase Storage

### MVP Features (Phase 1)

1. **Content List**
   - View all articles
   - Filter by domain, status
   - Search by title
   - Sort by date

2. **Content Editor**
   - Markdown editing
   - Meta fields (title, excerpt, tags)
   - Domain assignment
   - Tab assignment (metaknyts, dev, etc.)
   - Publish/draft toggle

3. **Media Library**
   - Upload images
   - Browse existing media
   - Copy URLs for articles

4. **Domain Overview**
   - See content distribution
   - Quick domain reassignment

### Implementation Plan

#### Session 1: Scaffold & Auth (1-2 hours)
- Create Next.js app
- Set up Supabase client
- Implement auth (login/logout)
- Create basic layout

#### Session 2: Content List (1 hour)
- Fetch & display content
- Add filters and search
- Implement pagination

#### Session 3: Content Editor (2 hours)
- Markdown editor integration
- Form handling
- Save/update content
- Preview mode

#### Session 4: Domain Manager (1 hour)
- Visual domain view
- Drag-and-drop (optional)
- Bulk domain assignment

#### Session 5: Media Upload (1 hour)
- Supabase Storage integration
- Upload UI
- Media browser

**Total Estimate**: 6-7 hours over 2-3 sessions

### Bootstrap Command (Ready to Run)

```bash
cd /Users/hal1/CascadeProjects/AigentZBeta/apps
npx create-next-app@latest theqriptopian-admin --typescript --tailwind --app --src-dir
cd theqriptopian-admin
pnpm add @supabase/supabase-js @supabase/auth-helpers-nextjs
pnpm add @uiw/react-md-editor lucide-react
```

---

## Summary

### ✅ Done Today

1. **QubeBase Connection**: Live data flowing from database
2. **Domain Analysis**: All 47 items analyzed and mapped
3. **SQL Generated**: Ready-to-run domain assignments
4. **Scripts Created**:
   - `fetch-qubebase-content.ts` - Fetch from QB
   - `assign-domains.ts` - Analyze distribution
   - `domain-assignments.sql` - SQL to execute

### 🎯 Do Next (This Session)

1. Run SQL in Supabase (5 min)
2. Re-fetch content (1 min)
3. Test domain drawers (2 min)

### 🚀 Do Later (Next Session)

1. Build admin portal MVP
2. Implement content editor
3. Add media upload
4. Create domain manager

---

## Quick Commands

```bash
# Re-fetch content after SQL update
pnpm tsx scripts/fetch-qubebase-content.ts

# Analyze current distribution
pnpm tsx scripts/assign-domains.ts

# Start dev server
cd apps/theqriptopian-web && pnpm dev

# Create admin portal (when ready)
cd apps && npx create-next-app@latest theqriptopian-admin --typescript --tailwind --app
```

---

**Status**: Ready to execute domain assignments! 🚀
