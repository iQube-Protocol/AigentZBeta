# FIO Handle User Guide

**Version**: 1.0  
**Last Updated**: October 17, 2025

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [What is a FIO Handle?](#what-is-a-fio-handle)
3. [Getting Started](#getting-started)
4. [Creating a Persona](#creating-a-persona)
5. [Registering a FIO Handle](#registering-a-fio-handle)
6. [Verifying Your Handle](#verifying-your-handle)
7. [Managing Your Handle](#managing-your-handle)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Introduction

Welcome to the FIO Handle system! This guide will help you create and manage your blockchain-verified identity handles within the DIDQube ecosystem.

---

## What is a FIO Handle?

A **FIO Handle** is your unique, blockchain-verified identity on the FIO Protocol. Think of it like an email address, but for cryptocurrency and decentralized identity.

### Format
FIO handles follow the format: `username@domain`

**Examples**:
- `alice@aigent`
- `bob123@iqube`
- `developer@fio`

### Benefits
- ✅ **Blockchain Verified** - Your ownership is recorded on-chain
- ✅ **Human Readable** - Easy to remember and share
- ✅ **Decentralized** - No central authority controls it
- ✅ **Portable** - Use it across multiple applications
- ✅ **Reputation Linked** - Connect your handle to your reputation score

---

## Getting Started

### Prerequisites
- Access to the DIDQube Identity System
- A valid FIO handle idea (check availability first)
- Understanding that handles expire after 1 year (renewable)

### Cost
- Registration Fee: **40 FIO tokens** (approximately $40 USD)
- Renewal Fee: Same as registration
- Transaction Fees: Minimal (covered by bundled transactions)

---

## Creating a Persona

### Step 1: Navigate to Identity Page
1. Go to **Settings → Identity** in the sidebar
2. Click **"Create New Persona"** button

### Step 2: Enter FIO Handle
1. Type your desired handle (e.g., `yourname@aigent`)
2. Wait for real-time availability check
3. ✅ Green checkmark = Available
4. ❌ Red X = Already taken

**Tips for Choosing a Handle**:
- Keep it short and memorable
- Use lowercase letters, numbers, and hyphens only
- Avoid special characters
- Check that it represents your identity well

### Step 3: Select Identity State
Choose your default privacy level:
- **Anonymous** - Maximum privacy
- **Semi-Anonymous** - Balanced privacy
- **Semi-Identifiable** - More transparency
- **Identifiable** - Full transparency

### Step 4: Declare Entity Type
- **Not Verified** - Default state
- **Verified Human** - For human users (requires World ID)
- **AI Agent** - For AI agents and bots

### Step 5: Create Persona
Click **"Create Persona"** to proceed to FIO registration.

---

## Registering a FIO Handle

After creating your persona, you'll enter the FIO registration wizard.

### Step 1: Confirm Handle
Review your chosen FIO handle and ensure it's correct.

### Step 2: Generate Keys
1. Click **"Generate Key Pair"**
2. Your FIO public and private keys will be created
3. **⚠️ CRITICAL**: Copy and save your private key securely!

**Private Key Security**:
- 🔒 Store it in a password manager
- 🔒 Write it down and keep it in a safe place
- 🔒 NEVER share it with anyone
- 🔒 It CANNOT be recovered if lost

### Step 3: Review Registration
Review all details:
- FIO Handle
- Public Key
- Registration Fee (40 FIO)
- Expiration (1 year from now)

### Step 4: Confirm Registration
1. Click **"Register Handle"**
2. Wait for blockchain confirmation (usually 30-60 seconds)
3. You'll receive a transaction ID

### Step 5: Success!
Your handle is now registered on the FIO blockchain! 🎉

You can view your transaction on the [FIO Block Explorer](https://fio.bloks.io/).

---

## Verifying Your Handle

### Automatic Verification
After registration, your handle is automatically verified and linked to your persona.

### Manual Verification
If you need to re-verify:

1. Go to **Admin → Reputation**
2. Find your persona in the list
3. Look for the FIO verification icon:
   - 🟢 Green checkmark = Verified
   - 🟡 Yellow warning = Expiring soon
   - 🔴 Red X = Expired or failed

### Verification Status
- **Verified** - Handle is active and verified
- **Pending** - Registration in progress
- **Expiring Soon** - Less than 30 days until expiration
- **Expired** - Handle has expired (needs renewal)
- **Unverified** - Ownership not confirmed
- **Failed** - Registration failed

---

## Managing Your Handle

### Viewing Your Handle
Your FIO handle appears in:
- **Ops Console** - Network Operations dashboard
- **Admin Panel** - Reputation management
- **Identity Page** - Persona selection

### Checking Expiration
1. Hover over the FIO verification badge
2. View expiration date in tooltip
3. See days remaining until expiration

### Renewing Your Handle
**Coming Soon**: Automatic renewal system

For now, you'll need to:
1. Register a new handle before expiration
2. Update your persona with the new handle

### Transferring Ownership
**Coming Soon**: Handle transfer functionality

---

## Troubleshooting

### Handle Registration Failed
**Problem**: Registration transaction failed

**Solutions**:
1. Check your FIO token balance
2. Verify network connectivity
3. Try again in a few minutes
4. Contact support if issue persists

### Handle Not Showing as Verified
**Problem**: Handle registered but not verified

**Solutions**:
1. Wait 1-2 minutes for blockchain confirmation
2. Click the refresh button in the persona list
3. Manually trigger verification from admin panel
4. Check transaction status on FIO explorer

### Private Key Lost
**Problem**: Lost access to private key

**Solutions**:
- ⚠️ **There is NO way to recover a lost private key**
- You will need to register a new handle
- Always backup your keys securely

### Handle Expired
**Problem**: Handle has expired

**Solutions**:
1. Register a new handle
2. Update your persona
3. Set up renewal reminders for the future

### Availability Check Not Working
**Problem**: Real-time validation not responding

**Solutions**:
1. Check internet connection
2. Refresh the page
3. Try a different handle
4. Clear browser cache

---

## FAQ

### How long does registration take?
Typically 30-60 seconds for blockchain confirmation.

### Can I change my handle later?
No, handles are permanent once registered. You can register a new one, but the old one remains on the blockchain.

### What happens if I don't renew?
Your handle expires after 1 year and becomes available for others to register.

### Can I have multiple handles?
Yes! You can register multiple handles and link them to different personas.

### Is my private key stored anywhere?
No! Your private key is generated client-side and never sent to our servers. YOU are responsible for storing it securely.

### What if someone else has my desired handle?
Try variations with numbers or different domains (@aigent, @iqube, @fio).

### Can I use my handle on other platforms?
Yes! FIO handles are blockchain-based and can be used across any FIO-compatible application.

### How do I check if a handle is available?
Just start typing in the FIO Handle input field - availability is checked automatically.

### What domains are available?
Currently supported:
- `@aigent` (default)
- `@iqube`
- `@fio`
- Custom domains (coming soon)

### Can AI agents have FIO handles?
Yes! When creating a persona, select "AI Agent" as the entity type.

---

## Support

### Need Help?
- **Documentation**: [FIO Protocol Docs](https://developers.fioprotocol.io/)
- **Block Explorer**: [FIO Bloks](https://fio.bloks.io/)
- **Community**: Join our Discord server
- **Email**: support@iqube.network

### Report Issues
Found a bug? Report it on our [GitHub Issues](https://github.com/iQube-Protocol/AigentZBeta/issues) page.

---

## Best Practices

### Security
- ✅ Always backup your private key
- ✅ Use a password manager
- ✅ Never share your private key
- ✅ Verify transaction details before confirming
- ✅ Keep your keys offline when possible

### Handle Selection
- ✅ Choose a professional, memorable handle
- ✅ Avoid personal information
- ✅ Consider future use cases
- ✅ Check availability early

### Maintenance
- ✅ Set renewal reminders
- ✅ Monitor expiration dates
- ✅ Keep contact information updated
- ✅ Regularly verify ownership

---

**Last Updated**: October 17, 2025  
**Version**: 1.0  
**Status**: Active
