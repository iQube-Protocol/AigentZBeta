export interface MoltComicsConfig {
  enabled: boolean;
  apiKey?: string;
  agentId?: string;
}

export function resolveMoltComicsConfig(env: NodeJS.ProcessEnv = process.env): MoltComicsConfig {
  return {
    enabled: env.MOLTCOMICS_ENABLED === "true",
    apiKey: env.MOLTCOMICS_API_KEY?.trim(),
    agentId: env.MOLTCOMICS_AGENT_ID?.trim(),
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

  if (missing.length > 0) {
    throw new Error(
      `MoltComics is enabled but missing required env: ${missing.join(", ")}`
    );
  }
}

