export const env = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  AA_JWT_SECRET: process.env.AA_JWT_SECRET as string,
  SUPABASE_JWT_SECRET: (process.env.SUPABASE_JWT_SECRET || process.env.AA_JWT_SECRET) as string,
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  REGISTRY_ENDPOINT: process.env.REGISTRY_ENDPOINT as string,
  REGISTRY_API_KEY: process.env.REGISTRY_API_KEY as string,
  X402_FACILITATOR_ENDPOINT: process.env.X402_FACILITATOR_ENDPOINT as string,
  X402_SIGNING_PRIVATE_KEY: process.env.X402_SIGNING_PRIVATE_KEY as string,
  X402_CALLBACK_PUBLIC_BASE: process.env.X402_CALLBACK_PUBLIC_BASE as string,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};
