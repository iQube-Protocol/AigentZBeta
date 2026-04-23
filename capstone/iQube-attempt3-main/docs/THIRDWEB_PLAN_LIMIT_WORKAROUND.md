# Thirdweb "Account blocked due to plan usage limit" – Explanation & Workaround

## What the error means

**Error:** `Authentication failed: {"error":{"reason":"FORBIDDEN","details":"Account blocked due to plan usage limit"}}`

This comes from **Thirdweb**. Your app uses their:

- **Client ID** (for Connect Button, wallet connection, in-app wallet)
- **RPC URLs** (e.g. `https://80002.rpc.thirdweb.com/<clientId>`)

Thirdweb’s free/starter plan has limits (e.g. RPC requests per second or per month). When the project hits those limits, their API responds with **FORBIDDEN** and the message above, so the app can’t authenticate or use their RPC.

Common causes:

- Shared or public client ID (e.g. in a tutorial/repo) used by many people
- High traffic or many RPC calls (reads, contract calls, sends)
- Free tier quota exhausted for the month

## What we changed (workaround)

We **stopped using Thirdweb’s RPC** for chain traffic and switched to **public RPC endpoints** so that:

- Contract reads and writes (mint, transfer, etc.) go to public RPCs, not Thirdweb.
- Wallet connection and switching chains in the Connect modal also use these public RPCs.

So most “usage” no longer counts against Thirdweb’s plan.

### Code changes

1. **`src/utilities/constants.ts`**  
   Added:
   - `RPC_POLYGON_AMOY` = `https://rpc-amoy.polygon.technology`
   - `RPC_SEPOLIA` = `https://rpc.sepolia.org`
   - `RPC_AVALANCHE_FUJI` = `https://api.avax-test.network/ext/bc/C/rpc`

2. **`src/utilities/contractUtils.ts`**  
   - Contract is now bound to a **custom Polygon Amoy chain** defined with `defineChain()` and `rpc: constants.RPC_POLYGON_AMOY`.  
   - All contract reads and transactions use this public RPC instead of Thirdweb’s.

3. **`src/components/ThirdWebConnect.tsx`** and **`src/screens/Home.tsx`**  
   - The `chains` array for the Connect Button no longer uses `*.rpc.thirdweb.com/...` URLs.  
   - It uses `constants.RPC_POLYGON_AMOY`, `constants.RPC_SEPOLIA`, and `constants.RPC_AVALANCHE_FUJI` for the respective chains.

## If you still see the error: use your own Client ID

The **Connect** flow and Thirdweb’s backend still use a **Client ID**. The one in the repo is shared and can be blocked. Use **your own** so you get your own quota.

### Steps

1. **Get a Client ID**
   - Go to **[thirdweb.com](https://thirdweb.com)** and sign in (or create a free account).
   - Open **Dashboard** → **API Keys** (or **Settings** → **API Keys**).
   - Create an API key if needed; copy the **Client ID** (a string like `abc123...`).

2. **Put it in your app**
   - In the project root, open your **`.env`** file.
   - Set:
     ```bash
     VITE_THIRDWEB_CLIENT_ID=your_client_id_here
     ```
   - Replace `your_client_id_here` with the Client ID you copied.
   - Save the file and **restart the dev server** (e.g. `npm run dev`).

3. **Try again**
   - Reload the app and connect your wallet (MetaMask is fine). You should no longer hit “Account blocked due to plan usage limit” for that Client ID.

The app now reads the client from **`VITE_THIRDWEB_CLIENT_ID`** everywhere it creates the Thirdweb client. If the variable is missing, it falls back to the old (possibly blocked) ID.

Other options: use **MetaMask / WalletConnect** only (skip “Sign in with Google”), or **upgrade** your Thirdweb plan if you need higher limits.

## Optional: use your own RPC URLs

You can override the public RPCs (e.g. with Alchemy, Infura, or another provider) by changing the values in `constants.ts` or by using env vars and reading them where the chain/RPC is set. The same pattern (custom chain with your `rpc` and same chain id) keeps the workaround in place while using your own RPC.
