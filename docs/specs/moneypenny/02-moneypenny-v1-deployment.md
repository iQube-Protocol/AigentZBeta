<!--
Imported verbatim from iQube-Protocol/moneypenny, path
`netlify-raindrop-demo/DEPLOYMENT.md`. See 01-moneypenny-v1-setup.md's
header for full provenance context. Content below is UNMODIFIED from the
source repo.
-->

# MoneyPenny Multi-Chain Trading Console - Deployment Guide

## What's New

### 1. Gas Oracle Service
- **Location**: `services/gas-oracle/`
- **Purpose**: Tracks real-time gas costs per chain using rolling medians
- **Chains supported**: ethereum, arbitrum, base, polygon, solana
- **Database**: Stores snapshots in `gas_snapshots` table, medians in `kv_runtime`

### 2. Aigent-Z UI Component Library
- **Location**: `src/components/ui/ui.tsx`
- **Features**:
  - Design tokens for dark theme
  - Glass morphism cards
  - Chain-colored badges
  - Utility classes matching Aigent-Z style
  - Components: Card, Button, Badge, Modal, Drawer, etc.

### 3. Updated Components
- **EdgeGauge**: Semi-circular gauge with status-based needle colors (green/yellow/red)
- **ChainIcon**: Simple emoji-based chain icons (easily replaceable with SVGs)
- **QuotesTable**: Shows chain icons, real-time quotes across all chains
- **MicroFillsTicker**: Displays fills with chain indicators

### 4. Multi-Chain Simulation
- **Endpoint**: `/sim/stream?chains=ethereum,arbitrum,base`
- **Features**:
  - User-selectable chain portfolio
  - Per-chain state tracking
  - Interleaved events across selected chains
  - Q¢ accumulated counter (computed from capture_bps × notional ÷ peg)

### 5. Modernized Console
- **Page**: `src/pages/moneypenny/console.astro`
- **Features**:
  - New title: "Aigent MoneyPenny Q¢ Trading Console"
  - Subheader explaining the service
  - Chain portfolio selector (toggle chains on/off)
  - Live Q¢ tally
  - Real-time quotes table with chain indicators
  - Fills ticker with chain icons
  - Dark theme using Aigent-Z tokens

### 6. Navigation Updates
- **Header**: Simplified nav - removed standalone Analyze/Console links
- **MoneyPenny** link now goes directly to `/moneypenny/console`

## Running the Services

### Prerequisites
```bash
# Set environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/moneypenny"
export GAS_CHAINS="ethereum,arbitrum,base,polygon,solana"
export GAS_PERIOD_MS=30000
export GAS_LOOKBACK_MIN=10
```

### Start Services

1. **Database Migration**
```bash
cd services/aa-api-gateway
npm run db:migrate
```

2. **Gas Oracle** (Terminal 1)
```bash
cd services/gas-oracle
npm install
npm run dev
```

3. **API Gateway** (Terminal 2)
```bash
cd services/aa-api-gateway
npm run dev
```

4. **Frontend** (Terminal 3)
```bash
npm run dev
```

## Testing Multi-Chain Simulation

1. Open browser to `http://localhost:4321/moneypenny/console`
2. You should see:
   - Chain portfolio selector with 5 chains
   - Connection status indicator
   - Real-time quotes streaming in
   - Fills appearing with chain icons
   - Q¢ accumulated incrementing

3. Try toggling chains:
   - Click chain chips to include/exclude from portfolio
   - Stream will reconnect with new chain selection
   - Only selected chains will appear in quotes/fills

## API Endpoints

### Multi-Chain Simulation Stream
```bash
curl -N "http://localhost:8787/sim/stream?k=DEV_KEY_123&chains=ethereum,arbitrum,base"
```

Events:
- `QUOTE`: { status, chain, pair, edge_bps, floor_bps, size_usd, peg_usd, ts }
- `INTENT_SUBMITTED`: { status, chain, pair, intent_id, intent_number, ts }
- `FILL`: { status, chain, pair, side, qty_qct, price_usdc, fee_usdc, gas_usd, notional_usd, ts }
- `P&L`: { status, chain, pair, capture_bps, cum_capture_bps, turnover, notional_usd, peg_usd, ts }

### Gas Medians (via kv_runtime)
```sql
SELECT key, value_num FROM kv_runtime
WHERE tenant_id='__global__'
AND key LIKE 'gas_usd_median_%';
```

## Architecture

```
┌─────────────────┐
│  gas-oracle     │  Polls gas prices, computes rolling medians
│  (Node/TS)      │  Writes to: gas_snapshots, kv_runtime
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL     │  Schema: gas_snapshots, kv_runtime, intents, fills, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  aa-api-gateway │  /sim/stream → multi-chain SSE feed
│  (Express)      │  /quotes, /propose_intent, /config, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Frontend       │  Console page with chain selector, Q¢ tally, live quotes
│  (Astro/React)  │  Components: EdgeGauge, QuotesTable, MicroFillsTicker
└─────────────────┘
```

## File Structure

```
services/
├── gas-oracle/
│   ├── package.json
│   └── src/
│       ├── index.ts         # Main worker loop
│       └── db.ts            # PostgreSQL client
├── aa-api-gateway/
│   └── src/
│       ├── routes/
│       │   └── sim_stream.ts  # Updated for multi-chain
│       └── index.ts

src/
├── components/
│   ├── ui/
│   │   └── ui.tsx           # Aigent-Z UI library
│   ├── EdgeGauge.tsx        # Semi-circular gauge
│   ├── ChainIcon.tsx        # Chain emoji glyphs
│   ├── QuotesTable.tsx      # Quotes with chain icons
│   ├── MicroFillsTicker.tsx # Fills with chain icons
│   ├── CaptureSparkline.tsx
│   ├── PolicyLogDrawer.tsx
│   └── Header.astro         # Simplified nav
└── pages/
    └── moneypenny/
        ├── console.astro    # New multi-chain console
        └── console-old.astro # Backup of original

db/
└── schema.sql              # Added gas_snapshots table
```

## Next Steps

1. **Replace emoji chain icons** with proper SVG icons in `ChainIcon.tsx`
2. **Wire Live mode**: Connect to real intent/fill events from DB
3. **Add Profile/Analyze merge**: Create banking profile wizard on a profile page
4. **Deploy gas-oracle**: Set up as a background service (systemd, PM2, or Docker)
5. **Production database**: Point DATABASE_URL to production PostgreSQL
6. **Environment vars**: Set PUBLIC_MONEYPENNY_BASE in Netlify/Vercel

## Troubleshooting

### Gas oracle not updating medians
- Check DATABASE_URL is set
- Verify `gas_snapshots` table exists
- Check logs: `npm run dev` in services/gas-oracle/

### SSE stream not connecting
- Verify aa-api-gateway is running on port 8787
- Check CORS headers if accessing from different origin
- Ensure API key is correct (DEV_KEY_123 for dev)

### No quotes appearing
- Check browser console for EventSource errors
- Verify chains query parameter is valid
- Check aa-api-gateway logs for SSE connections

## Security Notes

- **DEV_KEY_123** is for development only
- Production should use tenant-specific API keys from `tenant_api_keys` table
- Gas oracle stores no PII, only USD cost estimates
- Simulation mode requires no custody or private keys
