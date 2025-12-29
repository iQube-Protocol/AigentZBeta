import type { Context } from "https://edge.netlify.com";

export default async function handler(req: Request, context: Context) {
  const url = new URL(req.url);
  
  // Only process /triad/embed/* routes
  if (!url.pathname.startsWith("/triad/embed/")) {
    return context.next();
  }

  // Get the response from the origin
  const response = await context.next();
  const headers = new Headers(response.headers);

  // Remove x-frame-options header
  headers.delete("x-frame-options");

  // Rewrite content-security-policy with exactly one frame-ancestors directive
  const csp = headers.get("content-security-policy");
  const frameAncestors = "frame-ancestors 'self' https://qriptopian.lovable.app https://preview--qriptopian.lovable.app";

  if (csp) {
    // Remove any existing frame-ancestors directive
    const filteredCsp = csp
      .split(";")
      .filter(directive => !directive.trim().toLowerCase().startsWith("frame-ancestors"))
      .join(";");
    
    // Add our frame-ancestors directive
    headers.set("content-security-policy", `${filteredCsp}; ${frameAncestors}`);
  } else {
    headers.set("content-security-policy", frameAncestors);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
