<!--
Imported verbatim from iQube-Protocol/moneypenny (the earliest MoneyPenny
prototype, created 2025-11-11), path
`netlify-raindrop-demo/MONEYPENNY_SETUP.md`. Part 1 of that repo's
"handoff spec, repo 1 of 3" import (see ../../../codexes/packs/agentiq/updates/2026-09-02_moneypenny-handoff-specs-import-and-crosswalk.md
for the full provenance note — NO document literally titled "handoff spec"
was found in any of the three donor repos; this and its two siblings
(02-moneypenny-v1-deployment.md, 03-moneypenny-v1-testing.md) are the
closest real, substantive documents this repo actually contains).
Content below is UNMODIFIED from the source repo.
-->

# MoneyPenny Venice LLM Setup

MoneyPenny now uses Venice LLM for intelligent, privacy-first trading assistance.

## Quick Setup

### 1. Get Venice API Key

1. Sign up at https://venice.ai/
2. Navigate to API Keys section
3. Create a new API key
4. Copy your API key

### 2. Configure API Keys

**Backend (aa-api-gateway):**
```bash
cd services/aa-api-gateway
```

Edit `.env` and update:
```bash
VENICE_API_KEY=your_actual_venice_api_key_here
VENICE_API_BASE=https://api.venice.ai/api/v1
```

**Frontend (optional - already configured):**
Root `.env` already has environment variables for frontend:
```bash
PUBLIC_MONEYPENNY_BASE=http://localhost:8787
```

### 3. Restart Servers

Backend will auto-restart if running with `npm run dev`.
Otherwise:
```bash
cd services/aa-api-gateway
npm run dev
```

Frontend (in root):
```bash
npm run dev
```

## MoneyPenny System Prompt

The system prompt is located at:
`services/aa-api-gateway/src/config/moneypenny-prompt.ts`

### Key Features:
- **System Context**: Domain knowledge, trading expertise, privacy principles
- **User Context**: Smart Memories provide aggregates, trading history, preferences
- **Session Context**: Live 24h capture, fills, active chains

### Customizing the Prompt

Edit `MONEYPENNY_SYSTEM_PROMPT` in `moneypenny-prompt.ts` to:
- Adjust MoneyPenny's personality/tone
- Add new trading concepts
- Update risk guidelines
- Enhance privacy explanations

### Message Flow

1. **User asks question** in MoneyPenny Drawer
2. **Frontend** searches Smart Memories for relevant context:
   - `mem://profile-aggregates/{tenant}/{persona}` - Financial aggregates (non-PII)
   - `mem://trading-history/{tenant}/{persona}` - Trading performance
   - `mem://glossary/finance` - HFT/trading terminology
3. **Frontend** calls `/chat/answer` with:
   - Question
   - Memory snippets
   - Session insights (24h capture, fills, chains)
   - Consent settings (doc_level_excerpts)
4. **Backend** builds messages:
   ```javascript
   [
     { role: 'system', content: MONEYPENNY_SYSTEM_PROMPT },
     { role: 'user', content: userContext + question }
   ]
   ```
5. **Venice LLM** generates response using full context
6. **Frontend** displays answer in chat

## Privacy Architecture

### Without doc_level_excerpts (default):
- MoneyPenny only sees aggregates: avg surplus, volatility, closing balance
- No specific transaction details
- General trading advice based on risk profile

### With doc_level_excerpts (opt-in):
- Can reference **redacted** excerpts: dates, amounts only
- No merchant names or sensitive details
- Used for specific questions like "When did I pay rent last month?"

### Toggle Consent

Users control doc-level access via:
- **Profile page**: Banking Documents Card
- **Console Drawer**: MoneyPenny Chat toggle

## Testing MoneyPenny

1. Open http://localhost:4321/moneypenny/console
2. Click "💬 Open MoneyPenny Chat"
3. Try these test questions:

**General knowledge (no user data):**
- "What is micro-slippage trading?"
- "Explain the difference between edge and capture"
- "Which chain is best for high-frequency small fills?"

**Performance (uses session insights):**
- "How am I doing today?"
- "Is my 2.1 bps capture good?"
- "Should I adjust my edge threshold?"

**Strategy (uses aggregates):**
- "Based on my surplus volatility, what inventory band do you recommend?"
- "Am I conservative or aggressive?"

**Specific (requires doc_level_excerpts ON):**
- "Show me when I paid rent in September"
- "What was my largest expense last month?"

## API Endpoint

**POST** `http://localhost:8787/chat/answer`

```json
{
  "tenant_id": "qripto-dev",
  "persona_id": "user-demo-001",
  "question": "What's my 24h capture rate?",
  "consent": {
    "doc_level_excerpts": false
  },
  "context": {
    "mem_snippets": "Avg daily surplus: $125\\nVolatility: $45\\nCapture avg: 1.8 bps",
    "session_insights": {
      "capture_bps_24h": 2.1,
      "fills_24h": 47,
      "chains": ["ethereum", "arbitrum", "base"]
    }
  }
}
```

**Response:**
```json
{
  "ok": true,
  "answer": "Your 24h capture rate of 2.1 bps is solid! With 47 fills across Ethereum, Arbitrum, and Base, you're above your historical average of 1.8 bps. This suggests good market conditions and effective edge selection. Keep monitoring - if this holds, consider slightly tightening your min_edge to increase volume while maintaining quality.",
  "meta": {
    "tenant_id": "qripto-dev",
    "persona_id": "user-demo-001",
    "model": "llama-3.3-70b",
    "timestamp": "2025-11-10T19:55:00.000Z"
  }
}
```

## Troubleshooting

### Venice API errors:
```
Venice API key not configured
```
→ Set `VENICE_API_KEY` in `services/aa-api-gateway/.env`

### No response from MoneyPenny:
```
Sorry — I couldn't reach MoneyPenny LLM.
```
→ Check backend logs, verify Venice API key is valid
→ Test endpoint directly: `curl -X POST http://localhost:8787/chat/answer -H "Content-Type: application/json" -d '{"question":"test","tenant_id":"t","persona_id":"p"}'`

### Empty memory snippets:
→ Smart Memories not yet implemented (backend endpoints needed)
→ MoneyPenny will still work with system knowledge + session insights

## Next Steps

1. **Get Venice API key** and configure `.env`
2. **Customize system prompt** in `moneypenny-prompt.ts`
3. **Implement Smart Memories backend** (see integration spec section #6)
4. **Test privacy controls** by toggling doc_level_excerpts
5. **Monitor usage** via Venice dashboard
