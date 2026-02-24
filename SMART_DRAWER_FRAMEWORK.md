# 🎯 Smart Drawer Framework - Unified Configuration & Preview

## Overview

The Smart Drawer Framework provides a unified interface for configuring and previewing Smart Triad drawer systems. This replaces the previous standalone Smart Triad Console with an integrated, production-ready solution.

## 🌐 Access

**URL:** `http://localhost:3000/demo/smart-drawer-new`

## ✨ Features

### 1. **Dynamic Mode Selector**
- **Static**: Fixed configuration, no AI adjustments
- **Suggest**: Copilot recommends changes
- **Adaptive**: Automatically adjusts based on context

### 2. **Drawer Menu Management**
- View all drawer menu items
- See drawer type, tabs, and slots at a glance
- Select drawers to edit details
- Visual indicators for active selection

### 3. **Drawer Detail Editor**
- **Tab Navigation**: Switch between drawer tabs
- **Drawer Type**: Select from 6 drawer sizes
  - `wallet-narrow` - Compact wallet view
  - `wallet-wide` - Expanded wallet
  - `panel-3q` - Three-quarter panel
  - `immersive-3q` - Immersive three-quarter
  - `modal-centered` - Centered modal
  - `full-immersive` - Full screen takeover
- **Slot Management**: View and manage Smart Content slots
- **Quick Link**: Jump to Smart Content Gallery

### 4. **Live Preview Panel**
- **Device Selector**: Desktop, Mobile, TV
- **Menu Rail**: Interactive menu visualization
- **Drawer Preview**: Real-time drawer rendering
- **Smart Content**: Live slot rendering

### 5. **Resizable Layout**
- Adjustable split (40/60 default)
- Collapsible configuration panel
- Full-screen preview mode
- Smooth transitions

### 6. **Copilot Integration**
- Bottom bar with natural language input
- Quick suggestion chips
- Context-aware across all sections
- Sparkles icon for AI indication

### 7. **Configuration Tabs**
- **Drawers**: Main configuration interface
- **Content**: Smart Content variant management
- **API**: Endpoint documentation

## 📁 File Structure

```
app/demo/smart-drawer-new/
└── page.tsx                          # Main unified page

components/smartDrawer/
├── DynamicModeSelector.tsx           # Mode selection component
├── DrawerMenuList.tsx                # Drawer list with details
├── DrawerDetailEditor.tsx            # Detail configuration
├── LivePreviewPanel.tsx              # Live preview with device selector
├── ResizableLayout.tsx               # Split panel layout
└── CopilotBar.tsx                    # Bottom Copilot input

src/smartTriad/
├── model.ts                          # SmartTriadSet type definitions
├── service.ts                        # Load/save operations
├── fixtures.ts                       # Example configurations
└── ui/                               # UI components (menu, drawer, shell)
```

## 🎨 Design System

### Colors
- **Primary**: Purple gradient (`from-purple-500 to-fuchsia-500`)
- **Accent**: Cyan for highlights (`cyan-500`)
- **Background**: Dark slate gradient
- **Borders**: White with opacity

### Typography
- **Headers**: Bold, uppercase tracking
- **Labels**: Semibold with opacity
- **Code**: Monospace font

### Components
- **Buttons**: Rounded, bordered, hover states
- **Cards**: Rounded XL, bordered, bg with opacity
- **Inputs**: Rounded LG, bordered, focus states

## 🔄 State Management

### Local State
- `triadSet`: Current SmartTriadSet configuration
- `selectedApp`: Active application (Qriptopian, metaKnyts, MoneyPenny)
- `selectedDrawerId`: Active drawer for detail editing
- `configTab`: Active configuration tab (drawers/content/api)

### Fixtures
Pre-loaded configurations for:
- **Qriptopian**: Content & media app
- **metaKnyts**: Gaming & collectibles
- **MoneyPenny**: DeFi trading

## 🚀 Usage

### Basic Workflow

1. **Select App**: Choose from dropdown (Qriptopian, metaKnyts, MoneyPenny)
2. **Set Dynamic Mode**: Choose static, suggest, or adaptive
3. **Browse Drawers**: View all drawer menu items
4. **Edit Details**: Select a drawer to configure
   - Choose drawer type
   - Navigate tabs
   - Manage slots
5. **Preview**: See live rendering in right panel
6. **Adjust Device**: Test on desktop, mobile, TV
7. **Use Copilot**: Natural language configuration changes
8. **Save**: Persist changes

### Copilot Examples

```
"Add a wallet section"
"Show my tasks"
"Create rewards tab"
"Hide library"
"Change drawer to panel-3q"
"Add hero slot to article tab"
```

## 🔗 Integration Points

### Smart Content Gallery
- Link in drawer detail editor
- Link in content tab
- Browse 25+ card variants
- Visual variant selection

### API Endpoints
- `/api/drawer/sets` - Get/save drawer sets
- `/api/drawer/resolve` - Resolve slot data
- `/api/copilot/compile` - NL compilation

## 📊 Data Flow

```
User Action → State Update → Re-render
     ↓
Copilot Input → API Call → State Update
     ↓
Save Button → Service Layer → Cache/DB
```

## ✅ Completed Features

- ✅ Dynamic mode selector with descriptions
- ✅ Drawer menu list with tabs and metadata
- ✅ Drawer detail editor with slot management
- ✅ Live preview with device selector
- ✅ Resizable/collapsible layout
- ✅ Copilot bar with suggestions
- ✅ Tab navigation (Drawers/Content/API)
- ✅ Smart Content gallery links
- ✅ Accessibility (titles, aria-labels)
- ✅ Premium styling matching Smart Drawer Demo

## 🎯 Next Steps

1. **Copilot Integration**: Wire up actual Copilot API
2. **Slot Editing**: Add/remove/reorder slots
3. **Menu Behavior Config**: Device-specific menu modes
4. **Real-time Preview**: Live updates as you type
5. **Save to DB**: Persist to actual database
6. **Export Config**: Download JSON configuration
7. **Import Config**: Upload existing configs
8. **Version History**: Track configuration changes

## 🐛 Known Issues

None at this time. All accessibility warnings resolved.

## 📝 Notes

- Current implementation uses fixtures (in-memory)
- Copilot bar is UI-only (not wired to API yet)
- Slot add/remove buttons are visual (not functional yet)
- Device selector affects preview display only

---

**Ready for Testing:** ✅  
**Production Ready:** 🔶 (Core UI complete, API integration pending)  
**Documentation:** ✅
