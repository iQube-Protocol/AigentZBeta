/**
 * Quote Publisher for MoneyPenny Demo
 * Publishes simulated trading quotes to AigentZ API
 */

const AA_API_BASE = process.env.AA_API_BASE || 'http://localhost:8080';
const DID = process.env.TEST_DID || 'did:qripto:trader1';
const PUBLISH_INTERVAL = 2000; // 2 seconds

interface Quote {
  symbol: string;
  bid: string;
  ask: string;
  mid?: string;
  source?: string;
  extra?: Record<string, any>;
}

let authToken: string | null = null;

async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;

  // Get challenge
  const challengeRes = await fetch(`${AA_API_BASE}/aa/v1/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did: DID })
  });

  if (!challengeRes.ok) {
    throw new Error(`Challenge failed: ${challengeRes.status}`);
  }

  const { nonce } = await challengeRes.json();

  // Verify (dev mode accepts any signature)
  const verifyRes = await fetch(`${AA_API_BASE}/aa/v1/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did: DID, signature: `dev_sig_${nonce}` })
  });

  if (!verifyRes.ok) {
    throw new Error(`Verify failed: ${verifyRes.status}`);
  }

  const { aa_token } = await verifyRes.json();
  authToken = aa_token;
  console.log('✓ Authenticated successfully');
  return aa_token;
}

async function publishQuote(quote: Quote): Promise<void> {
  const token = await getAuthToken();

  const res = await fetch(`${AA_API_BASE}/aa/v1/quotes/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(quote)
  });

  if (!res.ok) {
    console.error(`❌ Failed to publish quote: ${res.status}`, await res.text());
    return;
  }

  const data = await res.json();
  console.log(`✓ Published: ${quote.symbol} ${quote.bid}/${quote.ask} (${quote.source})`);
}

function generateQuote(): Quote {
  const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ARB-USD', 'MATIC-USD'];
  const sources = ['Uniswap', 'Curve', '1inch', 'Jupiter', 'QuickSwap'];

  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const source = sources[Math.floor(Math.random() * sources.length)];

  // Generate realistic prices
  let basePrice = 0;
  if (symbol === 'BTC-USD') basePrice = 65000 + Math.random() * 5000;
  else if (symbol === 'ETH-USD') basePrice = 3200 + Math.random() * 300;
  else if (symbol === 'SOL-USD') basePrice = 145 + Math.random() * 20;
  else if (symbol === 'ARB-USD') basePrice = 1.2 + Math.random() * 0.3;
  else if (symbol === 'MATIC-USD') basePrice = 0.8 + Math.random() * 0.2;

  const spread_bps = Math.random() * 10 + 2; // 2-12 bps spread
  const spread = basePrice * (spread_bps / 10000);

  const bid = (basePrice - spread / 2).toFixed(6);
  const ask = (basePrice + spread / 2).toFixed(6);

  return {
    symbol,
    bid,
    ask,
    source,
    extra: {
      spread_bps: spread_bps.toFixed(2),
      volume_24h: (Math.random() * 1000000).toFixed(2)
    }
  };
}

async function run() {
  console.log('🚀 Starting Quote Publisher');
  console.log(`   API: ${AA_API_BASE}`);
  console.log(`   DID: ${DID}`);
  console.log(`   Interval: ${PUBLISH_INTERVAL}ms`);
  console.log('');

  // Test authentication
  try {
    await getAuthToken();
  } catch (e) {
    console.error('❌ Authentication failed:', (e as Error).message);
    console.error('   Make sure aa-api is running on', AA_API_BASE);
    process.exit(1);
  }

  // Publish quotes on interval
  setInterval(async () => {
    try {
      const quote = generateQuote();
      await publishQuote(quote);
    } catch (e) {
      console.error('❌ Error:', (e as Error).message);
    }
  }, PUBLISH_INTERVAL);

  console.log('📊 Publishing quotes...\n');
}

run().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
