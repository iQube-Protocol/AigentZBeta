# AA-API SmartContent Compliance Requirements

> **Version**: 1.0  
> **Status**: MANDATORY  
> **Scope**: All AgentiQ Estate Applications, Franchises, and Tenants

## Overview

This document defines the mandatory requirements for content rendering, action icons, and modality handling across all applications within the AgentiQ estate. Compliance with these requirements is mandatory for any application using the Liquid UI system.

## Core Principle

**All content rendering MUST use the SmartTriad system.** No alternative content action systems, modality icon implementations, or drawer components are permitted.

---

## Mandatory Components

### 1. SmartContentActions

The **ONLY** approved component for rendering content action icons.

**Location**: `apps/theqriptopian-web/src/components/content/SmartContentActions.tsx`

**Supported Actions**:
- `read` - Open text reader
- `watch` - Play video
- `listen` - Play audio
- `interact` - Start agent chat
- `link` - Open external URL
- `expand` - Expand to larger view
- `share` - Share content

**Usage**:
```tsx
import { SmartContentActions } from '@/components/content/SmartContentActions';

<SmartContentActions
  modalities={item.modalities}
  context="thumbnail"  // thumbnail | card | poster | hero | drawer | fullscreen
  showExpand={true}
  showShare={false}
  size="sm"  // xs | sm | md | lg
  onAction={(action) => handleAction(action)}
/>
```

### 2. SmartContentRendering Types

The **ONLY** approved source for variant contracts and modality validation.

**Location**: `types/smartContentRendering.ts`

**Exports**:
- `SmartContentVariant` - All supported content display variants
- `SmartContentContext` - Display context types
- `SmartContentAction` - Action types
- `SmartContentModalities` - Modality interface
- `SmartContentActionsContract` - Rendering contract
- `VARIANT_CONTRACTS` - Lookup table for all variants
- Helper functions: `hasPlayableContent()`, `hasReadableContent()`, etc.

### 3. SmartTriad Package

The **ONLY** approved package for drawer layers, icon bars, and navigation primitives.

**Package**: `@agentiq/smarttriad`

**Components**:
- `DrawerLayer` - Base drawer component
- `IconBar` - Navigation icon bar
- `VideoModal` - Video playback modal
- `SmartThumbnail` - Thumbnail with actions

---

## Variant Contracts

All content must render according to its variant contract. Use `getVariantContract(variant)` to retrieve the contract.

| Variant | Size | Position | Hover Only | Max Icons |
|---------|------|----------|------------|-----------|
| `thumbnail6` | xs | bottom-left | yes | 2 |
| `drawerThumbnail` | sm | bottom-right | yes | 3 |
| `newsCard` | sm | top-right | no | 3 |
| `hero` | lg | inline | no | 4 |
| `poster2` | md | top-right | no | 4 |
| `poster3` | md | top-right | no | 4 |
| `carousel4` | xs | bottom-right | yes | 2 |

See `VARIANT_CONTRACTS` in `types/smartContentRendering.ts` for the complete list.

---

## Modality Validation

Icons MUST only appear if actual content exists. Use the helper functions:

```typescript
import { 
  hasPlayableContent,
  hasReadableContent,
  hasListenableContent,
  hasInteractiveContent,
  hasLinkContent,
  getAvailableActions,
  getPrimaryAction
} from '@/types/smartContentRendering';

// Check for specific modality
if (hasPlayableContent(modalities)) {
  // Show watch action
}

// Get all available actions
const actions = getAvailableActions(modalities);

// Get primary action (priority: watch > read > listen > interact > link)
const primary = getPrimaryAction(modalities);
```

---

## Prohibited Practices

The following are **STRICTLY PROHIBITED**:

1. ❌ Creating alternative content action components
2. ❌ Creating alternative modality icon systems
3. ❌ Hardcoding action buttons without SmartContentActions
4. ❌ Creating drawer components that don't extend DrawerLayer
5. ❌ Implementing content cards without using VARIANT_CONTRACTS
6. ❌ Using emoji icons instead of Lucide icons for actions
7. ❌ Bypassing modality validation checks

---

## Franchise/Tenant Requirements

Any franchise or tenant application using the Liquid UI system MUST:

1. **Import SmartContentActions** from the approved location
2. **Follow variant contract specifications** for all content rendering
3. **Not create competing action/modality systems**
4. **Use SmartTriad DrawerLayer** for all drawer implementations
5. **Validate modalities** using the provided helper functions
6. **Pass context prop** to SmartContentActions for proper styling

---

## Enforcement

### Code Review Checklist

- [ ] All content thumbnails use SmartContentActions
- [ ] All posters use SmartContentActions
- [ ] All cards use SmartContentActions
- [ ] All hero sections use SmartContentActions
- [ ] No hardcoded action buttons
- [ ] Modalities validated before rendering icons
- [ ] Correct context prop passed to SmartContentActions
- [ ] DrawerLayer used for all drawers

### Copilot Guidance

Copilot should:
- Always suggest SmartContentActions for content rendering
- Reference VARIANT_CONTRACTS for styling decisions
- Use helper functions for modality validation
- Never suggest alternative action systems

---

## Affected Applications

This compliance requirement applies to:

- **The Qriptopian** - News/media franchise
- **metaKnyts** - Graphic novel franchise
- **AgentiQ** - AI agent platform
- **All future franchises and tenants**

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-18 | Initial release |

---

## Contact

For questions about SmartContent compliance, contact the AgentiQ architecture team.
