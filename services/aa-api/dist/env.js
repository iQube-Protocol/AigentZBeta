function parseBoolean(value, fallback) {
    if (typeof value !== 'string')
        return fallback;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized))
        return true;
    if (['0', 'false', 'no', 'off'].includes(normalized))
        return false;
    return fallback;
}
function parseInteger(value) {
    if (typeof value !== 'string' || value.trim().length === 0)
        return undefined;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}
export const env = {
    PORT: parseInt(process.env.PORT || '8080', 10),
    AA_JWT_SECRET: process.env.AA_JWT_SECRET,
    SUPABASE_JWT_SECRET: (process.env.SUPABASE_JWT_SECRET || process.env.AA_JWT_SECRET),
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    REGISTRY_ENDPOINT: process.env.REGISTRY_ENDPOINT,
    REGISTRY_API_KEY: process.env.REGISTRY_API_KEY,
    X402_FACILITATOR_ENDPOINT: process.env.X402_FACILITATOR_ENDPOINT,
    X402_SIGNING_PRIVATE_KEY: process.env.X402_SIGNING_PRIVATE_KEY,
    X402_CALLBACK_PUBLIC_BASE: process.env.X402_CALLBACK_PUBLIC_BASE,
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    RUNTIME_IFRAME_URL: process.env.RUNTIME_IFRAME_URL || process.env.NEXT_PUBLIC_RUNTIME_IFRAME_URL,
    RUNTIME_IFRAME_ORIGIN: process.env.RUNTIME_IFRAME_ORIGIN || process.env.NEXT_PUBLIC_RUNTIME_IFRAME_ORIGIN,
    RUNTIME_POSTMESSAGE_ORIGIN: process.env.RUNTIME_POSTMESSAGE_ORIGIN,
    DEFAULT_TENANT_ID: process.env.DEFAULT_TENANT_ID,
    DEFAULT_PERSONA_ID: process.env.DEFAULT_PERSONA_ID,
    BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID,
    BROWSERBASE_API_BASE_URL: process.env.BROWSERBASE_API_BASE_URL || 'https://api.browserbase.com',
    BROWSERBASE_REGION: process.env.BROWSERBASE_REGION,
    BROWSERBASE_CONTEXT_ID: process.env.BROWSERBASE_CONTEXT_ID,
    BROWSERBASE_KEEP_ALIVE: parseBoolean(process.env.BROWSERBASE_KEEP_ALIVE, true),
    BROWSERBASE_PROXIES: parseBoolean(process.env.BROWSERBASE_PROXIES, false),
    BROWSERBASE_SESSION_TIMEOUT_SECONDS: parseInteger(process.env.BROWSERBASE_SESSION_TIMEOUT_SECONDS),
};
