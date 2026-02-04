# 🚀 Smart Drawer Console - Quick Start Guide

## 5-Minute Setup

### Step 1: Access the Console

**From Settings:**
1. Navigate to `/settings` in your app
2. Find "Quick Actions" panel on the left
3. Click "✨ Smart Drawer Console"

**Direct Link:**
- Development: `http://localhost:3000/demo/smart-drawer-new`
- Production: `https://yourdomain.com/demo/smart-drawer-new`

---

### Step 2: Select Your Application

At the top of the page, use the dropdown to select:
- **Qriptopian** - Publishing & reading platform
- **metaKnyts** - Creator & community platform  
- **MoneyPenny** - DeFi & trading platform

Each app has pre-configured drawers to get you started.

---

### Step 3: Configure a Drawer

**Left Panel - Select Drawer:**
1. Click on **Article** drawer (or any other)
2. Configuration panel appears in middle

**Middle Panel - Configure:**
1. Choose **Drawer Type** (e.g., `panel-3q`)
2. Set **Menu Position** (left or right)
3. Select a **Tab** (e.g., "Read")

---

### Step 4: Add Content Slots

1. Click the **"+ Add"** button
2. A new slot appears
3. Select variant from dropdown (hero, compact, etc.)
4. Repeat to add more slots

**Pro Tip:** Drag the grip handle (⋮⋮) to reorder slots!

---

### Step 5: Preview Your Changes

**Right Panel - Live Preview:**
- See your drawer in action
- Click the menu icons on the right to open different drawers
- Switch between device modes:
  - 🖥️ **Desktop** - Standard view
  - 📱 **Mobile** - Full screen with hamburger menu
  - 📺 **TV** - Scaled up view

---

### Step 6: Save Your Work

**Options:**
- Click **"Save"** button (or press Cmd/Ctrl+S)
- Click **Download** icon to export JSON backup
- Use **Upload** icon to import saved configs

---

## Common Tasks

### Add a New Drawer

1. Click **"+ Add Drawer"** at top of drawer list
2. New drawer appears and auto-selects
3. Configure drawer type, position, and tabs
4. Add slots to populate content

### Edit Slot Labels

1. Find slot in middle panel
2. Click **pencil icon** (✏️)
3. Type new name
4. Press **Enter** or click checkmark

### Remove a Slot

1. Find slot in middle panel
2. Click **X** button
3. Slot removed immediately (no confirmation)

### Change Drawer Size

1. Select drawer from list
2. Find "Drawer Type" dropdown
3. Choose size:
   - `wallet-narrow` - 320px sidebar
   - `wallet-wide` - 480px sidebar
   - `panel-3q` - 75% height panel
   - `immersive-3q` - 75% full-width
   - `modal-centered` - Centered modal
   - `full-immersive` - Full screen

### Use Natural Language Copilot

At the bottom of the screen, type commands:

```
add hero slot
add compact card
remove last slot
add carousel variant
```

Press **Enter** to execute. Works with the currently selected drawer!

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save configuration |
| `Cmd/Ctrl + E` | Export to JSON |
| `Enter` | Submit copilot command |

---

## Tips & Tricks

### 🎨 Design Best Practices

1. **Start with Templates** - Use existing drawers as reference
2. **Mobile First** - Test mobile view early
3. **Limit Slots** - 3-5 slots per tab is optimal
4. **Use Variants Wisely** - Match variant to content type
5. **Preview Often** - Check live preview after each change

### 🔍 Finding Content Variants

Click **"Content"** tab in left panel to see:
- Available variant types
- Variant descriptions
- Visual examples

Or click **"Browse Smart Content Gallery"** to explore all options.

### 💾 Backup Strategy

1. Export JSON after major changes
2. Name files descriptively: `qriptopian-investor-2024-12-06.json`
3. Keep backups in version control
4. Import to restore if needed

### 🐛 Troubleshooting

**Drawer won't open?**
- Ensure drawer has at least one tab
- Check that tab has valid content
- Look for console errors

**Slots not showing?**
- Verify tab is selected
- Check that slot has variant assigned
- Refresh preview panel

**Save not working?**
- Check console for errors
- Verify backend API is running
- Try exporting as backup

---

## Example Workflow

### Creating an Investor Dashboard

**Goal:** Build a wallet drawer for investors

**Steps:**

1. **Create Drawer**
   - Click "+ Add Drawer"
   - Rename to "Portfolio"
   
2. **Configure Size**
   - Set type to `wallet-wide` (480px)
   - Position: `right`

3. **Add Overview Tab**
   - Rename tab to "Overview"
   - Add `wallet-overview` slot
   
4. **Add Holdings Tab**
   - Add new tab "Holdings"
   - Add `wallet-tasks` slot
   - Add `compact` card slots for each asset

5. **Preview**
   - Click wallet icon in preview
   - Test on mobile mode
   - Verify scrolling works

6. **Save**
   - Click Save button
   - Export JSON backup
   - ✅ Done!

---

## Next Steps

### Learn More
- Read full **Deployment Guide**: `SMART_DRAWER_DEPLOYMENT_GUIDE.md`
- Review **Testing Checklist**: `SMART_DRAWER_TESTING_CHECKLIST.md`
- Check **API Integration** section for backend setup

### Advanced Features
- Set up backend API endpoints
- Enable authentication
- Add custom content variants
- Implement A/B testing configs

### Get Help
- Check browser console for errors
- Review error banner messages
- Consult documentation files
- Ask team for support

---

## Summary

You've learned how to:
- ✅ Access the Smart Drawer Console
- ✅ Select and configure drawers
- ✅ Add and manage content slots
- ✅ Use live preview across devices
- ✅ Save and export configurations
- ✅ Use natural language commands

**Time to first drawer: 5 minutes** ⚡

Ready to build something amazing! 🎉

---

*Last Updated: December 6, 2025*
*Version: 1.0.0*
