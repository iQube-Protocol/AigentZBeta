import { ApiResult, BusinessModel, IQubeTemplate, IQubeType, InstanceType, RegistryFilter } from "../types/registry";
import { ReputationService } from "./identity/reputationService";

const TEMPLATES_KEY = "registry_templates";

function sampleTemplates(): IQubeTemplate[] {
  return [
    {
      id: "template-001",
      name: "Personal Data iQube",
      description: "Template for storing and managing personal identity information with high security and privacy controls.",
      createdAt: "2025-08-15T12:00:00Z",
      iQubeType: 'DataQube',
      iQubeInstanceType: 'template',
      businessModel: 'Subscribe',
      sensitivityScore: 7,
      riskScore: 8,
      accuracyScore: 9,
      verifiabilityScore: 7,
    },
    {
      id: "template-002",
      name: "Financial Transaction iQube",
      description: "Secure template for recording and verifying financial transactions with audit trails.",
      createdAt: "2025-08-10T14:30:00Z",
      iQubeType: 'DataQube',
      iQubeInstanceType: 'template',
      businessModel: 'Buy',
      sensitivityScore: 6,
      riskScore: 6,
      accuracyScore: 10,
      verifiabilityScore: 9,
    },
    {
      id: "template-003",
      name: "Content Verification iQube",
      description: "Template for verifying the authenticity and provenance of digital content and media.",
      createdAt: "2025-08-05T09:15:00Z",
      iQubeType: 'ContentQube',
      iQubeInstanceType: 'template',
      businessModel: 'License',
      sensitivityScore: 3,
      riskScore: 4,
      accuracyScore: 8,
      verifiabilityScore: 10,
    },
  ];
}

function loadTemplatesLS(): IQubeTemplate[] | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as IQubeTemplate[];
    return null;
  } catch {
    return null;
  }
}

function saveTemplatesLS(templates: IQubeTemplate[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

function hydrateTemplates(): IQubeTemplate[] {
  const ls = loadTemplatesLS();
  if (ls && ls.length) return ls;
  const seed = sampleTemplates();
  saveTemplatesLS(seed);
  return seed;
}

function applyFilter(items: IQubeTemplate[], filter?: RegistryFilter): IQubeTemplate[] {
  if (!filter) return items;
  return items.filter(t => {
    if (filter.search) {
      const s = filter.search.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !t.description.toLowerCase().includes(s)) return false;
    }
    if (filter.type && t.iQubeType && t.iQubeType !== filter.type) return false;
    if (filter.instance && t.iQubeInstanceType && t.iQubeInstanceType !== filter.instance) return false;
    if (filter.businessModel && t.businessModel && t.businessModel !== filter.businessModel) return false;
    return true;
  });
}

export const RegistryService = {
  async listTemplates(filter?: RegistryFilter): Promise<ApiResult<IQubeTemplate[]>> {
    const items = hydrateTemplates();
    const filtered = applyFilter(items, filter);
    return { ok: true, data: filtered };
  },

  async getTemplate(id: string): Promise<ApiResult<IQubeTemplate>> {
    const items = hydrateTemplates();
    const found = items.find(t => t.id === id);
    return found ? { ok: true, data: found } : { ok: false, status: 404, error: 'Not found' };
  },

  async createTemplate(input: Omit<IQubeTemplate, 'id' | 'createdAt'>): Promise<ApiResult<IQubeTemplate>> {
    const items = hydrateTemplates();
    const id = `template-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const next: IQubeTemplate = { id, createdAt, ...input } as IQubeTemplate;
    const updated = [next, ...items];
    saveTemplatesLS(updated);
    return { ok: true, data: next };
  },

  async updateTemplate(id: string, patch: Partial<IQubeTemplate>): Promise<ApiResult<IQubeTemplate>> {
    const items = hydrateTemplates();
    const idx = items.findIndex(t => t.id === id);
    if (idx === -1) return { ok: false, status: 404, error: 'Not found' };
    const updatedItem = { ...items[idx], ...patch } as IQubeTemplate;
    const updated = [...items];
    updated[idx] = updatedItem;
    saveTemplatesLS(updated);
    return { ok: true, data: updatedItem };
  },

  async deleteTemplate(id: string): Promise<ApiResult<null>> {
    const items = hydrateTemplates();
    const updated = items.filter(t => t.id !== id);
    saveTemplatesLS(updated);
    return { ok: true, data: null };
  },

  /**
   * Check if a persona meets the identity/reputation requirements for a template.
   * Non-breaking: returns true if template has no policy hints.
   */
  async checkIdentityPolicy(
    template: IQubeTemplate,
    personaId: string,
    identityState: string,
    reputationPartitionId?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // If template has no policy hints, allow by default (non-breaking)
    if (!template.min_reputation_bucket && !template.require_human_proof && !template.require_agent_declare) {
      return { allowed: true };
    }

    const repService = new ReputationService();

    // Check reputation bucket if required
    if (template.min_reputation_bucket !== undefined && reputationPartitionId) {
      const bucketData = await repService.getBucket(reputationPartitionId);
      if (!bucketData || bucketData.bucket < template.min_reputation_bucket) {
        return { allowed: false, reason: `Reputation bucket ${bucketData?.bucket ?? 0} < required ${template.min_reputation_bucket}` };
      }
    }

    // Check human proof / agent declaration (stubs for Phase 2)
    if (template.require_human_proof) {
      return { allowed: false, reason: 'Human proof required (World ID not yet integrated)' };
    }
    if (template.require_agent_declare) {
      return { allowed: false, reason: 'Agent declaration required (not yet integrated)' };
    }

    return { allowed: true };
  }
};
