# SmartTriad Copilot Inference Rendering Specification

## Overview

The SmartTriad Copilot Inference Rendering System is a global default for all SmartTriad copilot implementations across the platform. It replaces the Aigent Nakamoto orange color scheme with system Cyan and provides advanced inference rendering capabilities with tenant customization support.

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

1. **SmartTriadInferenceRenderer**
   - Main rendering component for AI responses
   - Handles content processing and line-level rendering
   - Supports metadata badges and score indicators

2. **SmartTriadCopilotLayer**
   - Complete copilot interface with floating/embedded variants
   - Integrates model selector and tenant configuration
   - Provides backward compatibility with legacy CopilotMessage format

3. **CSS Framework**
   - Comprehensive styling system with CSS custom properties
   - Tenant override capabilities
   - Responsive design and accessibility support

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

### Environment Variables
```bash
NEXT_PUBLIC_SMARTTRIAD_COPILOT_V2=true
```

### Runtime Control
```typescript
// Check if enabled
const isEnabled = isSmartTriadCopilotEnabled();

// Local storage override
localStorage.setItem('smarttriad_copilot_v2', 'true');
```

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
import { SmartTriadCopilotLayer } from "@/components/smarttriad/copilot";

<SmartTriadCopilotLayer
  isOpen={isOpen}
  onClose={onClose}
  messages={messages}
  enableAdvancedRendering={true}
  tenantConfig={{
    enableModelSelection: true,
    accentColor: 'hsl(188, 94%, 43%)'
  }}
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
