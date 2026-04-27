# Liquid UI

Liquid UI is the AgentiQ OS component contract layer. It defines how UI components adapt to the active persona's identity state, trust band, and journey stage — without requiring the component to know the full persona model.

## Core Concept

A Liquid UI component receives a **UI context token** rather than raw persona data. The token encodes:
- What the component is allowed to render (based on trust band and disclosure class)
- Which actions are available (based on active PolicyEnvelope)
- What theme and mode to use (based on cartridge context)

This means components are policy-aware without being policy-coupled.

## Component Contracts

Every AgentiQ OS UI component must satisfy the base contract:

```typescript
interface LiquidUIProps {
  personaId?: string           // Active persona (propagated from embed route)
  trustBand?: TrustBand        // Persona trust band (for gating)
  disclosureClass?: DisclosureClass  // Max visibility level
  cartridgeScope?: string      // Active cartridge context
  delegationActive?: boolean   // Whether bounded delegation is active
  isAdmin?: boolean            // Optimistic admin flag (server re-validates)
}
```

## Design Tokens

Liquid UI uses a consistent token system across all cartridges:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | Cartridge accent color | Buttons, active states, badges |
| `--color-surface` | `slate-900/40` | Card backgrounds |
| `--color-border` | `slate-800` | Dividers and borders |
| `--color-text` | `slate-200` | Primary text |
| `--color-text-muted` | `slate-400` | Secondary text |
| `--radius-card` | `0.5rem` | Card border radius |
| `--radius-button` | `0.5rem` | Button border radius |

## Adaptive Rendering

Components adapt to trust band:

```tsx
function MyFeatureButton({ trustBand, onClick }: LiquidUIProps & { onClick: () => void }) {
  if (!trustBand || trustBand === 'L1_EXPERIMENTAL') {
    return (
      <button disabled className="opacity-50 cursor-not-allowed">
        Requires L2 verification
      </button>
    );
  }
  return <button onClick={onClick}>Activate Feature</button>;
}
```

## Disclosure-Aware Content

Components that render potentially sensitive content check disclosure class:

```tsx
function WalletBalanceCard({ disclosureClass, walletQube }: LiquidUIProps) {
  if (disclosureClass === 'sovereign') {
    return <div className="text-slate-400">Balance hidden — sovereign scope</div>;
  }
  return <div>{walletQube.balances.qc} Q¢</div>;
}
```

## CTA Pattern

Calls to action that open the SmartTriad copilot follow a consistent pattern:

```tsx
<button
  onClick={onOpenCopilot}
  className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors"
>
  <Sparkles className="h-4 w-4" />
  Ask Aigent C-OS
</button>
```

## Grid System

All layouts use a 4-column grid base with responsive breakpoints:

```tsx
// Standard 2-column responsive card grid
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {cards.map(card => <Card key={card.id} {...card} />)}
</div>
```

## Animation Tokens

Transitions use consistent timing:
- **Fast** (UI feedback): `transition-colors duration-150`
- **Standard** (panel open/close): `transition-all duration-200`
- **Slow** (page-level): `transition-opacity duration-300`

## Accessibility

All interactive components must:
- Provide `aria-label` when icon-only
- Support keyboard navigation (`focus:ring-2 focus:ring-blue-500`)
- Meet WCAG AA contrast (slate-200 on slate-900 = 14:1 ratio)
- Announce state changes to screen readers via `aria-live="polite"`
