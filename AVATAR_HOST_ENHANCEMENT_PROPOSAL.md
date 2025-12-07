# AvatarHost Package Enhancement: Context-Aware Positioning

**Date**: December 7, 2025  
**Status**: Proposal for Future Implementation  
**Priority**: Medium  
**Origin**: Lovable Qriptopian advanced avatar positioning

---

## Problem Statement

The current `@agentiq/avatar-host` package provides simple fixed positioning (`bottom-right`, `bottom-left`, etc.). The Lovable Qriptopian implementation demonstrates advanced context-aware positioning where the avatar adapts based on which drawer or feature is active.

---

## Current Implementation

**Package**: `@agentiq/avatar-host`

```typescript
<AvatarHost 
  position="bottom-right" 
  defaultAgent="copilot" 
/>
```

**Limitations**:
- Fixed position only
- No context awareness
- No responsive layout integration
- No dynamic sizing based on active features

---

## Proposed Enhancement

### Feature: Context-Aware Positioning

Allow the avatar to dynamically position and size itself based on application context.

### API Design

```typescript
interface ContextPosition {
  fullscreen?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  width?: string;
  height?: string;
  className?: string;
  mobileOverride?: Partial<ContextPosition>;
}

interface AvatarHostProps {
  // ... existing props
  position?: 'bottom-right' | 'context-aware'; // NEW
  contextPositioning?: {
    [key: string]: ContextPosition;
  };
  activeContext?: string; // NEW
}
```

### Usage Example

```typescript
<AvatarProvider context={{ franchiseId: 'theqriptopian', tenantId: 'main' }}>
  <AvatarHost 
    position="context-aware"
    activeContext={activeContainer}
    contextPositioning={{
      // Full AI assistant mode
      aigent: {
        fullscreen: true,
        position: 'center',
        className: 'p-2 md:p-6',
        mobileOverride: {
          className: 'p-2'
        }
      },
      
      // Embedded in drawer
      pennydrops: {
        position: 'top-right',
        width: 'calc((100vw-92px)/3-40px)',
        height: '400px',
        className: 'rounded-lg overflow-hidden',
        mobileOverride: {
          width: '100%',
          height: '50vh'
        }
      },
      
      // Hidden/minimized (default)
      default: {
        position: 'bottom-right',
        width: '80px',
        height: '80px'
      }
    }}
  />
</AvatarProvider>
```

---

## Lovable Implementation Reference

The Lovable version has this sophisticated positioning logic:

```typescript
{avatarInitialized && (
  <div 
    className={`fixed transition-all duration-300 ${
      activeContainer === 'aigent' 
        ? 'block right-4 top-[96px] left-4 h-[calc(100vh-104px)] md:right-[80px] md:top-[172px] md:left-auto md:w-[calc(100vw-160px)] md:h-[calc(100vh-172px)] opacity-100 z-[100]' 
        : activeContainer === 'pennydrops'
        ? 'block inset-x-0 top-[88px] h-[calc(50vh-88px)] md:right-[92px] md:top-[216px] md:left-auto md:inset-x-auto md:w-[calc((100vw-92px)/3-40px)] md:h-[400px] opacity-100 z-[100] md:rounded-lg overflow-hidden'
        : 'opacity-0 pointer-events-none -z-10'
    }`}
  >
    <div className={`h-full w-full ${activeContainer === 'aigent' ? 'p-2 md:p-6' : 'p-0'}`}>
      <div className={`h-full w-full overflow-hidden ${activeContainer === 'aigent' ? 'rounded-lg border border-border/30 bg-muted/10' : ''}`}>
        <MetaAvatar key={avatarRefreshKey} />
      </div>
    </div>
  </div>
)}
```

**Key Features**:
1. Dynamic positioning based on `activeContainer`
2. Smooth transitions (`transition-all duration-300`)
3. Responsive mobile/desktop layouts
4. Opacity-based show/hide
5. Context-specific styling (padding, borders, backgrounds)

---

## Implementation Plan

### Phase 1: Core API

1. Add `contextPositioning` prop to `AvatarHostProps`
2. Add `activeContext` prop
3. Add position calculation logic
4. Maintain backward compatibility with simple `position` prop

### Phase 2: Layout Engine

1. Create `PositionCalculator` utility
2. Handle responsive breakpoints
3. Implement smooth transitions
4. Add z-index management

### Phase 3: Testing

1. Unit tests for position calculations
2. Integration tests with different contexts
3. Visual regression tests
4. Mobile responsiveness tests

### Phase 4: Documentation

1. Update package README
2. Add Storybook examples
3. Create migration guide
4. Add TypeScript examples

---

## Benefits

### For Franchises

- **Flexible Integration**: Avatars can adapt to franchise-specific layouts
- **Better UX**: Context-aware positioning improves user experience
- **Responsive**: Automatic mobile optimization

### For Developers

- **Declarative API**: Configuration-based positioning
- **Type-Safe**: Full TypeScript support
- **Reusable**: Works across all franchises

---

## Migration Path

### Existing Apps (Backward Compatible)

```typescript
// Old way (still works)
<AvatarHost position="bottom-right" defaultAgent="copilot" />
```

### New Apps (Enhanced)

```typescript
// New way (opt-in)
<AvatarHost 
  position="context-aware"
  activeContext={activeFeature}
  contextPositioning={myContexts}
/>
```

---

## Alternative Approaches Considered

### Option A: Keep in App Code

**Pros**: Faster to implement, app-specific  
**Cons**: Not reusable, duplicated across franchises

### Option B: Separate Package

**Pros**: Highly specialized, optional  
**Cons**: Extra dependency, fragmentation

### Option C: Enhance `@agentiq/avatar-host` ✅ (Recommended)

**Pros**: 
- Single source of truth
- Available to all franchises
- Backward compatible
- Opt-in complexity

**Cons**:
- Increases package complexity
- Requires thorough testing

---

## Estimated Effort

- **Design & API**: 4 hours
- **Implementation**: 12 hours
- **Testing**: 6 hours
- **Documentation**: 4 hours
- **Total**: ~26 hours (~3-4 days)

---

## Priority Rationale

**Medium Priority** because:
1. Current implementation works
2. Can be app-specific for now
3. Enhancement benefits all franchises once implemented
4. Not blocking current development

**Consider for**:
- After MoneyPenny franchise launch
- Before third franchise (KNOW1)
- When pattern is validated across 2+ franchises

---

## Next Steps

1. ✅ Document the enhancement (this file)
2. Get feedback from franchise developers
3. Create GitHub issue in monorepo
4. Schedule for future sprint
5. Implement when 2+ franchises need it

---

## Related Files

- Current Implementation: `/packages/avatar-host/src/AvatarHost.tsx`
- Lovable Reference: `/tmp/lovable-qriptopian/src/components/Layout.tsx` (lines 59-75)
- Package Types: `/packages/avatar-host/src/types.ts`

---

**Decision**: Defer to future enhancement. Use simple positioning for now.
