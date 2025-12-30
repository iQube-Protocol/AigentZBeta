export const env = {
    PORT: parseInt(process.env.PORT || '8080', 10),
    AA_JWT_SECRET: process.env.AA_JWT_SECRET || '',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
    REGISTRY_ENDPOINT: process.env.REGISTRY_ENDPOINT || '',
    REGISTRY_API_KEY: process.env.REGISTRY_API_KEY || '',
    X402_FACILITATOR_ENDPOINT: process.env.X402_FACILITATOR_ENDPOINT || '',
    X402_SIGNING_PRIVATE_KEY: process.env.X402_SIGNING_PRIVATE_KEY || '',
    X402_CALLBACK_PUBLIC_BASE: process.env.X402_CALLBACK_PUBLIC_BASE || '',
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    X402_AUTOSUBMIT: process.env.X402_AUTOSUBMIT === 'true'
};
