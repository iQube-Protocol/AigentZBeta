# What’s Going On & How Minting Works

## High-level flow

1. **You connect a wallet** (MetaMask, WalletConnect, or thirdweb in-app) so the app can sign transactions and pay gas on your behalf.
2. **You create “Qube” content** (Data Qube, Content Qube, or Media Qube). The app encrypts data, uploads metadata to IPFS, then mints an NFT that points to that metadata and stores an encryption key on-chain.
3. **Minting** = one blockchain transaction that calls the iQube NFT contract on **Polygon Amoy** (testnet). The NFT is minted to your connected wallet address.

---

## The minting process (step by step)

### 1. Contract (on-chain)

The **iQube NFT** contract lives on **Polygon Amoy** at:

- **Contract address:** `0x632E1d32e34F0A690635BBcbec0D066daa448ede`

Relevant function:

```solidity
function mintQube(address to, string memory uri, string memory encryptionKey)
```

- **to** – who receives the NFT (your wallet).
- **uri** – IPFS URL of the metadata (e.g. `https://...gateway.../ipfs/Qm...`).
- **encryptionKey** – key stored on-chain so only the owner can decrypt the BlakQube content later.

The contract:

- Mints a new token ID (incrementing counter).
- Assigns ownership to `to`.
- Saves `uri` as the token’s metadata URI.
- Saves `encryptionKey` in a mapping (readable only by the token owner via `getEncryptionKey(tokenId)`).

### 2. Frontend (what the app does)

- **contractUtils.ts** talks to that contract via **thirdweb** (Polygon Amoy).
- **useMintQube(metaQubeLocation, encryptionKey)** builds a transaction that calls `mintQube(uri, encryptionKey)` (with your address as the sender, so you get the NFT).
- When you click “Mint”:
  1. Your wallet (MetaMask, etc.) is asked to sign the transaction.
  2. The signed transaction is sent to Polygon Amoy.
  3. A miner/validator includes it in a block.
  4. thirdweb returns a **transaction hash** (and the UI can show it).

So: **one mint = one transaction on Polygon Amoy**.

### 3. Per-screen flow (conceptual)

- **Data Qube:** Encrypt member profile (your server) → build metadata JSON → upload metadata to **Pinata (IPFS)** → get IPFS URL → set encryption key + that URL in state → call `mintQube(metaQubeLocation, _key)` so the contract mints an NFT with that URI and key.
- **Content Qube:** Upload file to IPFS, encrypt, build metadata, then same idea: `mintQube(encryptedURL, key)`.
- **Media Qube:** Same pattern with a media file and IPFS.

The **chain** used for minting is **Polygon Amoy** (configured in `contractUtils` and wallet/chain lists).

---

## How to see that a mint went on-chain

### 1. In the app

- After minting, the UI often shows **transactionResult** and/or **transactionHash** (e.g. on the “With ThirdWeb” page or after Data/Content/Media Qube mint).
- Some screens show a link like: **“View on block explorer”** (or similar) that takes you to the transaction on the explorer.

### 2. Block explorer (Polygon Amoy)

Mints happen on **Polygon Amoy**. The app uses **OKLink** as the block explorer.

- **Base URL:** https://www.oklink.com/amoy  
- **Contract:** https://www.oklink.com/amoy/address/0x632E1d32e34F0A690635BBcbec0D066daa448ede  
- **A specific transaction:**  
  https://www.oklink.com/amoy/tx/**&lt;YOUR_TX_HASH&gt;**  

Replace `<YOUR_TX_HASH>` with the hash you see in the app (e.g. `transactionResult?.transactionHash`).

On the transaction page you’ll see:

- Status (success/failed).
- Block number.
- From/To (your wallet → contract).
- Input data (the `mintQube(...)` call).
- Gas used, etc.

### 3. Confirm the NFT exists

- **By token ID:** If you know the token ID (e.g. 0, 1, 2…), you can call the contract’s `ownerOf(tokenId)` (e.g. in the app or on the explorer’s “Contract” → “Read” tab) to see the owner.
- **By your address:** On OKLink, open your wallet address on Amoy and look at “Token” or “NFT” transfers; you should see a transfer of the iQube NFT to you (or use the contract’s “Transfer” events filtered by your address).

So in short:

1. **What’s going on:** You connect a wallet; the app prepares encrypted metadata on IPFS and then mints an NFT on Polygon Amoy that stores the metadata URI and encryption key.  
2. **How minting works:** One signed transaction calling `mintQube` on the contract at `0x632E1d32e34F0A690635BBcbec0D066daa448ede` on Polygon Amoy.  
3. **How to see it on-chain:** Use the transaction hash from the app in OKLink: `https://www.oklink.com/amoy/tx/<transactionHash>`, and optionally check the contract or your address for the new NFT.
