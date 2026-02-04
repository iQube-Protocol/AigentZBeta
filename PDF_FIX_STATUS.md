# PDF and Codex Loading Fix Status

## Current Situation (Dec 23, 2025)

### ✅ What's Working
- **Cover thumbnails**: Successfully implemented with Sharp, serving WebP under 950KB
- **Scrolls tab**: Loading correctly
- **Characters tab**: Loading correctly (needs loading spinners added)
- **Next.js API server**: Running on port 3000
- **Vite thin client**: Running on port 8080

### ❌ What's Broken

#### 1. Codex Tab Not Loading
**Error**: "Codex Loading Error: There was an issue loading the Codex. This may be due to a network issue or service unavailability."

**Likely Cause**: The CodexLiquidUITab component may have import or runtime errors. Need to check browser console for specific error.

**Next Steps**:
- Check browser console for JavaScript errors
- Verify CodexLiquidUITab component loads correctly
- May need to add error boundary logging

#### 2. PDF Viewer Issues
**Problem**: PDFs open but block UI without close button during loading

**Current Status**: Reverted to client-side PDFViewer (original implementation)

**Why Server-Side Rendering Failed**:
- Node version: 18.20.5 (current)
- pdfjs-dist requires: Node 20.16.0+
- Cannot implement server-side PDF page rendering until Node is upgraded

**Temporary Solution**: Using client-side PDF.js rendering (fetches full PDF)
- ⚠️ Still susceptible to CloudFront 413 errors for large PDFs (>1MB)
- Works for smaller PDFs
- Better UX than broken page-by-page viewer

## What Was Attempted

### Phase 1A: Cover Thumbnails ✅
- Modified `/api/content/cover/[cid]/route.ts` to generate WebP thumbnails
- Added `?variant=thumb` query parameter
- Updated all frontend components to request thumbnails
- **Result**: SUCCESS - covers load reliably under 950KB

### Phase 1B: PDF Page Rendering ❌
**Attempted Implementation**:
1. Created `/api/content/pdf-meta/[cid]/route.ts` - Get page count
2. Created `/api/content/pdf-page/[cid]/route.ts` - Render single pages as WebP
3. Created `PDFPageViewer.tsx` - Lazy-load pages as images
4. Updated components to use new viewer

**Blocking Issue**: 
```
pdfjs-dist requires Node >=20.16.0
Current Node version: 18.20.5
```

**Error**: `TypeError: Object.defineProperty called on non-object` when importing pdfjs-dist in Next.js server context

**Attempted Workarounds**:
- ❌ Using `pdfjs-dist/legacy/build/pdf.js` - Module not found
- ❌ Using `getDocument` from `pdfjs-dist` - Runtime error in Next.js
- ❌ Using `pdf-parse` - Only extracts text/metadata, doesn't render pages
- ❌ Using `pdf-lib` - Doesn't render to images

## Recommended Next Steps

### Immediate (Can Do Now)
1. **Fix Codex tab loading**:
   - Check browser console for errors
   - Add better error logging to CodexLiquidUITab
   - May need to fix import or data fetching issue

2. **Improve PDF viewer UX**:
   - Add loading state with close button (so user isn't blocked)
   - Add better error handling
   - Show file size warning for large PDFs

3. **Add character loading spinners**:
   - Add skeleton loaders to character cards while images load

### Future (Requires Node Upgrade)
1. **Upgrade Node.js to 20.x**:
   - Required for pdfjs-dist server-side rendering
   - Required for many other dependencies (Supabase, Autonomys, etc.)
   - Current warnings show 15+ packages require Node 20+

2. **Implement Phase 1B PDF page rendering**:
   - Re-enable `/api/content/pdf-page/[cid]/route.ts`
   - Re-enable `/api/content/pdf-meta/[cid]/route.ts`
   - Use `PDFPageViewer` component
   - Lazy-load pages as WebP images under 950KB each

## Files Modified

### Cover Thumbnails (Working)
- `/app/api/content/cover/[cid]/route.ts` - Added Sharp thumbnail generation
- `/apps/theqriptopian-web/src/components/content/KnytCodexTab.tsx` - Request thumbnails
- `/apps/theqriptopian-web/src/components/codex/CodexLiquidUITab.tsx` - Request thumbnails
- `/apps/theqriptopian-web/src/components/content/KnytCardsGrid.tsx` - Request thumbnails

### PDF Rendering (Reverted)
- `/app/api/content/pdf-meta/[cid]/route.ts` - Created but broken (Node version)
- `/app/api/content/pdf-page/[cid]/route.ts` - Created but broken (Node version)
- `/apps/theqriptopian-web/src/components/content/PDFPageViewer.tsx` - Created but unused
- Components reverted to use original `PDFViewer.tsx`

## Testing Checklist

### Cover Thumbnails
- [ ] Open Codex → Episodes tab
- [ ] Verify covers load quickly
- [ ] Check Network tab: URLs have `?variant=thumb`
- [ ] Check response size: < 950KB
- [ ] No 413 errors

### Codex Tab
- [ ] Open Codex → Codex tab
- [ ] Should show template-based layout
- [ ] Check browser console for errors
- [ ] Verify data loads correctly

### PDF Viewer
- [ ] Click "Read" on any episode
- [ ] PDF should open with close button visible
- [ ] Should not block UI during loading
- [ ] Check if large PDFs cause 413 errors

### Characters
- [ ] Open Codex → Characters tab
- [ ] Verify character cards load
- [ ] Add loading spinners (TODO)

## Environment

**Servers**:
- Vite dev server: http://localhost:8080
- Next.js API server: http://localhost:3000

**Node Version**: 18.20.5 (⚠️ Many packages require 20+)

**Key Dependencies**:
- sharp: ✅ Installed and working
- pdfjs-dist: ⚠️ Installed but incompatible with Node 18
- pdf-parse: ✅ Installed (metadata only)
- pdf-lib: ✅ Installed (manipulation only, no rendering)
