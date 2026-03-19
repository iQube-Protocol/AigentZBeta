/**
 * Composer In-Memory Store
 * 
 * Temporary storage for Composer v0 development.
 * In production, this would be replaced with a proper database.
 */

// Global in-memory storage that persists across requests
const templates = new Map();
const sessions = new Map();
const experienceQubes = new Map();

export interface ComposerSessionData {
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

export interface ExperienceQubeData {
  id: string;
  name: string;
  description: string;
  goal: string;                    // NEW: contextual purpose
  mechanics: string;               // NEW: experience mechanics
  metrics: string;                 // NEW: success metrics
  tenant_id: string;
  creator_id: string;
  template_id: string;
  status: 'draft' | 'building' | 'testing' | 'published' | 'archived';
  components: any[];
  configuration: Record<string, any>;
  metadata: {
    created_at: string;
    updated_at: string;
    version: string;
    // REMOVED: tags: string[]
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

export interface TemplateData {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'workflow' | 'analysis' | 'interactive';
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimated_time: number;
  required_components: string[];
  optional_components: string[];
  steps: any[];
  preview_image?: string;
  tags: string[];
}

// Template operations
export function createTemplate(template: TemplateData): void {
  templates.set(template.id, template);
}

export function getTemplate(id: string): TemplateData | undefined {
  return templates.get(id);
}

export function getAllTemplates(): TemplateData[] {
  return Array.from(templates.values());
}

export function updateTemplate(id: string, updates: Partial<TemplateData>): boolean {
  const template = templates.get(id);
  if (!template) return false;
  
  Object.assign(template, updates);
  return true;
}

export function deleteTemplate(id: string): boolean {
  return templates.delete(id);
}

// Session operations
export function createSession(session: ComposerSessionData): void {
  sessions.set(session.id, session);
}

export function getSession(id: string): ComposerSessionData | undefined {
  const session = sessions.get(id);
  
  // Check if session is expired
  if (session && new Date(session.expires_at) < new Date()) {
    sessions.delete(id);
    return undefined;
  }
  
  return session;
}

export function getAllSessions(): ComposerSessionData[] {
  return Array.from(sessions.values());
}

export function updateSession(id: string, updates: Partial<ComposerSessionData>): boolean {
  const session = sessions.get(id);
  if (!session) return false;
  
  Object.assign(session, updates, { updated_at: new Date().toISOString() });
  return true;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

// ExperienceQube operations
export function createExperienceQube(experienceQube: ExperienceQubeData): void {
  console.log('Store: Creating ExperienceQube:', experienceQube.id);
  experienceQubes.set(experienceQube.id, experienceQube);
  console.log('Store: Total ExperienceQubes after creation:', experienceQubes.size);
}

export function getExperienceQube(id: string): ExperienceQubeData | undefined {
  return experienceQubes.get(id);
}

export function getAllExperienceQubes(): ExperienceQubeData[] {
  return Array.from(experienceQubes.values());
}

export function updateExperienceQube(id: string, updates: Partial<ExperienceQubeData>): boolean {
  const experienceQube = experienceQubes.get(id);
  if (!experienceQube) return false;
  
  Object.assign(experienceQube, updates, {
    metadata: {
      ...experienceQube.metadata,
      ...updates.metadata,
      updated_at: new Date().toISOString(),
    }
  });
  return true;
}

export function deleteExperienceQube(id: string): boolean {
  return experienceQubes.delete(id);
}

// Utility functions
export function clearAll(): void {
  templates.clear();
  sessions.clear();
  experienceQubes.clear();
}

export function getStoreStats() {
  return {
    templates: templates.size,
    sessions: sessions.size,
    experienceQubes: experienceQubes.size,
  };
}

// Auto-cleanup expired sessions
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  
  sessions.forEach((session, id) => {
    if (new Date(session.expires_at) < now) {
      sessions.delete(id);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired Composer sessions`);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Initialize with default templates
export function initializeDefaultTemplates(): void {
  // Content Analysis Template
  const contentAnalysisTemplate: TemplateData = {
    id: 'content_analysis_v1',
    name: 'Content Analysis Workflow',
    description: 'Analyze and summarize content using AI-powered tools',
    category: 'analysis',
    complexity: 'intermediate',
    estimated_time: 15,
    required_components: ['ContentQube', 'ModelQube'],
    optional_components: ['DataQube'],
    steps: [
      {
        id: 'content_selection',
        title: 'Select Content',
        description: 'Choose the content to analyze',
        type: 'selection',
        required: true,
        component_type: 'ContentQube',
        ui_config: {
          layout: 'wizard',
          fields: [
            {
              id: 'content_id',
              name: 'Content Source',
              type: 'select',
              required: true,
              help_text: 'Select the content you want to analyze',
            },
          ],
        },
      },
      {
        id: 'analysis_configuration',
        title: 'Configure Analysis',
        description: 'Set up the analysis parameters',
        type: 'configuration',
        required: true,
        component_type: 'ModelQube',
        validation_rules: [
          {
            type: 'risk_tier',
            condition: 'risk_tier <= medium',
            error_message: 'This template only supports low to medium risk analysis',
            severity: 'error',
          },
        ],
        ui_config: {
          layout: 'form',
          fields: [
            {
              id: 'analysis_type',
              name: 'Analysis Type',
              type: 'select',
              required: true,
              options: [
                { value: 'summarize', label: 'Summarize' },
                { value: 'extract', label: 'Extract Key Points' },
                { value: 'classify', label: 'Classify Content' },
              ],
            },
            {
              id: 'max_tokens',
              name: 'Max Output Length',
              type: 'slider',
              required: false,
              validation: { min: 100, max: 2000 },
              default_value: 500,
            },
          ],
        },
      },
    ],
    tags: ['analysis', 'content', 'ai'],
  };

  // Interactive Story Template
  const interactiveStoryTemplate: TemplateData = {
    id: 'interactive_story_v1',
    name: 'Interactive Story Experience',
    description: 'Create an interactive narrative with user choices',
    category: 'interactive',
    complexity: 'beginner',
    estimated_time: 30,
    required_components: ['ContentQube'],
    optional_components: ['ToolQube', 'AgentQube'],
    steps: [
      {
        id: 'story_setup',
        title: 'Story Setup',
        description: 'Configure your interactive story',
        type: 'configuration',
        required: true,
        component_type: 'ContentQube',
        ui_config: {
          layout: 'form',
          fields: [
            {
              id: 'story_title',
              name: 'Story Title',
              type: 'text',
              required: true,
              help_text: 'Enter a title for your interactive story',
            },
            {
              id: 'genre',
              name: 'Genre',
              type: 'select',
              required: true,
              options: [
                { value: 'fantasy', label: 'Fantasy' },
                { value: 'scifi', label: 'Science Fiction' },
                { value: 'mystery', label: 'Mystery' },
                { value: 'adventure', label: 'Adventure' },
              ],
            },
          ],
        },
      },
    ],
    tags: ['interactive', 'story', 'narrative'],
  };

  // Qriptopian Reading Sprint Template
  const qriptopianReadingSprint: TemplateData = {
    id: 'qriptopian_reading_sprint_v0',
    name: 'Qriptopian Reading Sprint',
    description: 'Guided 15–20 minute reading sprint with takeaways and rewards.',
    category: 'content',
    complexity: 'beginner',
    estimated_time: 20,
    required_components: ['ContentQube', 'ToolQube'],
    optional_components: ['DataQube', 'ModelQube'],
    steps: [
      {
        id: 'intent_timebox',
        title: 'Intent + Timebox',
        description: 'Capture the reader goal and session constraints.',
        type: 'selection',
        required: true,
        ui_config: {
          layout: 'wizard',
          fields: [
            {
              id: 'experience_name',
              name: 'Experience Name',
              type: 'text',
              required: true,
              default_value: 'Qriptopian Reading Sprint',
              help_text: 'Shown in the Codex workspace header.',
            },
            {
              id: 'goal',
              name: 'Goal',
              type: 'select',
              required: true,
              options: [
                { value: 'agentic_payments', label: 'Agentic Payments' },
                { value: 'dvn', label: 'DVN + Verification' },
                { value: 'liquid_ui', label: 'Liquid UI' },
                { value: 'iqubes', label: 'iQubes + Registry' },
                { value: 'qubetalk', label: 'QubeTalk' },
              ],
            },
            {
              id: 'time_available',
              name: 'Time Available',
              type: 'select',
              required: true,
              options: [
                { value: '10', label: '10 minutes' },
                { value: '15', label: '15 minutes' },
                { value: '20', label: '20 minutes' },
              ],
            },
            {
              id: 'depth',
              name: 'Depth',
              type: 'select',
              required: true,
              options: [
                { value: 'overview', label: 'Overview' },
                { value: 'practical', label: 'Practical' },
                { value: 'technical', label: 'Technical' },
              ],
            },
          ],
        },
      },
      {
        id: 'content_selection',
        title: 'Content Selection',
        description: 'Choose the feature article and supporting items.',
        type: 'selection',
        required: true,
        component_type: 'ContentQube',
        ui_config: {
          layout: 'form',
          fields: [
            {
              id: 'feature_item_id',
              name: 'Feature Article',
              type: 'select',
              required: true,
              options: [
                {
                  value: 'd51579d4-6dad-48d6-9c1a-5b0904fd46f4',
                  label: 'The Penny Is Dead, Long Live the Penny',
                  description: 'Issue 0 feature article',
                },
                {
                  value: 'fa4eada5-1908-477f-9fe2-d983ce95b7e8',
                  label: 'The Great Rebundling',
                  description: 'Issue 1 feature article',
                },
                {
                  value: '7fcaffe0-1208-4af0-b7a6-c38dfb1a6503',
                  label: 'QriptoMedia',
                  description: 'Media analysis article',
                },
                {
                  value: 'c6df8819-2420-465a-a42e-e14792f76f6d',
                  label: 'Facebook buys Manus: You are no longer the product. Your Action is.',
                  description: 'Issue 0 feature article',
                },
              ],
            },
            {
              id: 'supporting_item_ids',
              name: 'Supporting Items',
              type: 'multiselect',
              required: false,
              options: [
                {
                  value: 'd51579d4-6dad-48d6-9c1a-5b0904fd46f4',
                  label: 'The Penny Is Dead, Long Live the Penny',
                },
                {
                  value: 'fa4eada5-1908-477f-9fe2-d983ce95b7e8',
                  label: 'The Great Rebundling: Why Studio M&A Signals a Unit Economics Crisis',
                },
                {
                  value: '7fcaffe0-1208-4af0-b7a6-c38dfb1a6503',
                  label: 'QriptoMedia: From Media Files to Media Objects',
                },
                {
                  value: 'c6df8819-2420-465a-a42e-e14792f76f6d',
                  label: 'Facebook buys Manus: You are no longer the product. Your Action is.',
                },
              ],
              help_text: 'Optional supporting cards or articles for the shelf.',
            },
            {
              id: 'issue_slug',
              name: 'Issue',
              type: 'select',
              required: true,
              options: [
                { value: 'issue-0', label: 'Issue 0' },
                { value: 'issue-1', label: 'Issue 1' },
              ],
            },
            {
              id: 'preview_enabled',
              name: 'Enable Preview Mode',
              type: 'checkbox',
              required: false,
              default_value: true,
            },
          ],
        },
      },
      {
        id: 'image_generation',
        title: 'Hero Image Generation',
        description: 'Plan portrait and landscape hero imagery for the reading experience.',
        type: 'configuration',
        required: false,
        component_type: 'ToolQube',
        ui_config: {
          layout: 'form',
          fields: [
            {
              id: 'provider_id',
              name: 'Image Provider',
              type: 'select',
              required: false,
              default_value: 'openai',
              options: [
                { value: 'openai', label: 'OpenAI Image Generation' },
                { value: 'venice', label: 'Venice Image Generation' },
              ],
            },
            {
              id: 'portrait_prompt',
              name: 'Portrait Prompt',
              type: 'textarea',
              required: false,
            },
            {
              id: 'landscape_prompt',
              name: 'Landscape Prompt',
              type: 'textarea',
              required: false,
            },
            {
              id: 'visual_style',
              name: 'Visual Style',
              type: 'select',
              required: false,
              options: [
                { value: 'editorial', label: 'Editorial' },
                { value: 'cinematic', label: 'Cinematic' },
                { value: 'illustrative', label: 'Illustrative' },
                { value: 'photorealistic', label: 'Photorealistic' },
              ],
            },
          ],
        },
      },
      {
        id: 'wallet_rewards',
        title: 'Wallet + Rewards',
        description: 'Configure unlock pricing and completion rewards.',
        type: 'configuration',
        required: true,
        component_type: 'DataQube',
        ui_config: {
          layout: 'form',
          fields: [
            {
              id: 'unlock_price',
              name: 'Unlock Price (Qc)',
              type: 'slider',
              required: true,
              validation: { min: 0.01, max: 0.1, step: 0.01 },
              default_value: 0.05,
            },
            {
              id: 'reward_amount',
              name: 'Completion Reward (Qc)',
              type: 'slider',
              required: false,
              validation: { min: 0, max: 0.05, step: 0.01 },
              default_value: 0.01,
            },
            {
              id: 'require_wallet_connect',
              name: 'Require Wallet Connect',
              type: 'checkbox',
              required: false,
              default_value: true,
            },
          ],
        },
      },
      {
        id: 'copilot_output',
        title: 'Copilot Output',
        description: 'Define what the copilot should generate after reading.',
        type: 'configuration',
        required: true,
        component_type: 'ToolQube',
        ui_config: {
          layout: 'form',
          fields: [
            {
              id: 'outputs',
              name: 'Outputs',
              type: 'multiselect',
              required: true,
              options: [
                { value: 'takeaways', label: '3 Takeaways' },
                { value: 'glossary', label: 'Glossary' },
                { value: 'next_action', label: 'Next Action' },
              ],
            },
            {
              id: 'takeaways_count',
              name: 'Takeaways Count',
              type: 'slider',
              required: false,
              validation: { min: 1, max: 5, step: 1 },
              default_value: 3,
            },
          ],
        },
      },
    ],
    tags: ['qriptopian', 'reading', 'smarttriad'],
  };

  // Sora Video Generation Template (Skill-backed)
  const soraVideoGeneration: TemplateData = {
    id: 'sora-video-generation',
    name: 'Sora Video Generation',
    description: 'Generate AI video using OpenAI Sora skill — curated or community. Full supply chain with trust badges, PoSR, and DVN receipts.',
    category: 'interactive',
    complexity: 'intermediate',
    estimated_time: 15,
    required_components: ['ToolQube'],
    optional_components: ['DataQube'],
    steps: [
      {
        id: 'intent_timebox',
        title: 'Video Intent',
        description: 'Define the video generation goal and creative context.',
        type: 'selection',
        required: true,
        ui_config: {
          layout: 'form',
          fields: [
            { id: 'experience_name', name: 'Experience Name', type: 'text', required: true },
            { id: 'goal', name: 'Creative Goal', type: 'textarea', required: false },
            {
              id: 'creative_pack', name: 'Creative Pack', type: 'select', required: false,
              options: [
                { value: 'metaKnyts_motion_comic', label: 'metaKnyts Motion Comic' },
                { value: 'synthsimms_trailer', label: 'SynthSimms Trailer' },
                { value: 'penny_drops_explainer', label: 'Penny Drops Explainer' },
                { value: 'custom', label: 'Custom / Freeform' },
              ],
            },
          ],
        },
      },
      {
        id: 'skill_selection',
        title: 'Skill Selection',
        description: 'Choose between OpenAI, Venice, or community-backed video generation skills.',
        type: 'selection',
        required: true,
        component_type: 'ToolQube',
        ui_config: {
          layout: 'form',
          fields: [
            {
              id: 'skill_id', name: 'Sora Skill', type: 'select', required: true,
              default_value: 'sora_video_gen_curated',
              options: [
                { value: 'sora_video_gen_curated', label: 'Sora Video Gen (Curated) — Badge A, Trusted' },
                { value: 'venice_video_gen', label: 'Venice Video Gen — Badge A, Trusted' },
                { value: 'sora_video_gen_community', label: 'Sora Video Gen (Community) — Badge C, Basic' },
              ],
            },
            { id: 'trust_override', name: 'Accept lower trust badge?', type: 'checkbox', required: false },
          ],
        },
      },
      {
        id: 'video_prompt',
        title: 'Video Prompt',
        description: 'Describe the video you want to generate.',
        type: 'configuration',
        required: true,
        ui_config: {
          layout: 'form',
          fields: [
            { id: 'prompt', name: 'Video Prompt', type: 'textarea', required: true },
            { id: 'duration', name: 'Duration (seconds)', type: 'slider', required: false, validation: { min: 5, max: 60, step: 5 } },
            {
              id: 'aspect_ratio', name: 'Aspect Ratio', type: 'select', required: false,
              options: [
                { value: '16:9', label: 'Landscape (16:9)' },
                { value: '9:16', label: 'Portrait (9:16)' },
                { value: '1:1', label: 'Square (1:1)' },
              ],
            },
            {
              id: 'style', name: 'Visual Style', type: 'select', required: false,
              options: [
                { value: 'cinematic', label: 'Cinematic' },
                { value: 'animation', label: 'Animation' },
                { value: 'comic', label: 'Comic Book' },
                { value: 'photorealistic', label: 'Photorealistic' },
              ],
            },
          ],
        },
      },
      {
        id: 'wallet_rewards',
        title: 'Rewards (Optional)',
        description: 'Configure optional rewards for video creation.',
        type: 'configuration',
        required: false,
        ui_config: {
          layout: 'form',
          fields: [
            { id: 'reward_amount', name: 'Reward amount (Q¢)', type: 'text', required: false },
          ],
        },
      },
    ],
    tags: ['video', 'sora', 'creative', 'skill', 'openclaw'],
  };

  createTemplate(contentAnalysisTemplate);
  createTemplate(interactiveStoryTemplate);
  createTemplate(qriptopianReadingSprint);
  createTemplate(soraVideoGeneration);
}

// Initialize default templates on import
initializeDefaultTemplates();
