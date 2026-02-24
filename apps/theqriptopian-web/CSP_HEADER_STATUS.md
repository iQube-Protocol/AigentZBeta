# CSP/X-Frame-Options Header Configuration Status

## Current Situation

**Production URL:** https://theqriptopian.netlify.app
**Note:** `theqriptopian.com` is currently parked and not in use.

## Problem

Netlify is applying **platform-level default CSP headers** that override our custom header configuration. The embed routes at `/triad/embed/*` are currently blocked from being embedded in iframes due to:

```
content-security-policy: frame-ancestors 'self'
x-frame-options: SAMEORIGIN
```

## What We Need

For `/triad/embed/*` routes to work in Lovable iframes, we need:
- **NO** `X-Frame-Options` header (or allow all origins)
- `Content-Security-Policy` with `frame-ancestors` allowing Lovable domains

## Attempted Solutions

### 1. ✅ Created `public/_headers` file
**Location:** `/Users/hal1/CascadeProjects/AigentZBeta/apps/theqriptopian-web/public/_headers`
**Status:** File exists and is deployed, but Netlify's default headers override it

### 2. ✅ Added headers to `netlify.toml`
**Status:** Netlify platform CSP still takes precedence

### 3. ❌ Current Issue
Netlify applies platform-level security headers that cannot be easily overridden without:
- Disabling Netlify's default headers globally (not recommended)
- Using Netlify Edge Functions to modify headers at runtime
- Contacting Netlify support to disable default CSP for this site

## Recommended Next Steps

### Option A: Netlify Edge Function (Recommended)
Create an Edge Function to intercept requests to `/triad/embed/*` and modify headers:

```typescript
// netlify/edge-functions/embed-headers.ts
export default async (request: Request, context: any) => {
  const url = new URL(request.url);
  
  if (url.pathname.startsWith('/triad/embed/')) {
    const response = await context.next();
    const headers = new Headers(response.headers);
    
    // Remove restrictive headers
    headers.delete('x-frame-options');
    
    // Set permissive CSP for embeds
    headers.set('content-security-policy', 
      "frame-ancestors 'self' https://preview--qriptopian.lovable.app https://qriptopian.lovable.app http://localhost:3000 http://localhost:5173"
    );
    
    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
  
  return context.next();
};
```

### Option B: Disable Netlify Default Headers
Add to `netlify.toml`:
```toml
[build.processing]
  skip_processing = false
[build.processing.css]
  bundle = true
  minify = true
[build.processing.js]
  bundle = true
  minify = true
[build.processing.html]
  pretty_urls = true
[build.processing.images]
  compress = true

# Disable Netlify's default security headers
[build.environment]
  NETLIFY_USE_HEADERS = "false"
```

### Option C: Contact Netlify Support
Request that default CSP headers be disabled for this site to allow custom header configuration.

## Current Files

### `public/_headers`
```
# SmartTriad Embed Routes - Allow framing by Lovable (no X-Frame-Options)
/triad/embed/*

# All other routes - Strict frame protection  
/*
  X-Frame-Options: SAMEORIGIN
```

### `netlify.toml` (headers section removed)
No custom headers currently configured in netlify.toml.

## Testing

To verify headers are working:
```bash
curl -v https://theqriptopian.netlify.app/triad/embed/wallet 2>&1 | grep -i "content-security-policy\|x-frame-options"
```

Expected result (when fixed):
- NO `x-frame-options` header
- `content-security-policy` with `frame-ancestors` allowing Lovable domains

## Integration URLs for Lovable

Once headers are fixed, use these URLs in Lovable iframes:

```tsx
// Wallet
<iframe src="https://theqriptopian.netlify.app/triad/embed/wallet" />

// Codex
<iframe src="https://theqriptopian.netlify.app/triad/embed/codex?tab=scrolls" />
```
