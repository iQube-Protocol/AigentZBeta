# SmartTriad Copilot Inference Rendering Specification

## Overview

The SmartTriad Copilot Inference Rendering System is an inference-body rendering enhancement for existing legacy copilots. It does **not** replace copilot surfaces, routing, or interaction containers. It applies markdown and Mermaid rendering to assistant inference text inside `CodexCopilotLayer` with per-surface opt-in.

## Version: 1.0.0

---

## 🎨 Design System

### Color Scheme
- **Primary**: System Cyan `hsl(188, 94%, 43%)`
- **Accent**: Cyan variants with hover states
- **Message Types**:
  - User: Cyan background with cyan border
  - Agent: Light gray background with cyan accent
  - System: Warm yellow background with amber border

### Typography
- **Font Family**: System stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)
- **Line Height**: 1.7 for readability
- **Font Size**: 0.95rem base, responsive to 0.9rem on mobile

---

## 🏗️ Architecture

### Core Components

1. **CopilotInferenceBodyRenderer**
   - Assistant message body renderer used inside `CodexCopilotLayer`
   - Handles markdown formatting and Mermaid diagram rendering
   - Falls back safely to plain text when disabled

2. **CodexCopilotLayer (existing, unchanged surface)**
   - Existing floating/embedded copilot container remains the primary runtime UI
   - Opt-in prop: `enableInferenceRendering?: boolean` (default `false`)
   - No replacement by `SmartTriadCopilotLayer` in production surfaces

3. **Scoped CSS Framework**
   - Comprehensive styling system with CSS custom properties
   - Scoped to inference body only
   - Responsive design and accessibility support

### Scope Guardrails (Mandatory)
- Do not swap `CodexCopilotLayer` with `SmartTriadCopilotLayer` in app surfaces.
- Do not introduce global CSS side effects for inference styles.
- Do not change message transport, prompt routing, or wallet/menu behavior.
- Only assistant string content is enhanced; user and panel messages remain unchanged.

---

## 📝 Content Processing Pipeline

### 1. Sanitization & Security
```typescript
// Order: Mermaid protection → HTML cleaning → Mermaid restoration
- Protect Mermaid blocks with regex: /```[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)\r?\n```/g
- Strip HTML div wrappers and break tags
- Restore Mermaid blocks after processing
```

### 2. Markdown Transformation
```typescript
// Header transformations
### Title → "Here's what you need to know about Title:"
## Title → "Let me explain Title:"
# Title → "The key thing about Title:"

// formatting rules
• Bullet points conversion
**bold** → inline processed
Paragraph spacing: \n\n → \n\n\n
Conversational transitions with leading newlines
```

### 3. Inline Processing
- **Key Terms**: Highlight platform terms (iQube, COYN, metaKnyts, etc.)
- **Bold Text**: Semantic bold rendering
- **Inline Code**: Syntax highlighting
- **Images**: Responsive image containers with captions

---

## 🎯 Line-Level Rendering Rules

| Element | Trigger | Styling | Example |
|---------|---------|---------|---------|
| **Bullet Point** | Starts with "• " | Cyan bullet, flex layout | `• Item description` |
| **Numbered List** | Pattern "N. " | Cyan badge, flex layout | `1. First item` |
| **Conversational Intro** | "Here's", "Let me", "The key" | Cyan border, emphasized | `Here's what you need...` |
| **Callout** | "Important:", "Remember:" | Amber background | `Important: Note this` |
| **Blockquote** | Starts with "> " | Cyan border, italic | `> Quoted text` |
| **Paragraph** | Default text | Standard spacing | Regular paragraph |

---

## 🎨 Metadata & Interactive Elements

### Metadata Badge Row
```typescript
interface MetadataBadges {
  mcpVersion?: string;           // "MCP v1.0"
  modelSelector?: boolean;       // Tenant configurable
  profileCard?: PersonaCard;     // Stubbed for future
  timestamp: string;             // "HH:MM format"
}
```

### Score Indicators
```typescript
interface ScoreIndicators {
  trustScore: 1-10;      // Red/Yellow/Green
  reliabilityScore: 1-10; // Red/Yellow/Purple  
  riskScore: 1-10;        // Green/Yellow/Red
  animated: boolean;      // Pulse during processing
}
```

### Model Selector Integration
- **Source**: metaMe Runtime AgentModelSelector component
- **Tenant Control**: Enable/disable, restrict agents, set defaults
- **Future**: Codex customizer and studio integration

---

## 🎭 Mermaid Diagram Support

### Safety & Performance
- **Render Queue**: Sequential processing to prevent conflicts
- **Navigation Guard**: Defers rendering during route transitions
- **Security Validation**: XSS protection, 50K character limit
- **Timeout Guard**: 10-second maximum render time
- **Lazy Loading**: IntersectionObserver for viewport detection

### Styling
```css
.smarttriad-mermaid-container {
  border: 1px solid var(--smarttriad-border);
  border-radius: 0.5rem;
  background: var(--smarttriad-card);
  padding: 1rem;
  margin: 1rem 0;
}
```

---

## 🏢 Tenant Customization

### CSS Custom Properties
```css
:root {
  --smarttriad-primary: hsl(188, 94%, 43%);
  --smarttriad-accent: hsl(188, 94%, 43%);
  --smarttriad-key-term-color: hsl(188, 94%, 43%);
  /* Tenants can override these */
}
```

### Configuration Interface
```typescript
interface TenantConfig {
  enableModelSelection?: boolean;
  availableAgents?: string[];
  defaultAgent?: string;
  accentColor?: string;
}
```

---

## 🔄 Feature Flag Support

### Per-Surface Opt-In
```typescript
<CodexCopilotLayer
  isOpen={isOpen}
  onClose={onClose}
  enableInferenceRendering
/>
```

### Rollout Pattern
- Default remains off globally (`enableInferenceRendering = false`).
- Enable in one target surface first (Studio), then expand incrementally.
- Keep local kill-switch capability at the caller level by removing the prop.

---

## 📱 Responsive Design

### Breakpoints
- **Mobile (< 640px)**: Smaller fonts, wrapped badges, compact spacing
- **Desktop**: Full-featured layout with all metadata

### Accessibility
- Semantic HTML structure
- Keyboard navigation support
- Screen reader compatibility
- High contrast support

---

## 🔧 Implementation Guide

### 1. Basic Usage
```typescript
import { CodexCopilotLayer } from "@/app/components/codex/CodexCopilotLayer";

<CodexCopilotLayer
  isOpen={isOpen}
  onClose={onClose}
  messages={messages}
  enableInferenceRendering
/>
```

### 2. Message Format
```typescript
interface SmartTriadMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    provider?: string;
    trustScore?: number;
    reliabilityScore?: number;
    riskScore?: number;
    theme?: 'iqubes' | 'coyn' | 'learn' | 'earn' | 'connect' | 'aigent';
  };
}
```

### 3. Migration from Legacy
```typescript
// Automatic compatibility layer
const smartTriadMessages = convertToSmartTriadMessages(legacyMessages);
```

---

## 🚀 Deployment Strategy

### Phase 1: Qriptopian (Priority 1)
- Replace CodexCopilotLayer in KnytTab
- Enable with feature flag
- Test with existing KNYT functionality

### Phase 2: KNYT Copilot (Priority 2)  
- Apply to all KNYT copilot instances
- Maintain backward compatibility
- Test payment flow integration

### Phase 3: metaMe Runtime (Priority 3)
- Integrate with existing runtime copilot
- Connect with metaMe AgentModelSelector
- Test runtime-specific features

### Phase 4: Studio (Priority 4)
- Apply to studio environment
- Test with studio workflows
- Complete global rollout

---

## 🎯 Success Metrics

### Performance
- **Render Time**: < 100ms for typical responses
- **Memory Usage**: < 50MB for copilot instances
- **Bundle Size**: < 200KB gzipped

### User Experience
- **Visual Consistency**: Cyan theming across all copilots
- **Readability**: Improved content structure and highlighting
- **Interactivity**: Smooth animations and responsive design

### Developer Experience
- **Easy Integration**: Drop-in replacement for existing copilots
- **Tenant Customization**: Simple CSS and configuration overrides
- **Backward Compatibility**: Seamless migration path

---

## 🎬 SmartTriad Rich Blocks — first-class structured content (2026-09-04)

Promoted from a MoneyPenny-only inline-video experience into a platform-wide primitive
available to every SmartTriad/Codex copilot surface. Full architecture and the exact
non-fabrication ruling live as code comments in the modules below — this section is the
map, not a duplicate of that reasoning.

### Schema and versioning

- **Canonical schema**: `smarttriad.block.v1` (`types/smarttriad/richBlocks.ts`) —
  `SmartTriadRichBlockEnvelope { schemaVersion, id, kind, payload }`. Today only
  `kind: 'media.video'` is implemented (`SmartTriadVideoBlock`); a future kind extends
  this discriminated union rather than forking a second envelope family.
- **Legacy compatibility**: `smarttriad.media.video.v0` (MoneyPenny Cartridge C-15's
  original payload) is normalized into a v1 envelope by
  `normalizeLegacyVideoV0` (`services/smarttriad/richBlocks.ts`) — never a second parser.
  Existing MoneyPenny messages that still embed the v0 fenced JSON keep rendering
  unchanged.
- **Malformed-payload ruling**: a fenced block with NO recognized schema marker is left
  completely alone (ordinary text/code). One that DOES carry a marker but fails
  validation renders an honest "Unsupported or invalid media content" notice — never raw
  JSON, never silently dropped. See `services/smarttriad/richBlocks.ts`'s header comment
  for the full reasoning.

### How a cartridge registers media

A cartridge/journey adds an entry to `SMARTTRIAD_MEDIA_PROVIDERS`
(`services/smarttriad/mediaProviders.ts`) — a `{ id, matches(message, groundContext),
resolve(supabase, message, groundContext) }` triple. `app/api/codex/chat/route.ts`
carries NO cartridge-specific branch; it calls `resolveSmartTriadMedia` once, generically,
against whatever `groundContext` the request already sent. Two providers ship today:

| Provider | Scoping dimension | Source |
|---|---|---|
| `moneypenny.learn-video` | `groundContext.cartridge === 'moneypenny'` | Qriptopian Bridges editorial config (`moneypenny-financial-basics` section) |
| `financial-sovereignty.lesson-video` | `groundContext.surface === 'journey-runtime'` | `FS_PLACEHOLDER_VIDEO_URL` — a real, already-published Studio asset reused across FS bridge lesson stages |

A provider whose trigger matches but has nothing published still short-circuits with an
honest "nothing published yet" message — the LLM is never asked to guess a URL in its
place. The model may never emit a media URL directly; it can, at most, be told about a
registered capability by stable id.

### Transport

Additive to the existing string response: `{ response, blocks?: SmartTriadRichBlockEnvelope[] }`
on both copilot response contracts (`CodexChatResponse` in `CodexCopilotLayer.tsx`,
the equivalent shape `SmartTriadCopilotLayer.tsx` reads). A message with no `blocks`
behaves exactly as before. Legacy fenced-JSON embedding inside `response` remains a
supported compatibility path, extracted by the same shared parser.

### Renderer

One shared player (`components/smarttriad/richblocks/SmartTriadVideoBlockRenderer.tsx`)
and one shared dispatcher (`SmartTriadRichBlockRenderer.tsx`), consumed by BOTH renderer
families:

- `components/smarttriad/copilot/SmartTriadInferenceRenderer.tsx` (mounted by
  `SmartTriadCopilotLayer` — MoneyPenny, DevOn, aigentMe persistent split-panes)
- `app/components/codex/CopilotInferenceBodyRenderer.tsx` (mounted by `CodexCopilotLayer`
  — the floating/embedded shell used across cartridge tabs)

Structured-block rendering does NOT depend on `CodexCopilotLayer`'s
`enableInferenceRendering` flag — that flag continues to govern enhanced Markdown/Mermaid
presentation only. A valid block always renders, on every copilot surface that supports
the shared message contract.

### Security and entitlement boundaries

- `isForbiddenMediaUrl` rejects `javascript:`, `data:`, `vbscript:` schemes on every URL
  field (primary url, poster, captions, `open-document` actions) — never just the
  headline field.
- `access.class` (`public | authenticated | entitled | admin`) gates playback:
  `SmartTriadVideoBlockRenderer` only plays `public` content through the shared native
  `<video>` element; anything else refuses to play inline and names the boundary rather
  than silently attempting playback (CLAUDE.md's Gated Content rules — purchased/entitled
  content still requires the platform's existing `VideoPlayer`/entitlement path).
- Actions are a closed, typed set (`open-cartridge-tab | open-capsule | seek-chapter |
  open-transcript | open-document | continue-prompt`) validated against this enum and,
  for navigation actions, resolved only through the existing
  `tryOpenInMountedCartridge` registry — never a raw URL or free-form instruction.
- Autoplay is never permitted with sound: `muted` is coerced `true` whenever `autoplay`
  is `true`, regardless of what the payload requested.

### Migrating a future v0-only caller

Any future emitter of `smarttriad.media.video.v0` keeps working unmodified — the
compatibility adapter is permanent, not a deprecation window. New server-side media
responses should use the `blocks` transport field directly rather than embedding fenced
JSON in `response`; fenced-JSON emission remains supported only as a legacy path.

### Beyond video — atomic runtime surfaces and capsules (2026-09-04)

The same envelope family now also carries `kind: 'market.edge'`, `kind: 'market.inventory'`, and
`kind: 'capsule'` (a capsule composes already-resolved child envelopes — atomic surfaces or further
capsules — through the SAME validator and the SAME `SmartTriadRichBlockListRenderer`, recursively; no
forked capsule-specific schema or renderer). These were harvested from MoneyPenny002's live-console UI
(`EdgeGauge.tsx`, `InventoryGauge.tsx`) per the "atomic, capsule-composable surfaces" ruling — full
detail, provenance classification, and the sequenced remainder of the harvest in
`codexes/packs/agentiq/updates/2026-09-04_moneypenny002-atomic-surface-capsule-harvest.md`.

Every runtime/market surface carries a `SmartTriadSourceDescriptor` (`class` ∈ `live-market-data |
cached-market-data | delayed-market-data | paper-execution | simulation | historical | unavailable`)
and a `mode` (`simulation | paper | live`) — a value is never presented as live merely because it came
from a database row; "live" requires an actually-identified live provider or receipt-backed execution
source. `services/moneypenny/marketSimulation.ts` is the ONE deterministic, seeded source for every
simulated market value in this codebase — no `Math.random()` in a React component or API route.

### Tranche 2 — quotes, fills, performance, history + the shared session controller

Four more kinds: `market.quotes`, `market.fills`, `market.performance`, `market.history` (harvested
from MoneyPenny002's `QuotesTable.tsx`/`FillsTicker.tsx`/`LiveMarketFeed.tsx`/`CaptureSparkline.tsx`).
`services/moneypenny/marketSessionController.ts` is the one shared, module-singleton, client-side
market session (`useMoneyPennyMarketSession()`) — `HFTConsole.tsx` and the copilot's live
`moneypenny.market-status` capsule (mounted by `SmartTriadRichBlockRenderer.tsx`'s
`LIVE_CAPSULE_COMPONENTS` registry) both read the SAME session: one interval regardless of how many
consumers are mounted, state survives a subscribe/unsubscribe transition, and only an explicit
`restartMarketSession()` resets it. Full detail:
`codexes/packs/agentiq/updates/2026-09-04_moneypenny002-atomic-surface-capsule-harvest.md`'s
"Tranche 2" section.

### Extending with a future rich-block kind

Add the new payload type to `SmartTriadRichBlockPayload`
(`types/smarttriad/richBlocks.ts`), a validator alongside `validateSmartTriadVideoBlock`
in `services/smarttriad/richBlocks.ts`, and a `case` in
`SmartTriadRichBlockRenderer.tsx`'s dispatcher switch — never a second, parallel
extraction/rendering pipeline for the new kind.

---

## 🔮 Future Enhancements

### Planned Features
- **Real-time Collaboration**: Multi-user copilot sessions
- **Voice Integration**: Speech-to-text and text-to-speech
- **Advanced Analytics**: Interaction tracking and insights
- **AI Model Orchestration**: Dynamic model selection based on context

### Integration Points
- **Codex Customizer**: Visual configuration interface
- **Studio Tools**: Copilot management and testing
- **Admin Dashboard**: Tenant analytics and controls

---

## 📚 Resources

### Documentation
- Component API reference
- CSS customization guide
- Migration tutorials

### Support
- Troubleshooting guide
- Best practices documentation
- Community forums

---

**Specification Version**: 1.0.0  
**Last Updated**: 2025-02-24  
**Maintainer**: SmartTriad Development Team
