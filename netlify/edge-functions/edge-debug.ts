// netlify/edge-functions/edge-debug.ts
import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);

  // Let the normal handler run first
  const response = await context.next();

  const headers = new Headers(response.headers);
  // Add a very obvious header so we can see if this ever runs
  headers.set("x-edge-debug", `hit:${url.pathname}`);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
