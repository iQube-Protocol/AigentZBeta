# ArticleReader Primitive & Franchise Style Guide System

## Issue Identified
Issue #0 v0.1 includes "read" modality articles but lacks a dedicated ArticleReader primitive for displaying formatted text content in a popup/modal aligned with The Qriptopian franchise aesthetic.

---

## ArticleReader Primitive Specification

### Component Purpose
Display long-form text articles with franchise-specific formatting, typography, and presentation rules.

### Requirements

**1. Modal/Popup Interface**
```typescript
interface ArticleReaderProps {
  article: ArticleQube;
  isOpen: boolean;
  onClose: () => void;
  franchiseStyle?: FranchiseStyleGuide;
}
```

**2. Content Formatting**
- **Markdown Support**: Parse and render markdown content
- **HTML Support**: Safe HTML rendering with sanitization
- **Typography**: Franchise-specific font families, sizes, line heights
- **Color Scheme**: Franchise brand colors for headings, links, highlights
- **Spacing**: Consistent paragraph spacing, section breaks

**3. Reading Experience Features**
- **Reading Progress**: Visual indicator of scroll position
- **Estimated Reading Time**: Display at top
- **Table of Contents**: Auto-generated from headings (optional)
- **Font Size Control**: Reader can adjust text size
- **Theme Toggle**: Light/dark mode per franchise
- **Bookmark**: Save reading position
- **Print View**: Clean print stylesheet

**4. Integration Points**
- Triggered from modality buttons (BookOpen icon)
- Receives ArticleQube with `read` modality content
- Renders within same z-index layer as media modals (z-[9999])
- Closes via X button, ESC key, or backdrop click

---

## Franchise Style Guide System

### Purpose
Define and enforce brand-specific styling rules across all content primitives (ArticleReader, metaVatar, SmartTriad drawers, etc.)

### FranchiseStyleGuide Interface

```typescript
interface FranchiseStyleGuide {
  franchiseId: string;  // 'theqriptopian', 'moneypenny', etc.
  version: string;      // '0.1', '1.0', etc.
  
  // Brand Colors
  colors: {
    primary: string;        // e.g., 'cyan-400'
    secondary: string;      // e.g., 'teal-400'
    accent: string;         // e.g., 'purple-500'
    background: string;     // e.g., '#020818'
    text: string;           // e.g., '#d0f6ff'
    muted: string;          // e.g., '#6b7280'
    border: string;         // e.g., '#1a2942'
  };
  
  // Typography
  typography: {
    fontFamily: {
      heading: string;      // e.g., 'Inter, sans-serif'
      body: string;         // e.g., 'Inter, sans-serif'
      code: string;         // e.g., 'JetBrains Mono, monospace'
    };
    fontSize: {
      h1: string;           // e.g., '2.5rem'
      h2: string;           // e.g., '2rem'
      h3: string;           // e.g., '1.5rem'
      body: string;         // e.g., '1rem'
      small: string;        // e.g., '0.875rem'
    };
    lineHeight: {
      heading: number;      // e.g., 1.2
      body: number;         // e.g., 1.6
      code: number;         // e.g., 1.4
    };
  };
  
  // Article Reader Styles
  articleReader: {
    maxWidth: string;       // e.g., '42rem' (readable line length)
    padding: string;        // e.g., '2rem'
    backgroundColor: string;
    textColor: string;
    linkColor: string;
    linkHoverColor: string;
    codeBlockBackground: string;
    codeBlockBorder: string;
    blockquoteBorder: string;
    blockquoteBackground: string;
  };
  
  // SmartTriad Drawer Styles
  drawer: {
    backgroundColor: string;
    backdropBlur: string;
    borderColor: string;
    tabActiveColor: string;
    tabInactiveColor: string;
  };
  
  // Badge Styles (for content items)
  badges: {
    [key: string]: {
      background: string;
      text: string;
      border?: string;
    };
  };
}
```

---

## The Qriptopian Style Guide (v0.1)

### Reference Implementation

```typescript
export const theQriptopianStyleGuide: FranchiseStyleGuide = {
  franchiseId: 'theqriptopian',
  version: '0.1',
  
  colors: {
    primary: 'cyan-400',
    secondary: 'teal-400',
    accent: 'purple-500',
    background: '#020818',
    text: '#d0f6ff',
    muted: '#6b7280',
    border: '#1a2942',
  },
  
  typography: {
    fontFamily: {
      heading: 'Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
      code: 'JetBrains Mono, Consolas, monospace',
    },
    fontSize: {
      h1: '2.5rem',      // 40px
      h2: '2rem',        // 32px
      h3: '1.5rem',      // 24px
      body: '1.125rem',  // 18px (larger for readability)
      small: '0.875rem', // 14px
    },
    lineHeight: {
      heading: 1.2,
      body: 1.7,   // Generous line height for long-form reading
      code: 1.5,
    },
  },
  
  articleReader: {
    maxWidth: '42rem',  // ~672px (optimal line length)
    padding: '3rem 2rem',
    backgroundColor: '#0a1628',
    textColor: '#d0f6ff',
    linkColor: '#5eead4',  // cyan-300
    linkHoverColor: '#2dd4bf',  // teal-400
    codeBlockBackground: '#1e293b',
    codeBlockBorder: '#334155',
    blockquoteBorder: '#5eead4',  // cyan-400
    blockquoteBackground: 'rgba(94, 234, 212, 0.05)',
  },
  
  drawer: {
    backgroundColor: 'rgba(2, 8, 24, 0.8)',
    backdropBlur: 'xl',
    borderColor: 'rgba(26, 41, 66, 0.3)',
    tabActiveColor: '#5eead4',  // cyan-400
    tabInactiveColor: '#6b7280',
  },
  
  badges: {
    'Q¢': {
      background: 'rgba(94, 234, 212, 0.8)',  // cyan-400/80
      text: '#ffffff',
    },
    'LIVE': {
      background: 'rgba(239, 68, 68, 0.8)',  // red-500/80
      text: '#ffffff',
    },
    'COMIC': {
      background: 'rgba(168, 85, 247, 0.8)',  // purple-500/80
      text: '#ffffff',
    },
    'DEV': {
      background: 'rgba(59, 130, 246, 0.8)',  // blue-500/80
      text: '#ffffff',
    },
  },
};
```

---

## ArticleReader Component Implementation Outline

### File Structure
```
packages/article-reader/
├── package.json
├── tsconfig.json
├── src/
│   ├── ArticleReader.tsx       # Main component
│   ├── MarkdownRenderer.tsx    # Markdown parsing
│   ├── ArticleControls.tsx     # Font size, theme toggle
│   ├── ReadingProgress.tsx     # Scroll progress indicator
│   ├── types.ts                # Interfaces
│   └── index.ts                # Exports
```

### Key Features

**1. Markdown Rendering**
```typescript
// Use react-markdown or similar
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeRaw, rehypeSanitize]}
  components={customComponents}  // Apply franchise styles
>
  {article.content}
</ReactMarkdown>
```

**2. Custom Components for Franchise Styling**
```typescript
const customComponents = {
  h1: ({ children }) => (
    <h1 style={{ 
      fontSize: styleGuide.typography.fontSize.h1,
      color: styleGuide.colors.primary,
      marginBottom: '1.5rem',
    }}>
      {children}
    </h1>
  ),
  // ... h2, h3, p, a, code, blockquote, etc.
};
```

**3. Reading Controls**
```typescript
<div className="article-controls">
  <button onClick={decreaseFontSize}>A-</button>
  <button onClick={increaseFontSize}>A+</button>
  <button onClick={toggleTheme}>🌙/☀️</button>
  <button onClick={onClose}>✕</button>
</div>
```

**4. Reading Progress Bar**
```typescript
const [scrollProgress, setScrollProgress] = useState(0);

useEffect(() => {
  const handleScroll = () => {
    const scrolled = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    setScrollProgress((scrolled / height) * 100);
  };
  
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);

<div className="fixed top-0 left-0 right-0 h-1 bg-background z-[10000]">
  <div 
    className="h-full bg-primary transition-all duration-150"
    style={{ width: `${scrollProgress}%` }}
  />
</div>
```

---

## Integration with SmartTriad System

### Adding Style Guide to SmartTriad

**Extend SmartTriad Package:**
```typescript
// packages/smarttriad/src/types.ts
import type { FranchiseStyleGuide } from '@agentiq/article-reader';

export interface SmartTriadConfig {
  domains: Domain[];
  styleGuide: FranchiseStyleGuide;
}

// packages/smarttriad/src/DrawerLayer.tsx
interface DrawerLayerProps {
  // ... existing props
  styleGuide?: FranchiseStyleGuide;
}

// Apply styleGuide to drawer background, borders, tabs, etc.
```

**Franchise-Specific Initialization:**
```typescript
// apps/theqriptopian-web/src/App.tsx
import { theQriptopianStyleGuide } from './config/style-guide';

<SmartTriadProvider styleGuide={theQriptopianStyleGuide}>
  <ArticleReaderProvider styleGuide={theQriptopianStyleGuide}>
    {/* App content */}
  </ArticleReaderProvider>
</SmartTriadProvider>
```

---

## Implementation Priority

### Phase 5.5 (Immediate - after AvatarHost)
1. **Create @agentiq/article-reader package**
   - ArticleReader component
   - MarkdownRenderer with franchise styling
   - ReadingProgress, ArticleControls
   
2. **Create style guide system**
   - FranchiseStyleGuide interface
   - theQriptopianStyleGuide implementation
   - StyleGuideProvider context

3. **Integrate with existing modality system**
   - Wire "Read" button to open ArticleReader
   - Pass article content and franchise style
   - Test with sample articles from each domain

### Phase 6+ (Enhancement)
4. **Extend SmartTriad with style guide support**
   - Apply franchise styles to drawers
   - Apply to IconBar, metaVatar
   
5. **Style guide tooling**
   - Visual style guide editor (admin tool)
   - Export/import style guides
   - Theme preview mode

---

## Example Usage

```typescript
import { ArticleReader } from '@agentiq/article-reader';
import { theQriptopianStyleGuide } from '@/config/style-guide';

function ContentViewer() {
  const [readArticle, setReadArticle] = useState<ArticleQube | null>(null);
  
  return (
    <>
      <button onClick={() => setReadArticle(article)}>
        <BookOpen /> Read
      </button>
      
      <ArticleReader
        article={readArticle}
        isOpen={!!readArticle}
        onClose={() => setReadArticle(null)}
        franchiseStyle={theQriptopianStyleGuide}
      />
    </>
  );
}
```

---

## Notes for Future Franchises

Each franchise (MoneyPenny, Know1, etc.) will:
1. Define their own `FranchiseStyleGuide` object
2. Use the same ArticleReader component
3. Get automatically styled content with their brand

This ensures:
- ✅ Consistent reading experience across franchises
- ✅ Brand differentiation through style guides
- ✅ Reusable components
- ✅ Easy maintenance (update ArticleReader once, benefits all)

---

**Status**: Specification complete, awaiting implementation  
**Package Name**: `@agentiq/article-reader`  
**Blocked By**: None (can start immediately)  
**Depends On**: None (standalone package)  
**Date**: 2025-12-07
