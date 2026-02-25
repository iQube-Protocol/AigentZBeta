# SmartContent Integration Guide for agentiQ KNYT Codex

## 🚀 **Integration Steps**

### **1. Add SmartContentActionProvider to Layout**

Wrap your app with the SmartContentActionProvider to enable global action handling:

```typescript
// app/layout.tsx or app/(shell)/layout.tsx
import { SmartContentActionProvider } from '@/contexts/SmartContentActionContext';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmartContentActionProvider>
      {children}
    </SmartContentActionProvider>
  );
}
```

### **2. Update Content Components to Use Context**

Replace manual action handlers with the global context:

```typescript
// Before (manual handling)
const [shareModalOpen, setShareModalOpen] = useState(false);
const handleShare = () => setShareModalOpen(true);

// After (global context)
import { useSmartContentHandler } from '@/hooks/useSmartContentAction';

const MyContentComponent = ({ item }) => {
  const onAction = useSmartContentHandler(item);
  
  return (
    <SmartContentActions
      modalities={item.modalities}
      onAction={onAction}
      context="card"
      showShare={true}
    />
  );
};
```

### **3. Update KnytTab Integration**

```typescript
// app/triad/components/codex/tabs/KnytTab.tsx
import { SmartContentActions, hasPlayableContent, getPrimaryAction } from '@/components/content/SmartContentActions';
import { useSmartContentHandler } from '@/hooks/useSmartContentAction';

export function KnytTab() {
  // ... existing code
  
  return (
    <div>
      {contentItems.map(item => (
        <div key={item.id}>
          {/* Your existing content rendering */}
          
          {/* SmartContentActions with global context */}
          <SmartContentActions
            modalities={item.modalities}
            onAction={useSmartContentHandler(item, contentItems)}
            context="card"
            showShare={true}
            showExpand={true}
          />
        </div>
      ))}
    </div>
  );
}
```

---

## 🎯 **Available Features**

### **SmartContentActions Features**
- ✅ **Context-aware filtering** - Only shows relevant actions
- ✅ **Intelligent availability** - Checks for actual content
- ✅ **Helper functions** - `hasPlayableContent()`, `hasReadableContent()`, `getPrimaryAction()`
- ✅ **Multiple contexts** - 'thumbnail', 'hero', 'card', 'fullscreen', 'drawer'

### **SocialSharing Integration**
- ✅ **Automatic tracking** - Shares are tracked in `/api/social/track`
- ✅ **Reward integration** - Herald of Order rewards automatically distributed
- ✅ **Platform support** - X, LinkedIn, Facebook, WhatsApp, Telegram, Copy Link
- ✅ **Persona tracking** - Automatic persona resolution and attribution

### **Global Modal Management**
- ✅ **Video modal** - Playlist support with navigation
- ✅ **Article reader** - Simplified text content viewer
- ✅ **PDF viewer** - Full PDF integration
- ✅ **Social sharing modal** - Platform selection with tracking

---

## 🔧 **Usage Examples**

### **Basic Content Card**
```typescript
import { SmartContentActions } from '@/components/content/SmartContentActions';
import { useSmartContentHandler } from '@/hooks/useSmartContentAction';

function ContentCard({ item }) {
  const onAction = useSmartContentHandler(item);
  
  return (
    <div className="content-card">
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      
      <SmartContentActions
        modalities={item.modalities}
        onAction={onAction}
        context="card"
      />
    </div>
  );
}
```

### **Content Grid with Playlist**
```typescript
function ContentGrid({ items }) {
  return (
    <div className="grid">
      {items.map(item => (
        <ContentCard 
          key={item.id} 
          item={item}
          onAction={useSmartContentHandler(item, items)}
        />
      ))}
    </div>
  );
}
```

### **Conditional Rendering**
```typescript
import { hasPlayableContent, hasReadableContent } from '@/components/content/SmartContentActions';

function ContentItem({ item }) {
  const isPlayable = hasPlayableContent(item.modalities);
  const isReadable = hasReadableContent(item.modalities);
  const primaryAction = getPrimaryAction(item.modalities);
  
  return (
    <div className={`content-item ${isPlayable ? 'playable' : ''} ${isReadable ? 'readable' : ''}`}>
      {/* Custom rendering based on content type */}
    </div>
  );
}
```

---

## 📊 **Integration Checklist**

### **Required Files Created:**
- [x] `app/contexts/SmartContentActionContext.tsx`
- [x] `app/hooks/useSmartContentAction.ts`
- [x] `app/services/personaService.ts`
- [x] `packages/smarttriad/src/socialSharing.ts`

### **Files Updated:**
- [x] `packages/smarttriad/src/types.ts` (added SmartContent types)
- [x] `app/components/content/SmartContentActions.tsx` (enhanced version)

### **Integration Steps:**
- [ ] Add `SmartContentActionProvider` to app layout
- [ ] Update content components to use `useSmartContentHandler`
- [ ] Replace manual modal management with global context
- [ ] Test social sharing and reward tracking
- [ ] Verify persona resolution works correctly

---

## 🎊 **Expected Results**

After integration, the agentiQ KNYT Codex will have:

- ✅ **Parity with Netlify deployment** - All SmartContent features available
- ✅ **Enhanced user experience** - Context-aware actions and intelligent filtering
- ✅ **Complete social sharing** - Full rewards integration with automatic tracking
- ✅ **Unified architecture** - Consistent behavior across all content components
- ✅ **Advanced analytics** - Comprehensive share and engagement tracking
- ✅ **Gamification** - Full Herald of Order reward system integration

---

## 🔍 **Testing Checklist**

### **Functionality Tests:**
- [ ] SmartContentActions show correct buttons based on modalities
- [ ] Context-aware filtering works properly
- [ ] Share actions open social sharing modal
- [ ] Video/audio content plays in global modal
- [ ] Text content opens in article reader
- [ ] PDF content opens in PDF viewer

### **Integration Tests:**
- [ ] Persona resolution works automatically
- [ ] Share tracking sends data to `/api/social/track`
- [ ] Rewards are distributed correctly
- [ ] Campaign events are emitted
- [ ] Deep links work with persona tracking

### **UI/UX Tests:**
- [ ] Actions are responsive and accessible
- [ ] Modals open/close correctly
- [ ] Loading states work properly
- [ ] Error handling is graceful
- [ ] Mobile experience is optimized

---

*Integration Guide Date: February 2025*  
*Version: 1.0*  
*Target: agentiQ KNYT Codex*
