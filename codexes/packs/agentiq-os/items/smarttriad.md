# SmartTriad

SmartTriad is the copilot layer that sits across all cartridges. It provides the floating AI assistant panel, inference rendering, and the connection between the user's persona and the active cartridge's chat route.

## Architecture

```
SmartTriad Shell
│
├── SmartTriadCopilotLayer (floating panel, persistent across tabs)
│   ├── Trigger button (bottom-right, cartridge-themed)
│   ├── Chat panel (messages, streaming, inference rendering)
│   └── Persona badge (active persona + trust band)
│
├── CodexCopilotLayer (embedded in specific tabs)
│   └── Used when a tab needs its own inline copilot context
│
└── CopilotInferenceBodyRenderer (markdown + Mermaid + tables)
    ├── Full markdown rendering
    ├── Mermaid diagram rendering (expand/zoom/modal controls)
    └── Code syntax highlighting
```

## Integration Pattern

Every cartridge mounts the `SmartTriadCopilotLayer` at the **cartridge level** (outside the tab content area) so it persists across tab navigation:

```tsx
// In the cartridge viewer page
<div className="flex h-full overflow-hidden">
  <TabContent activeTab={activeTab} />

  <SmartTriadCopilotLayer
    isOpen={copilotOpen}
    onClose={() => setCopilotOpen(false)}
    onOpen={() => setCopilotOpen(true)}
    variant="floating"
    enableInferenceRendering
    contextId="agentiq-os-cartridge"
    personaId={personaId}
    chatRoute="/api/codex/chat/agentiq-os"
    messages={copilotMessages}
    onMessagesChange={setCopilotMessages}
  />
</div>
```

## Props Reference

| Prop | Type | Required | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | ✓ | Controls panel visibility |
| `onClose` | `() => void` | ✓ | Called when user closes panel |
| `onOpen` | `() => void` | ✓ | Called when user opens panel |
| `variant` | `'floating' \| 'inline'` | ✓ | Layout mode |
| `enableInferenceRendering` | `boolean` | — | Enable markdown/Mermaid rendering in messages |
| `contextId` | `string` | ✓ | Copilot context identifier (cartridge slug) |
| `personaId` | `string` | — | Active persona ID (propagated to chat route) |
| `chatRoute` | `string` | — | API route for chat (default: `/api/codex/chat`) |
| `messages` | `CopilotMessage[]` | ✓ | Controlled message state |
| `onMessagesChange` | `(msgs: CopilotMessage[]) => void` | ✓ | Message state updater |

## Inference Rendering

When `enableInferenceRendering` is true, all assistant messages are rendered through `CopilotInferenceBodyRenderer`, which supports:

- Full GitHub-flavored markdown
- Mermaid diagrams (with expand/zoom/download controls)
- Tables, code blocks, blockquotes
- Inline and block formulas

## Message Types

```typescript
interface CopilotMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: {
    personaId?: string
    cartridgeScope?: string
    delegationActive?: boolean
    policyEnvelopeHash?: string
  }
}
```

## Accessing From a Tab

A tab can open the cartridge-level copilot by reading context or using a shared state mechanism. The standard pattern is to pass `onOpenCopilot` as a prop from the cartridge viewer down to tabs that need a CTA button:

```tsx
// Tab component
function MyTab({ onOpenCopilot }: { onOpenCopilot?: () => void }) {
  return (
    <button onClick={onOpenCopilot}>
      Ask Aigent C-OS
    </button>
  );
}
```

## Security Considerations

- The chat route (`chatRoute` prop) is called with the `personaId` and cartridge scope in every request
- The DelegationGuard on the server side enforces the PolicyEnvelope independently of the UI
- The copilot panel does not store messages in localStorage by default — session-only state
- System prompt contents are never returned in API responses
