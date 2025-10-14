export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const FAUCET_URL = process.env.FAUCET_URL || process.env.NEXT_PUBLIC_FAUCET_URL;
    if (!FAUCET_URL) {
      return new Response(JSON.stringify({ ok: false, error: "FAUCET_URL not configured" }), { status: 500 });
    }
    const body = await req.json();
    const r = await fetch(`${FAUCET_URL}/swap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { "content-type": r.headers.get("content-type") || "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "proxy error" }), { status: 500 });
  }
}
