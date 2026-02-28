export interface MoltComicsConfig {
  enabled: boolean;
  directApi: boolean;
  apiKey?: string;
  agentId?: string;
  apiBaseUrl?: string;
}

export function resolveMoltComicsConfig(env: NodeJS.ProcessEnv = process.env): MoltComicsConfig {
  const apiBaseUrl =
    env.MOLTCOMICS_API_BASE_URL?.trim() ||
    env.MOLTCOMICS_API_ENDPOINT?.trim() ||
    "https://www.moltcomics.com";

  return {
    enabled: env.MOLTCOMICS_ENABLED === "true",
    directApi: env.MOLTCOMICS_DIRECT_API !== "false",
    apiKey: env.MOLTCOMICS_API_KEY?.trim(),
    agentId: env.MOLTCOMICS_AGENT_ID?.trim(),
    apiBaseUrl,
  };
}

export function assertMoltComicsConfig(config: MoltComicsConfig): void {
  if (!config.enabled) {
    return;
  }

  const missing: string[] = [];
  if (!config.apiKey) {
    missing.push("MOLTCOMICS_API_KEY");
  }
  if (!config.agentId) {
    missing.push("MOLTCOMICS_AGENT_ID");
  }
  if (config.directApi && !config.apiBaseUrl) {
    missing.push("MOLTCOMICS_API_BASE_URL");
  }

  if (missing.length > 0) {
    throw new Error(
      `MoltComics is enabled but missing required env: ${missing.join(", ")}`
    );
  }
}
