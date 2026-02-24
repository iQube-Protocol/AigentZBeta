# ✅ Smart Drawer Console - Testing Checklist

## Pre-Deployment Testing

### 🎯 Core Functionality

#### Application Selection
- [ ] Switch between Qriptopian, metaKnyts, MoneyPenny
- [ ] Verify correct fixture data loads for each app
- [ ] Check that drawers update when switching apps
- [ ] Confirm no state leakage between apps

#### Drawer Management
- [ ] Click "+ Add Drawer" creates new drawer
- [ ] New drawer appears in list immediately
- [ ] New drawer auto-selected after creation
- [ ] Drawer cards show correct info (label, tabs, size)
- [ ] Click drawer card selects it
- [ ] Selected drawer highlights with purple border
- [ ] Drawer chevron indicator appears when selected

#### Drawer Configuration
- [ ] Drawer Type dropdown shows all sizes
- [ ] Changing drawer type updates preview
- [ ] Menu Position changes between left/right
- [ ] defaultMenuBehavior saves correctly
- [ ] Tab selection works
- [ ] Tab badges show in drawer list

#### Slot Management
- [ ] "+ Add" button appears when tab selected
- [ ] "+ Add" button creates new slot
- [ ] New slot appears in list
- [ ] New slot appears in preview
- [ ] Slot counter updates correctly
- [ ] Empty state shows when no slots

#### Slot Editing
- [ ] Click pencil icon enables edit mode
- [ ] Input field appears with current label
- [ ] Type new label and press Enter saves
- [ ] Click checkmark saves label
- [ ] ESC cancels edit (if implemented)
- [ ] Click X removes slot
- [ ] Removal requires no confirmation (instant)

#### Slot Reordering
- [ ] Drag grip handle (⋮⋮) appears
- [ ] Click and hold grip to drag
- [ ] Slot highlights during drag
- [ ] Drop slot in new position
- [ ] Order updates in preview
- [ ] Order persists after refresh (if saved)

#### Variant Selection
- [ ] Dropdown shows all variants
- [ ] Filter by modality works
- [ ] Selecting variant updates slot
- [ ] Variant badge shows below dropdown
- [ ] Variant appears in preview

---

### 🖥️ Live Preview

#### Desktop Mode
- [ ] Preview shows at 100% scale
- [ ] Wallet-narrow: 320px width, right-aligned
- [ ] Wallet-wide: 480px width, right-aligned
- [ ] Panel-3q: Extends to left edge, 75% height, top-aligned
- [ ] Immersive-3q: Full width, 75% height, covers menu
- [ ] Modal-centered: Centered with padding
- [ ] Full-immersive: Full screen

#### Mobile Mode
- [ ] Hamburger menu (☰) appears in drawer header
- [ ] Click hamburger opens menu overlay
- [ ] Menu appears on right side
- [ ] All drawers full screen
- [ ] Desktop menu buttons hidden
- [ ] Click drawer icon in mobile menu switches drawer
- [ ] Click backdrop closes mobile menu
- [ ] Drawer switching closes mobile menu

#### TV Mode
- [ ] Preview scales to 1.2x
- [ ] All elements visible
- [ ] Text readable at scale
- [ ] Drawers render correctly
- [ ] No overflow or clipping

#### Drawer Switching
- [ ] Click menu icon opens drawer
- [ ] Click different icon switches drawer
- [ ] Previous drawer closes
- [ ] No toggle behavior (always opens)
- [ ] Active drawer highlighted
- [ ] Close button (X) works

#### Content Rendering
- [ ] Sample content cards render
- [ ] Images load (if using Unsplash)
- [ ] Variant styles apply correctly
- [ ] Scrolling works for long content
- [ ] Empty slots show placeholder

---

### 🤖 Copilot

#### Command Recognition
- [ ] "add hero slot" - adds hero variant
- [ ] "add compact card" - adds compact variant
- [ ] "remove last slot" - removes last slot
- [ ] "add full screen variant" - adds full-immersive
- [ ] Case insensitive matching works
- [ ] Partial matches work

#### Feedback
- [ ] Success message shows after command
- [ ] Error message if no drawer selected
- [ ] Feedback clears after 3 seconds
- [ ] Multiple commands in succession work
- [ ] Press Enter submits command
- [ ] Input clears after submit

---

### 💾 Save & Export

#### Save Functionality
- [ ] Click Save button triggers save
- [ ] Button shows "Saving..." with spinner
- [ ] Button disabled during save
- [ ] Success logged to console (✅)
- [ ] Error shows in banner if save fails
- [ ] Cmd/Ctrl+S keyboard shortcut works
- [ ] Can't double-click during save

#### Export
- [ ] Click Download icon exports JSON
- [ ] File downloads with app name
- [ ] JSON is valid and formatted
- [ ] All data included in export
- [ ] Cmd/Ctrl+E keyboard shortcut works
- [ ] Success logged to console

#### Import
- [ ] Click Upload icon opens file picker
- [ ] Select .json file imports
- [ ] Valid JSON loads successfully
- [ ] Invalid JSON shows error
- [ ] Imported data replaces current
- [ ] Preview updates after import

---

### 🎨 UI/UX

#### Loading States
- [ ] Initial load shows spinner
- [ ] "Loading Smart Drawer Console..." message
- [ ] Gradient background during load
- [ ] Smooth transition to loaded state

#### Error Handling
- [ ] Error banner appears on error
- [ ] Red background with white text
- [ ] XCircle icon visible
- [ ] Error message readable
- [ ] Close button (X) dismisses
- [ ] Banner auto-hides after time (optional)

#### Animations
- [ ] Drawer slide-in smooth
- [ ] Slot add/remove animates
- [ ] Tab switch smooth
- [ ] Device mode switch smooth
- [ ] Button hover states work
- [ ] Focus states visible

#### Responsive Design
- [ ] Works on 1920px+ screens
- [ ] Works on 1440px screens
- [ ] Works on 1024px screens
- [ ] Left panel resizable
- [ ] Layout doesn't break
- [ ] Scroll works where needed

---

### ⌨️ Keyboard Shortcuts

- [ ] Cmd/Ctrl+S saves configuration
- [ ] Cmd/Ctrl+E exports configuration
- [ ] Tab navigation works
- [ ] Enter submits forms
- [ ] ESC closes modals (if any)
- [ ] Shortcuts don't conflict

---

### 🔗 Integration

#### Settings Page
- [ ] Link appears in Quick Actions
- [ ] "Smart Drawer Console" label visible
- [ ] Purple sparkle (✨) icon shows
- [ ] "New" badge visible
- [ ] Click opens console
- [ ] Opens in same tab

#### Navigation
- [ ] Direct URL access works
- [ ] Back button returns to settings
- [ ] Close button (X) works
- [ ] Close returns to home (/)

---

### 📊 Data Persistence

#### Local State
- [ ] Changes persist during session
- [ ] Refresh loses unsaved changes (expected)
- [ ] Import restores state
- [ ] Export captures current state

#### API Integration (when connected)
- [ ] Save persists to backend
- [ ] Load retrieves from backend
- [ ] Concurrent edits handled
- [ ] Conflicts detected

---

### 🐛 Edge Cases

#### Empty States
- [ ] No drawers: Shows empty message
- [ ] No tabs: Shows empty message
- [ ] No slots: Shows "No slots yet" message
- [ ] No triadSet: Shows loading

#### Boundary Conditions
- [ ] 1 drawer works
- [ ] 10+ drawers work
- [ ] 50+ slots in tab work
- [ ] Very long labels handled
- [ ] Special characters in labels

#### Error Recovery
- [ ] Failed save shows error
- [ ] Failed load shows error
- [ ] Network error handled
- [ ] Invalid data rejected
- [ ] Can retry after error

---

### 🔒 Security (for production)

- [ ] Authentication required
- [ ] Unauthorized users redirected
- [ ] Admin role required
- [ ] CSRF protection enabled
- [ ] Input sanitized
- [ ] Output escaped
- [ ] SQL injection prevented
- [ ] XSS prevented

---

### ⚡ Performance

#### Load Time
- [ ] Initial load < 2 seconds
- [ ] Preview renders < 500ms
- [ ] Drawer switch < 200ms
- [ ] Slot add < 100ms

#### Responsiveness
- [ ] No lag during typing
- [ ] Smooth scrolling
- [ ] No janky animations
- [ ] Drag & drop smooth

#### Memory
- [ ] No memory leaks
- [ ] CPU usage reasonable
- [ ] Network requests optimized
- [ ] Images lazy loaded (if applicable)

---

### 🌐 Browser Compatibility

#### Desktop Browsers
- [ ] Chrome 100+
- [ ] Firefox 100+
- [ ] Safari 15+
- [ ] Edge 100+

#### Features
- [ ] CSS Grid works
- [ ] Flexbox works
- [ ] CSS animations work
- [ ] File upload works
- [ ] Download works

---

### 📱 Mobile Testing (if applicable)

- [ ] Touch targets large enough
- [ ] Swipe gestures work
- [ ] Virtual keyboard doesn't break layout
- [ ] Landscape mode works
- [ ] Pinch zoom disabled (if intended)

---

## Testing Workflow

### Smoke Test (5 min)
1. Load console
2. Select Qriptopian
3. Click Article drawer
4. Add hero slot
5. Preview shows hero card
6. Click Save
7. Export JSON
8. ✅ Basic flow works

### Full Test (30 min)
1. Run all core functionality tests
2. Test all device modes
3. Test copilot commands
4. Test save/export/import
5. Check console for errors
6. Test keyboard shortcuts
7. ✅ All features work

### Regression Test (before deploy)
1. Run smoke test
2. Run full test
3. Test on multiple browsers
4. Test on multiple screen sizes
5. Load test with large data
6. Security scan
7. ✅ Ready for production

---

## Bug Report Template

```markdown
### Bug Description
[Clear description of the issue]

### Steps to Reproduce
1. Go to...
2. Click on...
3. See error

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Screenshots
[If applicable]

### Environment
- Browser: Chrome 120
- OS: macOS 14
- URL: /demo/smart-drawer-new
- Console errors: [paste here]

### Severity
- [ ] Critical - Blocks usage
- [ ] High - Major feature broken
- [ ] Medium - Feature degraded
- [ ] Low - Minor issue
```

---

## Sign-Off Checklist

Before marking as "Production Ready":

- [ ] All core functionality tests pass
- [ ] All device modes work
- [ ] No console errors
- [ ] No console warnings
- [ ] Performance acceptable
- [ ] Security reviewed
- [ ] Documentation complete
- [ ] Stakeholder approval

**Tested by:** _____________  
**Date:** _____________  
**Status:** ⬜ Pass | ⬜ Fail | ⬜ Needs Work  

---

*Last Updated: December 6, 2025*
