import type { Context } from "https://edge.netlify.com";

export default async function handler(request: Request, context: Context) {
  return new Response("ok-from-edge", {
    status: 200,
    headers: { "x-edge-test": "1" },
  });
}
