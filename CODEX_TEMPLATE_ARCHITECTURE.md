# Codex Template Architecture

## Dual Template System (Current State)

The Codex currently operates with **two parallel template systems** that need to be consolidated in the future:

### 1. KNYT Liquid UI Templates (5 templates)
**Location**: `apps/theqriptopian-web/src/components/codex/templates/KnytTemplateRenderer.tsx`

**Templates**:
1. `knyt:drawer_grid_v1` - Browse/discover grid layout (bridge template)
2. `knyt:dual_poster_stage_v1` - 90% height portrait posters + quest rail
3. `knyt:motion_stage_v1` - Immersive landscape motion stage + clip strip
4. `knyt:quest_hud_hub_v1` - Task/reward/ascension-first HUD
5. `knyt:realm_bridge_map_v1` - DigiTerra ↔ Terra ↔ metaTerra bridging

**Features**:
- Copilot-driven template selection based on user intent, device, content mix
- Smart Wallet integration (narrow/wide modes)
- Fixed viewport with internal scrolling
- Template pack v0.2 driven by JSON configuration

**Service**: `apps/theqriptopian-web/src/services/knytLiquidUIService.ts`

**Used by**: `CodexLiquidUITab` (main Codex tab)

### 2. Branded Templates (9 templates)
**Location**: Various legacy components

**Templates** (to be documented):
- Legacy scrolls drawer
- Character grid layouts
- Lore display templates
- Episode viewers
- Other branded UI patterns

**Used by**: `KnytCodexTab` and other legacy tab components

## Consolidation Plan (Future)

**Goal**: Merge all 9 branded templates into the Liquid UI system

**Benefits**:
- Single template selection engine
- Unified copilot integration
- Consistent Smart Wallet surfaces
- Simplified maintenance
- Better template composition

**Approach**:
1. Audit all 9 branded templates
2. Map to Liquid UI template pack structure
3. Migrate template logic to `KnytTemplateRenderer`
4. Update service to handle all selection scenarios
5. Deprecate legacy components
6. Update all tabs to use `CodexLiquidUITab`

## Current Integration Points

### Content Types Supported
- `comic_page_portrait` - Episode pages
- `comic_cover_portrait` - Episode covers
- `character_portrait` - Character cards
- `motion_comic_landscape` - Motion comics
- `lore_snippet` - Lore documents
- `terra_update` - Terra/metaTerra content

### Template Selection Priority
1. `user_intent` (highest)
2. `content_mix`
3. `realm`
4. `device`
5. `task_state`
6. `business_goal` (lowest)

### Wallet Integration
- **Narrow mode**: Balance, reward claim, task step (28% mobile, 22% desktop)
- **Wide mode**: Checkout, send/request, permissions, receipt (62% mobile, 38% desktop)

## PDF-lite & Derivatives Architecture

### Interim Solution (Current)
**Problem**: CloudFront/Lambda 1MB response limits cause 413 errors for large images and PDFs

**Solution**: Supabase Storage derivatives layer
- `cover_thumb_url` - WebP thumbnails (900px, ~50-250KB)
- `pdf_lite_url` - Downsampled PDFs (150dpi, /ebook preset, 2-8MB)

**Storage**:
- Bucket: `codex-lite` (public read)
- Paths: `covers/<cid>.webp`, `pdf-lite/<cid>.pdf`

**Database**:
- Tables: `codex_media_assets`, `master_content_qubes`
- Columns: `cover_thumb_url`, `pdf_lite_url`

### Canonical Source (Autonomys)
- Full-resolution covers
- Original PDFs
- Provenance and minting source
- Download and ownership verification

### Long-term Architecture
- Autonomys remains canonical
- Derivatives can be:
  - Signed URLs (security)
  - Edge-safe delivery service
  - Derivative CIDs back in Autonomys
  - Phase C streaming infrastructure

## Component Structure

### Reading Components
- `PDFPageViewer` - Page-by-page WebP rendering (current fallback)
- `PDFLiteReaderModal` - Native browser PDF rendering via iframe (new, preferred)
- `PDFViewer` - Legacy client-side PDF.js (deprecated for Codex)

### Codex Main Components
- `CodexLiquidUITab` - Main Liquid UI orchestrator (5 KNYT templates)
- `KnytCodexTab` - Legacy tab component (9 branded templates)
- `KnytTemplateRenderer` - Template rendering engine

### Utility Components
- `ContentCard` - Unified content card component
- `SmartContentActions` - Action buttons (read, watch, etc.)
- `CopilotWalletDrawer` - In-codex wallet surface

## Notes
- **DO NOT DROP** any of the 9 branded templates during consolidation
- Both systems must coexist until migration is complete
- Template selection must remain backward compatible
- Wallet integration must work across both systems
