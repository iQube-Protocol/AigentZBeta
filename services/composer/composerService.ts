/**
 * Composer v0 Service
 * 
 * Service for creating and managing ExperienceQubes through guided orchestration.
 * Handles the backend logic for the Composer v0 wizard and ExperienceQube lifecycle.
 */

import { receiptService } from '@/services/receipts/receiptService';
import {
  getTemplate as getStoreTemplate,
  getAllTemplates,
  type ComposerSessionData,
  type ExperienceQubeData,
} from '@/services/composer/composerStore';
import {
  createExperienceRecord,
  deleteExperienceRecord,
  getExperienceRecord,
  listExperienceRecords,
  updateExperienceRecord,
  createSessionRecord,
  getSessionRecord,
  updateSessionRecord,
} from '@/services/composer/composerPersistence';

export interface ExperienceQubeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'workflow' | 'analysis' | 'interactive';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimated_time: number; // in minutes
  required_components: string[];
  optional_components: string[];
  steps: ComposerStep[];
  preview_image?: string;
  tags: string[];
}

export interface ComposerStep {
  id: string;
  title: string;
  description: string;
  type: 'selection' | 'configuration' | 'validation' | 'preview';
  required: boolean;
  component_type?: 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AgentQube';
  validation_rules?: ValidationRule[];
  ui_config: {
    layout: 'wizard' | 'form' | 'grid' | 'timeline';
    fields: ComposerField[];
  };
}

export interface ComposerField {
  id: string;
  name: string;
  type: 'text' | 'select' | 'multiselect' | 'checkbox' | 'slider' | 'textarea';
  required: boolean;
  options?: Array<{ value: string; label: string; description?: string }>;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    pattern?: string;
    custom?: string;
  };
  default_value?: any;
  help_text?: string;
}

export interface ValidationRule {
  type: 'required' | 'risk_tier' | 'compatibility' | 'entitlement' | 'custom';
  condition: string;
  error_message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ExperienceQube {
  id: string;
  name: string;
  description: string;
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: 'draft' | 'building' | 'testing' | 'published' | 'archived';
  components: ExperienceQubeComponent[];
  configuration: Record<string, any>;
  metadata: {
    created_at: string;
    updated_at: string;
    version: string;
    tags: string[];
    category: string;
  };
  execution: {
    auto_start: boolean;
    retry_policy: 'none' | 'linear' | 'exponential';
    timeout_seconds: number;
    max_concurrent_users: number;
  };
  access: {
    visibility: 'private' | 'tenant' | 'public';
    required_entitlements: string[];
    allowed_roles: string[];
  };
}

export interface ExperienceQubeComponent {
  id: string;
  component_id: string; // Reference to Registry component
  component_type: 'DataQube' | 'ContentQube' | 'ToolQube' | 'ModelQube' | 'AgentQube';
  name: string;
  description: string;
  configuration: Record<string, any>;
  dependencies: string[]; // Other component IDs this depends on
  risk_tier: 'low' | 'medium' | 'high';
  entitlement_required: boolean;
}

export interface ComposerSession {
  id: string;
  tenant_id: string;
  user_id: string;
  template_id: string;
  current_step: number;
  status: 'active' | 'completed' | 'abandoned';
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export class ComposerService {
  constructor() {
    // Templates are initialized in the store
  }

  // Template Management
  async getTemplates(category?: string, complexity?: string): Promise<ExperienceQubeTemplate[]> {
    let templates = getAllTemplates();
    
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    if (complexity) {
      templates = templates.filter(t => t.complexity === complexity);
    }

    return templates;
  }

  async getTemplate(templateId: string): Promise<ExperienceQubeTemplate | null> {
    return getStoreTemplate(templateId) || null;
  }

  // Session Management
  async createSession(params: {
    tenant_id: string;
    user_id: string;
    template_id: string;
  }): Promise<ComposerSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const session: ComposerSessionData = {
      id: sessionId,
      tenant_id: params.tenant_id,
      user_id: params.user_id,
      template_id: params.template_id,
      current_step: 0,
      status: 'active',
      data: {},
      created_at: now,
      updated_at: now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    const stored = await createSessionRecord(session);
    return stored;
  }

  async getSession(sessionId: string): Promise<ComposerSession | null> {
    const session = await getSessionRecord(sessionId);
    return session || null;
  }

  async updateSession(sessionId: string, updates: Partial<ComposerSession>): Promise<ComposerSession | null> {
    const updated = await updateSessionRecord(sessionId, updates as ComposerSessionData);
    return updated || null;
  }

  async completeSession(sessionId: string): Promise<ExperienceQube | null> {
    const session = await getSessionRecord(sessionId);
    if (!session) return null;

    // Create ExperienceQube from session data
    const template = await this.getTemplate(session.template_id);
    if (!template) return null;

    const intentData = (session.data as Record<string, any>)?.intent_timebox || {};
    const experienceName = intentData.experience_name || session.data?.name || `${template.name} Experience`;
    const experienceQube = await this.createExperienceQube({
      tenant_id: session.tenant_id,
      creator_id: session.user_id,
      template_id: session.template_id,
      name: experienceName,
      description: session.data?.description || template.description,
      configuration: session.data,
    });

    // Mark session as completed
    await this.updateSession(sessionId, { status: 'completed' });
    
    return experienceQube;
  }

  // ExperienceQube Management
  async createExperienceQube(params: {
    tenant_id: string;
    creator_id: string;
    template_id: string;
    name: string;
    description: string;
    configuration: Record<string, any>;
  }): Promise<ExperienceQube> {
    const experienceId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const template = await this.getTemplate(params.template_id);
    
    if (!template) {
      throw new Error('Template not found');
    }

    const now = new Date().toISOString();
    
    const experienceQube: ExperienceQubeData = {
      id: experienceId,
      name: params.name,
      description: params.description,
      tenant_id: params.tenant_id,
      creator_id: params.creator_id,
      template_id: params.template_id,
      status: 'draft',
      components: [], // Will be populated based on configuration
      configuration: params.configuration,
      metadata: {
        created_at: now,
        updated_at: now,
        version: '1.0.0',
        tags: template.tags,
        category: template.category,
      },
      execution: {
        auto_start: false,
        retry_policy: 'none',
        timeout_seconds: 300, // 5 minutes default
        max_concurrent_users: 10,
      },
      access: {
        visibility: 'private',
        required_entitlements: [],
        allowed_roles: ['tenant_owner', 'tenant_agent'],
      },
    };

    const stored = await createExperienceRecord(experienceQube);
    console.log('ExperienceQube created in store:', stored.id);

    // Create receipt for ExperienceQube creation
    try {
      await receiptService.createSmartTriadReceipt({
        action: 'create_experience_qube',
        component: 'composer',
        tenantId: params.tenant_id,
        result: {
          experienceId,
          templateId: params.template_id,
          creatorId: params.creator_id,
          name: params.name,
          status: 'draft',
        },
      });
    } catch (error) {
      console.warn('Failed to create ExperienceQube receipt:', error);
    }

    return stored;
  }

  async getExperienceQube(experienceId: string): Promise<ExperienceQube | null> {
    console.log('Retrieving ExperienceQube:', experienceId);
    const experience = await getExperienceRecord(experienceId);
    console.log('Found ExperienceQube:', experience ? experience.id : 'null');
    return experience || null;
  }

  async listExperienceQubes(params: {
    tenant_id?: string;
    creator_id?: string;
    status?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ExperienceQube[]; total: number }> {
    console.log('Listing ExperienceQubes with params:', params);
    const result = await listExperienceRecords(params);
    console.log('Total ExperienceQubes in store:', result.total);
    return { items: result.items as ExperienceQube[], total: result.total };
  }

  async updateExperienceQube(experienceId: string, updates: Partial<ExperienceQube>): Promise<ExperienceQube | null> {
    const updated = await updateExperienceRecord(experienceId, updates as ExperienceQubeData);
    return updated || null;
  }

  async deleteExperienceQube(experienceId: string): Promise<boolean> {
    const deleted = await deleteExperienceRecord(experienceId);
    
    if (deleted) {
      try {
        await receiptService.createSmartTriadReceipt({
          action: 'delete_experience_qube',
          component: 'composer',
          result: { experienceId, deleted: true },
        });
      } catch (error) {
        console.warn('Failed to create deletion receipt:', error);
      }
    }
    
    return deleted;
  }

  // Validation
  async validateConfiguration(templateId: string, configuration: Record<string, any>): Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }>;
    warnings: Array<{ field: string; message: string }>;
  }> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      return {
        valid: false,
        errors: [{ field: 'template', message: 'Template not found', severity: 'error' }],
        warnings: [],
      };
    }

    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validate each step's configuration
    for (const step of template.steps) {
      if (step.validation_rules) {
        for (const rule of step.validation_rules) {
          const validationResult = this.applyValidationRule(rule, configuration, step.id);
          if (!validationResult.valid) {
            if (rule.severity === 'info') {
              warnings.push({ field: step.id, message: rule.error_message });
            } else {
              errors.push({
                field: step.id,
                message: rule.error_message,
                severity: rule.severity,
              });
            }
          }
        }
      }
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
    };
  }

  private applyValidationRule(rule: ValidationRule, configuration: Record<string, any>, stepId: string): {
    valid: boolean;
  } {
    // Simple validation logic - in production, this would be more sophisticated
    switch (rule.type) {
      case 'required':
        return { valid: configuration[stepId] !== undefined && configuration[stepId] !== '' };
      
      case 'risk_tier':
        // Check if selected components exceed risk tier
        const selectedTier = (configuration[stepId]?.risk_tier as 'low' | 'medium' | 'high') || 'low';
        const maxAllowedTier = (configuration.max_risk_tier as 'low' | 'medium' | 'high') || 'medium';
        const tierOrder: Record<'low' | 'medium' | 'high', number> = { low: 1, medium: 2, high: 3 };
        return { valid: tierOrder[selectedTier] <= tierOrder[maxAllowedTier] };
      
      default:
        return { valid: true };
    }
  }
}

// Singleton instance
export const composerService = new ComposerService();
