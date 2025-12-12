# Naming Clarification: metaVatar

**Date**: December 7, 2025  
**Context**: Phase 2 implementation refinement

---

## ✅ Changes Made

### File Renamed
```
apps/theqriptopian-web/public/
  avatar.html  →  metavatar.html
```

### Code References Updated

**AvatarFrame.tsx**:
```typescript
// Before
const avatarUrl = `/avatar.html?agent=${agentId}`;

// After
// metaVatar is our specific avatar primitive for persistent agent interfaces
const metavatarUrl = `/metavatar.html?agent=${agentId}`;
```

### Documentation Updated

**PHASE_2_SUMMARY.md**: All references changed from `avatar.html` to `metavatar.html`

---

## 🎯 Rationale

**metaVatar** is a **specific avatar primitive** in the AgentiQ platform, not a generic avatar component.

### What is metaVatar?

metaVatar is our term for the **persistent agent interface** that:
- Lives in an iframe for isolation
- Maintains state across navigation
- Supports multi-modal interaction (text, voice, video)
- Uses postMessage protocol for communication
- Can host 3D avatars, voice interfaces, and gestures
- **Is iQube and Aigent protocol enabled and compliant**
- Implements **contentQube** and **AigentQube** primitives

### Naming Hierarchy

```
Avatar (generic concept)
  └── metaVatar (our specific primitive)
      ├── Visual representation (3D, 2D, icon)
      ├── Voice interface
      ├── Gesture system
      └── Persistent state
```

### Why "meta"?

- **Meta-level**: Operates above the application layer
- **Persistent**: Maintains context across app navigation
- **Universal**: Works across all franchises
- **Protocol-driven**: Uses standardized communication

---

## 📁 Current Structure

```
apps/theqriptopian-web/
├── src/components/metaVatar/
│   └── AvatarFrame.tsx          # Component that hosts metaVatar
└── public/
    └── metavatar.html           # metaVatar interface (placeholder)
```

**Component naming**:
- `AvatarFrame` = Container/host for the metaVatar
- `metavatar.html` = The actual metaVatar interface

---

## 🔮 Future Clarity

When we extract to `@agentiq/avatar-host` package in Phase 5:

```typescript
// Package: @agentiq/avatar-host
export { AvatarHost } from './AvatarHost';      // Generic host
export { MetaVatarFrame } from './MetaVatarFrame';  // metaVatar specific

// Usage in franchises
import { MetaVatarFrame } from '@agentiq/avatar-host';

<MetaVatarFrame
  agentId="nakamoto"
  src="/metavatar.html"  // or remote URL
/>
```

---

## 🎓 Terminology Guide

| Term | Meaning | Scope |
|------|---------|-------|
| **Avatar** | Generic visual/interactive representation | Industry-wide |
| **metaVatar** | AgentiQ's persistent agent interface primitive | AgentiQ platform |
| **AvatarFrame** | Component that hosts avatar interfaces | Component name |
| **AvatarHost** | Package for hosting avatar interfaces | Package name |
| **Agent** | The AI intelligence behind the avatar | Core concept |

---

## ✅ Build Verification

```bash
$ pnpm --filter @agentiq/theqriptopian-web build

✓ 1976 modules transformed
✓ Built in 17.66s
✓ No errors
```

**Result**: All references updated successfully, build passes.

---

## Document Metadata

- **Version**: 1.0.0
- **Type**: Naming clarification
- **Scope**: metaVatar primitive
- **Status**: ✅ Complete
- **Date**: December 7, 2025

---

**Clarification complete**: `metavatar.html` and all references updated to reflect metaVatar as a specific AgentiQ avatar primitive.
