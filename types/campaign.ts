export type CampaignGroup = 'rewarded' | 'purchase';

export interface CampaignPhase {
  id: string;
  label: string;
  eventTypes: string[];
  counterKey?: string;
  targetCount?: number;
}

export interface CampaignDefinition {
  id: string;
  title: string;
  franchiseId: string;
  tenantId: string;
  group: CampaignGroup;
  phases: CampaignPhase[];
}

export interface CampaignEventInput {
  campaignId: string;
  eventType: string;
  personaId: string;
  referrerPersonaId?: string | null;
  contentId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
  tenantId?: string | null;
  franchiseId?: string | null;
}

export interface CampaignState {
  id: string;
  campaignId: string;
  personaId: string;
  tenantId: string;
  franchiseId: string;
  progress: number;
  currentPhaseId: string | null;
  state: {
    startedAt: string;
    phases: Array<{
      id: string;
      label: string;
      completedAt?: string;
      targetCount?: number;
      counterKey?: string;
    }>;
    counters: Record<string, number>;
  };
  updatedAt: string;
}

export interface CampaignStateView {
  campaignId: string;
  title: string;
  group: CampaignGroup;
  personaId: string;
  progress: number;
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
  phases: CampaignPhase[];
  counters: Record<string, number>;
}
