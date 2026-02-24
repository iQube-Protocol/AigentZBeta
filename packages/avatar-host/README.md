# @agentiq/avatar-host

Global metaAvatar iframe host for persistent agent interface.

## Status

🚧 **In Development** - Being extracted in Phase 5

## Purpose

Provides the persistent agent interface that floats above franchise applications:
- Persistent iframe for agent chat
- Global state management
- Cross-app communication
- Minimizable/expandable UI

## Planned API

```typescript
import { AvatarHost, useAvatar } from '@agentiq/avatar-host';

function App() {
  return (
    <>
      <YourContent />
      <AvatarHost
        position="bottom-right"
        defaultAgent="copilot"
        enablePersistence={true}
      />
    </>
  );
}

function SomeComponent() {
  const { sendMessage, isOpen, toggle } = useAvatar();
  
  return (
    <button onClick={() => {
      sendMessage('Analyze this content');
      toggle();
    }}>
      Ask Agent
    </button>
  );
}
```

## Dependencies

- React 18+
- @agentiq/agentiq-sdk
- postMessage API for iframe communication

## Extraction Source

Will be extracted from:
- Current modal-based AIOverlay in The Qriptopian
- Persistent agent interface patterns from AigentZ

## Documentation

See [Phase 5 Plan](../../docs/phase-5-avatar-host.md) for extraction details.
