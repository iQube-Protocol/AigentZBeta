# Multi-Codex System - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the multi-codex system, including backward compatibility verification, API testing, and UI validation.

## Local Testing Setup

### Prerequisites
1. Development server running on `http://localhost:3002`
2. Supabase database accessible
3. Environment variables configured

### Start Testing
```bash
# Start dev server
npm run dev

# Server will start on available port (3000, 3001, or 3002)
```

## Test Suite

### 1. Codex Viewer Testing

**URL**: `http://localhost:3002/codex/viewer`

**Test Cases**:
- [ ] Page loads successfully
- [ ] All three codexes appear in selector (KNYT, Qripto, AigentiQ)
- [ ] Codex selection switches content correctly
- [ ] Theme toggle works (light/dark)
- [ ] Density toggle works (narrow/wide)
- [ ] Tab navigation functions properly
- [ ] Embed URL updates correctly

**Expected Behavior**:
- Smooth transitions between codexes
- No console errors
- Proper theme application
- Responsive layout

### 2. KNYT Codex - Backward Compatibility

**URL**: `http://localhost:3002/triad/embed/codex/knyt`

**Test Cases**:

#### Scrolls Tab
- [ ] Fetches from `/api/admin/codex/status?series=metaKnyts`
- [ ] Displays episode covers
- [ ] Shows motion master availability
- [ ] Print variants visible
- [ ] Auto-Drive CIDs working
- [ ] SmartContentActions buttons appear
- [ ] Read/Watch actions functional

**API Test**:
```bash
curl http://localhost:3002/api/admin/codex/status?series=metaKnyts
```

**Expected Response**:
```json
{
  "episodes": [
    {
      "episodeNumber": 1,
      "displayNumber": "#0",
      "title": "Episode Title",
      "coverImageCid": "Qm...",
      "printRareCid": "Qm...",
      "motionMasterCid": "Qm...",
      "hasStillMaster": true,
      "hasMotionMaster": true
    }
  ]
}
```

#### Characters Tab
- [ ] Fetches from `/api/codex/knyt-cards`
- [ ] Displays character cards
- [ ] Front/back CIDs working
- [ ] Rarity indicators visible
- [ ] Episode numbers shown
- [ ] SmartContentActions functional

**API Test**:
```bash
curl http://localhost:3002/api/codex/knyt-cards
```

#### Lore Tab
- [ ] Fetches from `/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept`
- [ ] Displays lore documents
- [ ] Auto-Drive CIDs functional
- [ ] Display modes working
- [ ] Extracted text accessible

**API Test**:
```bash
curl "http://localhost:3002/api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept"
```

### 3. Qripto Codex - Home Content Integration

**URL**: `http://localhost:3002/triad/embed/codex/qripto`

**Test Cases**:

#### Features Tab
- [ ] Displays hero articles (top 3)
- [ ] Shows latest news carousel
- [ ] Renders second hero article
- [ ] All images load correctly
- [ ] Author and date information visible
- [ ] SmartContentActions available
- [ ] Click actions work

**API Tests**:
```bash
# Hero Articles
curl http://localhost:3002/api/content/section/home-hero

# Latest News
curl http://localhost:3002/api/content/section/latest-news

# Second Hero
curl http://localhost:3002/api/content/section/second-hero
```

**Expected Response Structure**:
```json
{
  "content": [
    {
      "id": "content:123",
      "title": "Article Title",
      "excerpt": "Article excerpt...",
      "author": "Author Name",
      "published_at": "2025-01-01T00:00:00Z",
      "cover_image_url": "https://...",
      "modalities": {
        "read": { "available": true, "text": "..." }
      }
    }
  ]
}
```

### 4. Codex Registry API Testing

#### List All Codexes
```bash
curl http://localhost:3002/api/codex/registry
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "knyt-codex",
      "name": "KNYT Codex",
      "slug": "knyt",
      "enabled": true,
      "tabCount": 8,
      "metadata": {
        "description": "KNYT Protocol knowledge base...",
        "icon": "BookOpen",
        "color": "purple"
      }
    }
  ]
}
```

#### Get Specific Codex
```bash
curl http://localhost:3002/api/codex/registry/knyt-codex
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "id": "knyt-codex",
    "name": "KNYT Codex",
    "slug": "knyt",
    "enabled": true,
    "version": "1.0.0",
    "tabs": [
      {
        "id": "scrolls",
        "label": "Scrolls",
        "slug": "scrolls",
        "type": "static",
        "enabled": true,
        "config": {
          "component": "ScrollsTab"
        }
      }
    ]
  }
}
```

### 5. SmartTriad Integration Testing

**Test Cases**:
- [ ] SmartContentActions buttons render
- [ ] Read action opens ArticleReader
- [ ] Watch action opens VideoModal
- [ ] Listen action (if available)
- [ ] Link action opens external URL
- [ ] View action opens image lightbox
- [ ] Share action opens SocialSharingModal
- [ ] Global modals work correctly
- [ ] No duplicate modal instances

**Component Test**:
```typescript
// Verify modalities structure
const testContent = {
  id: "test-1",
  title: "Test Content",
  modalities: {
    read: { available: true, text: "Content..." },
    watch: { available: true, video_url: "https://..." }
  }
};
```

### 6. Liquid UI Testing

**Test Cases**:
- [ ] Template selection based on device
- [ ] User intent recognition
- [ ] Content curation working
- [ ] Realm filtering functional
- [ ] Copilot modes (overlay, sidebar, fullscreen)
- [ ] Device-adaptive layouts
- [ ] Template switching smooth

**Test Liquid UI Tab**:
```bash
# Access KNYT Codex home (liquid-ui type)
curl http://localhost:3002/triad/embed/codex/knyt?tab=codex
```

### 7. Admin UI Testing

**URL**: `http://localhost:3002/admin/codex`

**Test Cases**:
- [ ] Codex list loads
- [ ] Filter buttons work (all, enabled, disabled)
- [ ] Codex cards display correctly
- [ ] Stats accurate (total, active, tabs)
- [ ] Edit button navigates correctly
- [ ] Preview button opens embed
- [ ] Create button accessible

**Codex Detail Page**:
**URL**: `http://localhost:3002/admin/codex/knyt-codex`

**Test Cases**:
- [ ] Codex details load
- [ ] Basic info displayed
- [ ] Tabs list shown
- [ ] Enable/disable toggle works
- [ ] Quick actions functional
- [ ] Metadata visible
- [ ] Permissions displayed

### 8. Embed Routes Testing

#### Default Embed (KNYT)
```bash
curl http://localhost:3002/triad/embed/codex
```

#### Specific Codex Embeds
```bash
curl http://localhost:3002/triad/embed/codex/knyt
curl http://localhost:3002/triad/embed/codex/qripto
curl http://localhost:3002/triad/embed/codex/aigentiq
```

#### With Query Parameters
```bash
# Tab selection
curl "http://localhost:3002/triad/embed/codex/knyt?tab=scrolls"

# Theme
curl "http://localhost:3002/triad/embed/codex/knyt?theme=light"

# Density
curl "http://localhost:3002/triad/embed/codex/knyt?density=narrow"

# Combined
curl "http://localhost:3002/triad/embed/codex/qripto?tab=features&theme=dark&density=wide"
```

### 9. Backward Compatibility Verification

#### Existing Qriptopian Components
- [ ] HeroSection renders correctly
- [ ] LatestNewsCarousel functional
- [ ] SecondHeroSection displays
- [ ] PennyDropsDrawer works
- [ ] ScrollsDrawer functional
- [ ] CodexLiquidUITab operational

#### Existing Hooks
- [ ] `useLiquidUIContent('home-hero')` works
- [ ] `useLiquidUIContent('latest-news')` works
- [ ] `useLiquidUIContent('second-hero')` works
- [ ] `useCodexEpisodes()` functional
- [ ] `useCodexCharacters()` functional
- [ ] `useCodexLore()` functional

#### Existing APIs
- [ ] `/api/content/section/{section}` working
- [ ] `/api/admin/codex/status` working
- [ ] `/api/codex/knyt-cards` working
- [ ] `/api/content/assets` working

### 10. Performance Testing

**Metrics to Monitor**:
- [ ] Initial page load < 2s
- [ ] Tab switching < 500ms
- [ ] API response times < 1s
- [ ] Image loading optimized
- [ ] No memory leaks
- [ ] Smooth animations

**Tools**:
- Chrome DevTools Performance tab
- Network tab for API timing
- React DevTools Profiler

### 11. Error Handling Testing

**Test Cases**:
- [ ] Invalid codex ID shows error
- [ ] Missing API data handled gracefully
- [ ] Network errors display message
- [ ] Empty states render correctly
- [ ] 404 pages for invalid routes
- [ ] Console errors minimal

### 12. Responsive Design Testing

**Breakpoints**:
- [ ] Mobile (320px - 768px)
- [ ] Tablet (768px - 1024px)
- [ ] Desktop (1024px+)

**Test Cases**:
- [ ] Layout adapts correctly
- [ ] Navigation accessible
- [ ] Touch targets adequate
- [ ] Text readable
- [ ] Images scale properly

## Automated Testing

### Unit Tests
```bash
# Run unit tests
npm test

# Watch mode
npm test -- --watch
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration
```

### E2E Tests
```bash
# Run Playwright tests
npm run test:e2e
```

## Regression Testing Checklist

Before deploying:
- [ ] All existing Qriptopian features work
- [ ] No broken links or 404s
- [ ] All API endpoints responding
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No console errors in production
- [ ] Performance metrics acceptable
- [ ] Security audit passed

## Known Issues

### Non-Blocking
- Lockfile SWC dependency warning (cosmetic)
- Dynamic server usage warnings (expected for API routes)

### Monitoring Required
- API response times under load
- Memory usage with multiple codexes
- Cache invalidation timing

## Success Criteria

✅ **KNYT Codex**: All tabs functional with existing APIs
✅ **Qripto Codex**: Features tab displays home content
✅ **AigentiQ Codex**: Placeholder tabs render
✅ **SmartTriad**: Actions work across all codexes
✅ **Liquid UI**: Template system operational
✅ **Admin UI**: Management interface functional
✅ **Backward Compatibility**: 100% maintained
✅ **Performance**: Meets benchmarks
✅ **No Regressions**: Existing features intact

## Reporting Issues

When reporting issues, include:
1. **URL**: Exact URL where issue occurs
2. **Steps**: How to reproduce
3. **Expected**: What should happen
4. **Actual**: What actually happens
5. **Browser**: Browser and version
6. **Console**: Any console errors
7. **Network**: Failed API calls
8. **Screenshots**: Visual issues

## Next Steps After Testing

1. **Fix Critical Issues**: Address any blocking bugs
2. **Optimize Performance**: Improve slow areas
3. **Enhance UX**: Polish interactions
4. **Add Copilot Actions**: Natural language editing
5. **Deploy to Staging**: Test in staging environment
6. **Production Deployment**: Roll out to production
7. **Monitor**: Watch metrics and user feedback
