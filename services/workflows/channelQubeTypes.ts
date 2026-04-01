export interface ChannelQube {
  id: string;
  workflowId: string;
  tenantId: string;
  channelName: string;
  thread: string;
  participatingAgents: string[];
  policyRef?: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
