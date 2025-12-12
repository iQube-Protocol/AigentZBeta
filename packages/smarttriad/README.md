# @agentiq/smarttriad

Smart menu + drawers + layouts for AgentiQ franchises.

## Status

🚧 **In Development** - Being extracted in Phase 4

## Purpose

Provides the core layout primitives for franchise applications:
- Smart menu with dynamic drawer management
- Three primary drawers (content, wallet, agents)
- Config-driven drawer behavior
- Responsive layout system

## Planned API

```typescript
import { SmartTriad, useDrawer } from '@agentiq/smarttriad';

function App() {
  return (
    <SmartTriad
      config={{
        drawers: ['article', 'wallet', 'agents'],
        defaultDrawer: 'article'
      }}
    >
      <YourContent />
    </SmartTriad>
  );
}
```

## Dependencies

- React 18+
- Radix UI primitives
- TailwindCSS

## Extraction Source

Will be extracted from:
- `/components/SmartTriad.tsx` (if exists)
- Relevant layout components from AigentZ

## Documentation

See [Phase 4 Plan](../../docs/phase-4-smarttriad.md) for extraction details.
