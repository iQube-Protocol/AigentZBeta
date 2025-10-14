export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pk = process.env.SIGNER_PRIVATE_KEY;
    if (!pk) {
      return new Response(JSON.stringify({ ok: false, error: "SIGNER_PRIVATE_KEY not set" }), { status: 500, headers: { "content-type": "application/json" } });
    }
    const { ethers } = await import("ethers");
    const wallet = new ethers.Wallet(pk);
    return new Response(JSON.stringify({ ok: true, address: wallet.address }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
