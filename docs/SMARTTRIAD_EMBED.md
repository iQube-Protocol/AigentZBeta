# SmartTriad Embed Integration Guide

## Overview

SmartTriad (SmartWallet + KNYT Codex) is now available as embeddable micro-frontend surfaces served from the AigentiQ Next.js platform. These embed routes are designed for iframe integration in thin clients like Lovable, with proper CSP headers for cross-origin embedding.

## Architecture

**Platform:** AigentiQ Next.js App (AigentZBeta monorepo)  
**Embed Routes:** `/triad/embed/wallet` and `/triad/embed/codex`  
**Security:** Next.js middleware handles CSP headers for Lovable domains  
**Layout:** Full-panel layouts (no global nav/chrome) optimized for iframe embedding

## Embed URLs

### Production (when deployed)
```
https://<aigentiq-host>/triad/embed/wallet
https://<aigentiq-host>/triad/embed/codex
```

### Local Development
```
http://localhost:3000/triad/embed/wallet
http://localhost:3000/triad/embed/codex
```

## SmartWallet Embed

**Route:** `/triad/embed/wallet`

**Features:**
- x402 SmartWallet with KNYT/Q¢ balances
- Task and reward tracking
- Payment flows (buy KNYT, send/request)
- Persona management
- DIDQube identity integration
- RQH (Reputation Qube Hub) integration

**Query Parameters:**
- `theme` (optional): `light` | `dark` (default: `dark`)
- `density` (optional): `narrow` | `wide` (default: `wide`)

**Example:**
```html
<iframe
  src="https://<aigentiq-host>/triad/embed/wallet?theme=dark&density=wide"
  style="width: 100%; height: 100%; border: none;"
  title="SmartWallet"
/>
```

## KNYT Codex Embed

**Route:** `/triad/embed/codex`

**Features:**
- Digital scrolls and collectibles
- Character profiles
- Lore and world-building content
- DigiTerra, Terra, and Order sections
- Liquid UI template system
- In-codex wallet integration

**Query Parameters:**
- `tab` (optional): `scrolls` | `characters` | `lore` | `digiterra` | `terra` | `order` (default: `scrolls`)
- `theme` (optional): `light` | `dark` (default: `dark`)
- `density` (optional): `narrow` | `wide` (default: `wide`)
- `personaId` (optional): string - override persona context

**Example:**
```html
<iframe
  src="https://<aigentiq-host>/triad/embed/codex?tab=scrolls&theme=dark"
  style="width: 100%; height: 100%; border: none;"
  title="KNYT Codex"
/>
```

## Lovable Integration

### Drawer Configuration

**SmartWallet Drawer:**
```tsx
// In Lovable drawer component
<iframe
  src="https://<aigentiq-host>/triad/embed/wallet"
  className="w-full h-full border-none"
  title="SmartWallet"
/>
```

**KNYT Codex Drawer:**
```tsx
// In Lovable drawer component
<iframe
  src="https://<aigentiq-host>/triad/embed/codex?tab=scrolls"
  className="w-full h-full border-none"
  title="KNYT Codex"
/>
```

### Sizing Recommendations

**Narrow Mode (Mobile/Glance):**
- SmartWallet: 320px - 400px width, 60-70% viewport height
- Codex: 320px - 400px width, 70-80% viewport height

**Wide Mode (Desktop/Full):**
- SmartWallet: 500px - 700px width, 80-90% viewport height
- Codex: 700px - 1000px width, 85-95% viewport height

## Security Headers

The embed routes are configured with the following CSP headers via Next.js middleware:

```
Content-Security-Policy: frame-ancestors 'self' https://qriptopian.lovable.app https://preview--qriptopian.lovable.app;
```

**No `X-Frame-Options` header** is sent, allowing the CSP `frame-ancestors` directive to control framing.

### Allowed Origins
- `'self'` - Same-origin embedding
- `https://qriptopian.lovable.app` - Lovable production
- `https://preview--qriptopian.lovable.app` - Lovable preview

## Technical Implementation

### Middleware Configuration

```typescript
// middleware.ts
const EMBED_PREFIX = '/triad/embed';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(EMBED_PREFIX)) {
    const response = NextResponse.next();
    
    // Remove X-Frame-Options
    response.headers.delete('X-Frame-Options');
    response.headers.delete('x-frame-options');
    
    // Set CSP with frame-ancestors
    const csp = "frame-ancestors 'self' https://qriptopian.lovable.app https://preview--qriptopian.lovable.app;";
    response.headers.set('Content-Security-Policy', csp);
    
    return response;
  }
  return NextResponse.next();
}
```

### Layout Structure

```typescript
// app/triad/embed/layout.tsx
export default function EmbedLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        {/* No global nav/sidebar - just embed content */}
        <div className="smarttriad-root w-full h-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
```

## Data Integration

SmartTriad embeds integrate with existing AigentiQ services:

**Backend Services:**
- AA-API (Account Abstraction)
- DVN (Decentralized Verification Network)
- x402 Ledger
- Supabase (profiles, personas, entitlements)
- RQH (Reputation Qube Hub)

**No Logic Duplication:** Embeds are views over the canonical AA-API + DVN data model.

## Development Status

### ✅ Completed (Phase 1)
- Next.js middleware with CSP headers
- Embed route structure (`/triad/embed/wallet`, `/triad/embed/codex`)
- Minimal layout (no nav/chrome)
- Query parameter support
- Local testing verified

### 🚧 In Progress (Phase 2)
- Port SmartWalletDrawer component from Qriptopian Vite app
- Port CodexDrawer and related components
- Preserve existing designs, CSS, breakpoints
- Integrate D-ID/metaAvatar iframe surfaces
- Full AA-API integration

### 📋 Future (Phase 3)
- JavaScript SDK / NPM package
- Widget API: `SmartTriad.mountWallet(element, options)`
- Widget API: `SmartTriad.mountCodex(element, options)`
- Enhanced theming and customization options

## Testing

### Local Testing

1. Start the Next.js dev server:
   ```bash
   npm run dev
   ```

2. Test embed routes:
   ```bash
   # Verify CSP headers
   curl -I http://localhost:3000/triad/embed/wallet
   curl -I http://localhost:3000/triad/embed/codex
   
   # Should show:
   # - HTTP 200 OK
   # - content-security-policy: frame-ancestors 'self' https://qriptopian.lovable.app https://preview--qriptopian.lovable.app;
   # - NO x-frame-options header
   ```

3. Test in browser:
   ```
   http://localhost:3000/triad/embed/wallet?theme=dark&density=wide
   http://localhost:3000/triad/embed/codex?tab=scrolls
   ```

### Iframe Testing

Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>SmartTriad Embed Test</title>
  <style>
    body { margin: 0; padding: 20px; font-family: sans-serif; }
    .container { display: flex; gap: 20px; height: 80vh; }
    iframe { flex: 1; border: 1px solid #ccc; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>SmartTriad Embed Test</h1>
  <div class="container">
    <iframe 
      src="http://localhost:3000/triad/embed/wallet"
      title="SmartWallet"
    ></iframe>
    <iframe 
      src="http://localhost:3000/triad/embed/codex?tab=scrolls"
      title="KNYT Codex"
    ></iframe>
  </div>
</body>
</html>
```

## Migration from Netlify

**Previous:** SmartTriad UI served from Netlify/Vite Qriptopian app  
**Current:** SmartTriad UI served from AigentiQ Next.js app  
**Reason:** Netlify Edge Functions not executing (platform issue)

**Migration Status:**
- ✅ Embed infrastructure complete
- 🚧 Component porting in progress
- 📋 Netlify UI will be sunset once Next.js embeds are fully functional

## Support

For issues or questions:
- Check embed route headers: `curl -I <embed-url>`
- Verify CSP allows your origin
- Check browser console for CSP/framing errors
- Review Next.js middleware logs

## Related Documentation

- [SmartWallet Architecture](./SMART_WALLET_ARCHITECTURE.md)
- [KNYT Codex Liquid UI](./CODEX_TEMPLATE_ARCHITECTURE.md)
- [AA-API Integration](./INTEGRATION_GUIDE.md)
- [DVN Overview](./DEPLOYMENT_ARCHITECTURE.md)
