export async function x402PaidFetch(input: RequestInfo, init?: RequestInit, opts?: {
  selectAccept?: (accepts: any[]) => any;
  payAndVerify?: (acceptOption: any) => Promise<{ proofHeaderName: string; proofHeaderValue: string }>;
}) {
  let res = await fetch(input, init);
  if (res.status !== 402) return res;

  const body = await res.json();
  const accepts = Array.isArray(body?.accepts) ? body.accepts : [];
  if (!accepts.length) throw new Error("402 without accepts");
  const accept = opts?.selectAccept ? opts.selectAccept(accepts) : accepts[0];

  if (!opts?.payAndVerify) throw new Error("payAndVerify not provided");
  const proof = await opts.payAndVerify(accept);
  const headers = new Headers(init?.headers || {});
  headers.set(proof.proofHeaderName, proof.proofHeaderValue);

  res = await fetch(input, { ...init, headers });
  return res;
}
