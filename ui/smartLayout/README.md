# Smart Layout System

## 6 Drawer Variants

1. **wallet-narrow** (360px) - Quick glance
2. **wallet-wide** (640px) - Copilot/forms
3. **panel-3q** (75vw) - Content canvas, menu visible
4. **immersive-3q** - Hero + feed, almost full width
5. **modal-centered** - Centered modal, z-60, menu HIDDEN behind
6. **full-immersive** - Fullscreen z-100

## Key: modal-centered

- Centered horizontally/vertically
- z-index 60 (above menu at z-50)
- Rounded corners with max-w-6xl
- For: MoneyPenny Portfolio, MetaVatar, Live Insights
- Menu intentionally hidden for immersive focus

## Usage

```tsx
import { SmartDrawerShell, SmartMenuRail } from "@/ui/smartLayout";

// MoneyPenny Portfolio
<SmartDrawerShell
  isOpen={open}
  size="modal-centered"
  title="Portfolio"
>
  <PortfolioDashboard />
</SmartDrawerShell>
```
