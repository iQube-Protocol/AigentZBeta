# SmartTriad Embeddable Micro-Frontend - Integration Guide

## Overview

The SmartTriad UI (Wallet + Codex + Codex Admin) has been extracted into embeddable routes that can be integrated into any host application (like Lovable Qriptopian) via iframes or JavaScript widgets.

**Key Principle:** The canonical SmartTriad UI lives in this Netlify Qriptopian app. Host applications embed it rather than duplicating the logic.

**Architecture:** The embed routes render **self-contained panels** that fill their container (iframe, drawer, etc.) using `h-full w-full min-h-screen`. The host application controls the drawer/modal/page chrome, while the embed provides the content.

---

## Available Embed Routes

### 1. **Wallet Embed**
- **URL:** `/triad/embed/wallet`
- **Full URL:** `https://theqriptopian.netlify.app/triad/embed/wallet`
- **Description:** Self-contained SmartWallet panel with x402 payments, KNYT, Q¢, USDC, and persona management
- **Auth:** Uses Supabase session cookies (user must be logged in)

### 2. **Codex Embed**
- **URL:** `/triad/embed/codex?tab=scrolls`
- **Full URL:** `https://theqriptopian.netlify.app/triad/embed/codex?tab=scrolls`
- **Description:** Full-screen KNYT Codex with episode browsing, Kn0w1 copilot, and content viewing
- **Query Params:**
  - `tab` (optional): `scrolls` | `characters` | `lore` | `digiterra` | `terra` | `order`
- **Auth:** Uses Supabase session cookies

### 3. **Admin Dashboard Embed**
- **URL:** `/triad/admin`
- **Full URL:** `https://theqriptopian.netlify.app/triad/admin`
- **Description:** Full content management dashboard with all admin cards
- **Auth:** Requires admin privileges (checked via `useIsAdminAA` hook)

### 4. **Codex Manager Embed**
- **URL:** `/triad/admin/codex?codex=knyt`
- **Full URL:** `https://theqriptopian.netlify.app/triad/admin/codex?codex=knyt`
- **Description:** Codex Manager only with Autonomys upload functionality
- **Query Params:**
  - `codex` (optional): `knyt` | `qriptopian`
- **Auth:** Requires admin privileges

---

## Integration Methods

### Method 1: iFrame Embedding (Recommended for MVP)

**Advantages:**
- Zero code duplication
- Instant updates when Netlify app is updated
- Complete isolation (no style conflicts)
- Works with any framework

**Example - Wallet in Lovable:**

```tsx
// In your Lovable drawer component
<iframe
  src="https://theqriptopian.netlify.app/triad/embed/wallet"
  style={{
    width: "100%",
    height: "100%",
    border: "none",
    background: "#050816"
  }}
  allow="clipboard-read; clipboard-write"
/>
```

**Example - Codex in Lovable:**

```tsx
<iframe
  src="https://theqriptopian.netlify.app/triad/embed/codex?tab=scrolls"
  style={{
    width: "100%",
    height: "100%",
    border: "none",
    background: "#050816"
  }}
/>
```

**Example - Admin Codex Manager:**

```tsx
<iframe
  src="https://theqriptopian.netlify.app/triad/admin/codex"
  style={{
    width: "100%",
    height: "100%",
    border: "none",
    background: "#050816"
  }}
/>
```

---

### Method 2: JavaScript Widget (Future Enhancement)

**Status:** Not yet implemented (Phase 2)

**Planned API:**

```html
<!-- Include widget script -->
<script src="https://theqriptopian.netlify.app/widgets/triad-widget.js"></script>

<script>
  // Initialize
  window.SmartTriad.init({
    apiBaseUrl: "https://your-aa-api.com",
    theme: "dark"
  });

  // Mount wallet
  const walletContainer = document.getElementById("wallet-root");
  window.SmartTriad.mountWallet(walletContainer, { mode: "drawer" });

  // Mount codex
  const codexContainer = document.getElementById("codex-root");
  window.SmartTriad.mountCodex(codexContainer, { defaultTab: "scrolls" });
</script>
```

---

## Authentication & Session Sharing

### Current Approach (Cookie-based)

The embed routes use Supabase session cookies. For seamless integration:

1. **Same Domain:** If Lovable and Netlify apps share a parent domain, cookies work automatically
2. **Different Domains:** Users must authenticate in the iframe (redirect to `/auth`)

### Future Enhancement (Token-based)

Add support for `?session=<token>` query parameter to pass session tokens from host to embed.

---

## Lovable Integration Steps

### Step 1: Add Menu Items

In your Lovable navigation/drawer config:

```tsx
const menuItems = [
  { id: "wallet", label: "Wallet", icon: <Wallet /> },
  { id: "codex", label: "Codex", icon: <BookOpen /> },
  // ... other items
];
```

### Step 2: Create Drawer Content Component

```tsx
// components/SmartTriadDrawer.tsx
import { useState } from "react";

export function SmartTriadDrawer({ activeTab, onClose }) {
  return (
    <div className="h-full w-full">
      {activeTab === "wallet" && (
        <iframe
          src="https://theqriptopian.netlify.app/triad/embed/wallet"
          className="w-full h-full border-0"
          style={{ background: "#050816" }}
        />
      )}
      {activeTab === "codex" && (
        <iframe
          src="https://theqriptopian.netlify.app/triad/embed/codex?tab=scrolls"
          className="w-full h-full border-0"
          style={{ background: "#050816" }}
        />
      )}
    </div>
  );
}
```

### Step 3: Wire to Existing Drawer System

```tsx
// In your main drawer component
const [activeTab, setActiveTab] = useState<string | null>(null);

return (
  <Drawer open={!!activeTab} onClose={() => setActiveTab(null)}>
    <SmartTriadDrawer activeTab={activeTab} onClose={() => setActiveTab(null)} />
  </Drawer>
);
```

### Step 4: Admin Integration

In your Lovable admin portal:

```tsx
// Admin menu
<MenuItem onClick={() => navigate("/admin/codex-manager")}>
  Codex Manager
</MenuItem>

// Admin route
<Route path="/admin/codex-manager" element={
  <div className="h-screen w-screen">
    <iframe
      src="https://theqriptopian.netlify.app/triad/admin/codex"
      className="w-full h-full border-0"
    />
  </div>
} />
```

---

## Architecture Benefits

### ✅ Zero Duplication
- SmartWallet logic lives in one place
- Codex UI maintained in one repo
- Bug fixes propagate instantly to all hosts

### ✅ Consistent UX
- Same wallet experience across all apps
- Unified persona management
- Consistent x402 payment flows

### ✅ Independent Deployment
- Netlify app updates don't require Lovable redeployment
- Host apps can update their shells independently
- A/B testing possible via URL parameters

### ✅ Security
- Auth handled by canonical app
- No credential duplication
- Single source of truth for admin checks

---

## Testing Locally

### 1. Start the Netlify Qriptopian app:

```bash
cd apps/theqriptopian-web
npm run dev
```

### 2. Access embed routes directly:

- Wallet: `http://localhost:5173/triad/embed/wallet`
- Codex: `http://localhost:5173/triad/embed/codex?tab=scrolls`
- Admin Dashboard: `http://localhost:5173/triad/admin`
- Codex Manager: `http://localhost:5173/triad/admin/codex`

### 3. Test in iframe:

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background: #050816;">
  <iframe
    src="http://localhost:5173/triad/embed/wallet"
    style="width: 100vw; height: 100vh; border: none;"
  ></iframe>
</body>
</html>
```

---

## Deployment Checklist

- [x] Embed routes created
- [x] Routing configured (no Layout wrapper for embeds)
- [x] Auth hooks integrated (`useIsAdminAA`)
- [x] Dark theme consistent across embeds
- [ ] Deploy to Netlify
- [ ] Update CORS settings if needed
- [ ] Test cross-origin iframe embedding
- [ ] Document session sharing approach
- [ ] (Optional) Build JavaScript widgets

---

## File Structure

```
apps/theqriptopian-web/src/
├── pages/
│   └── triad/
│       ├── embed/
│       │   ├── EmbedLayout.tsx          # Minimal layout (no nav/footer)
│       │   ├── WalletEmbed.tsx          # /triad/embed/wallet
│       │   └── CodexEmbed.tsx           # /triad/embed/codex
│       └── admin/
│           ├── AdminDashboard.tsx       # /triad/admin
│           └── CodexManagerEmbed.tsx    # /triad/admin/codex
├── components/
│   ├── wallet/
│   │   └── SmartWalletDrawer.tsx        # Core wallet component
│   └── codex/
│       └── CodexMainLayer.tsx           # Core codex component
└── App.tsx                              # Routes configured here
```

---

## Next Steps

1. **Deploy to Netlify** - Verify all embed routes work in production
2. **Test in Lovable** - Integrate iframes into Lovable drawer system
3. **Session Sharing** - Implement token-based auth if needed
4. **JavaScript Widgets** - Build Phase 2 widgets for tighter integration
5. **Analytics** - Add tracking to measure embed usage
6. **Documentation** - Create video walkthrough for Lovable team

---

## Support

For questions or issues:
- Check this guide first
- Test routes locally before reporting issues
- Verify auth/session state in browser DevTools
- Check browser console for CORS or iframe errors

**Canonical Source:** This Netlify Qriptopian app (`apps/theqriptopian-web`)
**Integration Target:** Lovable Qriptopian app (separate repo)
