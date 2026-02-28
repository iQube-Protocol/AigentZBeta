/**
 * QubeTalk Channel Structure for ClawHack Group Agents
 * 
 * Defines the canonical topic structure for the group agents workspace.
 */

export interface QubeTalkChannelConfig {
  tenant_id: string;
  workspace: string;
}

export class QubeTalkChannels {
  private config: QubeTalkChannelConfig;

  constructor(config: QubeTalkChannelConfig) {
    this.config = config;
  }

  /**
   * Main group channel where all agents participate
   */
  get main(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/group_agents/main`;
  }

  /**
   * Bridge inbound: normalized messages from external surfaces
   */
  get bridgeInbound(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/bridge/inbound`;
  }

  /**
   * Bridge outbound: messages to be published to external surfaces
   */
  get bridgeOutbound(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/bridge/outbound`;
  }

  /**
   * OpenClaw agent requests
   */
  get openclawRequests(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/agents/openclaw/requests`;
  }

  /**
   * OpenClaw agent responses
   */
  get openclawResponses(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/agents/openclaw/responses`;
  }

  /**
   * DVN receipts (audit trail)
   */
  get dvnReceipts(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/dvn/receipts`;
  }

  /**
   * Artifacts minted
   */
  get artifactsMinted(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/artifacts/minted`;
  }

  /**
   * Router coordination
   */
  get router(): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/router/coordination`;
  }

  /**
   * Get all channel topics as an array
   */
  getAllChannels(): string[] {
    return [
      this.main,
      this.bridgeInbound,
      this.bridgeOutbound,
      this.openclawRequests,
      this.openclawResponses,
      this.dvnReceipts,
      this.artifactsMinted,
      this.router,
    ];
  }

  /**
   * Create thread-specific topic
   */
  threadTopic(provider: string, threadId: string): string {
    return `qt://${this.config.tenant_id}/${this.config.workspace}/threads/${provider}/${threadId}`;
  }
}

/**
 * Initialize QubeTalk channels for the workspace
 */
export async function initializeQubeTalkChannels(
  config: QubeTalkChannelConfig,
  qubetalkClient: any // Replace with actual QubeTalk client type
): Promise<QubeTalkChannels> {
  const channels = new QubeTalkChannels(config);
  
  // Create/verify all channels exist
  const allChannels = channels.getAllChannels();
  
  for (const channel of allChannels) {
    // In a real implementation, this would call QubeTalk API to create/verify channel
    console.log(`[QubeTalk] Initializing channel: ${channel}`);
  }
  
  return channels;
}
