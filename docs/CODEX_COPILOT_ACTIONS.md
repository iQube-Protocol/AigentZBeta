# Multi-Codex System - Copilot Actions Specification

## Overview

This document specifies natural language Copilot actions for managing the multi-codex system. These actions enable intuitive codex management through conversational commands.

## Copilot Action Categories

### 1. Codex Management Actions

#### Create Codex
**Intent**: Create a new codex with specified configuration

**Example Commands**:
- "Create a new codex called 'Developer Docs' with slug 'dev-docs'"
- "Make a codex for the community with purple theme"
- "Set up a new knowledge base codex"

**Parameters**:
- `name` (required): Display name
- `slug` (required): URL-friendly identifier
- `description` (optional): Codex description
- `color` (optional): Theme color
- `category` (optional): Codex category
- `owner` (optional): Owner persona ID

**Action Flow**:
1. Parse natural language for codex details
2. Validate slug uniqueness
3. Create codex via POST `/api/codex/registry`
4. Return codex ID and preview URL

**Response Template**:
```
✅ Created codex "{name}"
📝 Slug: {slug}
🔗 Preview: /triad/embed/codex/{slug}
⚙️ Manage: /admin/codex/{id}
```

#### Update Codex
**Intent**: Modify existing codex properties

**Example Commands**:
- "Update KNYT Codex description to 'Complete KNYT Protocol knowledge base'"
- "Change Qripto Codex color to indigo"
- "Rename AigentiQ Codex to 'AigentiQ Platform'"

**Parameters**:
- `codexId` (required): Codex identifier
- `updates` (required): Properties to update

**Action Flow**:
1. Identify codex from natural language
2. Parse update properties
3. Update via PATCH `/api/codex/registry/{codexId}`
4. Confirm changes

#### Enable/Disable Codex
**Intent**: Toggle codex visibility

**Example Commands**:
- "Enable the Developer Docs codex"
- "Disable Qripto Codex temporarily"
- "Make KNYT Codex visible to users"

**Parameters**:
- `codexId` (required): Codex identifier
- `enabled` (required): true/false

**Action Flow**:
1. Identify codex
2. Update enabled status
3. Confirm visibility change

#### Delete Codex
**Intent**: Remove codex from system

**Example Commands**:
- "Delete the test codex"
- "Remove Developer Docs codex"

**Parameters**:
- `codexId` (required): Codex identifier
- `confirm` (required): Confirmation flag

**Action Flow**:
1. Identify codex
2. Request confirmation
3. Delete via DELETE `/api/codex/registry/{codexId}`
4. Confirm deletion

### 2. Tab Management Actions

#### Add Tab
**Intent**: Create new tab in codex

**Example Commands**:
- "Add a 'Tutorials' tab to KNYT Codex"
- "Create a 'FAQ' tab in Developer Docs with static type"
- "Add liquid-ui tab called 'Dashboard' to AigentiQ Codex"

**Parameters**:
- `codexId` (required): Parent codex
- `label` (required): Tab display name
- `slug` (required): URL-friendly identifier
- `type` (required): static | dynamic | liquid-ui
- `component` (optional): Component name for static tabs
- `liquidTemplate` (optional): Template ID for liquid-ui tabs
- `order` (optional): Display order

**Action Flow**:
1. Identify parent codex
2. Parse tab configuration
3. Create tab via POST `/api/codex/registry/{codexId}/tabs`
4. Return tab details

#### Update Tab
**Intent**: Modify existing tab properties

**Example Commands**:
- "Update Scrolls tab description to 'Sacred scrolls and ancient texts'"
- "Change Features tab to use liquid-ui type"
- "Rename Characters tab to 'Character Cards'"

**Parameters**:
- `codexId` (required): Parent codex
- `tabId` (required): Tab identifier
- `updates` (required): Properties to update

**Action Flow**:
1. Identify codex and tab
2. Parse updates
3. Update via PATCH `/api/codex/registry/{codexId}/tabs/{tabId}`
4. Confirm changes

#### Reorder Tabs
**Intent**: Change tab display order

**Example Commands**:
- "Move Features tab to first position in Qripto Codex"
- "Reorder KNYT Codex tabs: Codex, Scrolls, Characters, Lore"
- "Put Tutorials tab after Documentation tab"

**Parameters**:
- `codexId` (required): Parent codex
- `tabOrder` (required): New order array

**Action Flow**:
1. Identify codex
2. Parse new order
3. Update via POST `/api/codex/registry/{codexId}/tabs/reorder`
4. Confirm new order

#### Enable/Disable Tab
**Intent**: Toggle tab visibility

**Example Commands**:
- "Disable the Rewards tab in Qripto Codex"
- "Enable Tutorials tab"
- "Hide the Beta Features tab"

**Parameters**:
- `codexId` (required): Parent codex
- `tabId` (required): Tab identifier
- `enabled` (required): true/false

**Action Flow**:
1. Identify codex and tab
2. Update enabled status
3. Confirm visibility change

#### Delete Tab
**Intent**: Remove tab from codex

**Example Commands**:
- "Delete the Test tab from KNYT Codex"
- "Remove Beta Features tab"

**Parameters**:
- `codexId` (required): Parent codex
- `tabId` (required): Tab identifier
- `confirm` (required): Confirmation flag

**Action Flow**:
1. Identify codex and tab
2. Request confirmation
3. Delete via DELETE `/api/codex/registry/{codexId}/tabs/{tabId}`
4. Confirm deletion

### 3. Query Actions

#### List Codexes
**Intent**: Retrieve codex information

**Example Commands**:
- "Show me all codexes"
- "List enabled codexes"
- "What codexes are available?"

**Parameters**:
- `filter` (optional): all | enabled | disabled

**Action Flow**:
1. Fetch codexes via GET `/api/codex/registry`
2. Apply filters
3. Format and display results

**Response Template**:
```
📚 Codexes ({count}):

1. KNYT Codex (knyt) - ✅ Enabled
   8 tabs | purple theme | protocol category
   
2. Qripto Codex (qripto) - ✅ Enabled
   7 tabs | indigo theme | publication category
   
3. AigentiQ Codex (aigentiq) - ❌ Disabled
   4 tabs | blue theme | platform category
```

#### Get Codex Details
**Intent**: Retrieve detailed codex information

**Example Commands**:
- "Show me KNYT Codex details"
- "What tabs does Qripto Codex have?"
- "Get configuration for Developer Docs codex"

**Parameters**:
- `codexId` (required): Codex identifier

**Action Flow**:
1. Fetch codex via GET `/api/codex/registry/{codexId}`
2. Format detailed information
3. Display tabs, metadata, permissions

#### Search Content
**Intent**: Find content across codexes

**Example Commands**:
- "Search for 'metaKnyts' in KNYT Codex"
- "Find articles about quantum computing"
- "Show me all lore documents"

**Parameters**:
- `query` (required): Search term
- `codexId` (optional): Limit to specific codex
- `tabType` (optional): Filter by tab type

**Action Flow**:
1. Parse search query
2. Search across relevant APIs
3. Format and display results

### 4. Preview Actions

#### Preview Codex
**Intent**: Generate preview URL for codex

**Example Commands**:
- "Show me a preview of KNYT Codex"
- "Generate embed URL for Qripto Codex with dark theme"
- "Preview Developer Docs codex in narrow mode"

**Parameters**:
- `codexId` (required): Codex identifier
- `theme` (optional): light | dark
- `density` (optional): narrow | wide
- `tab` (optional): Initial tab

**Action Flow**:
1. Identify codex
2. Build preview URL with parameters
3. Return URL and optionally open preview

**Response Template**:
```
🔗 Preview URL:
https://dev-beta.aigentz.me/triad/embed/codex/{slug}?theme={theme}&density={density}&tab={tab}

📱 Test in viewer:
https://dev-beta.aigentz.me/codex/viewer?codex={id}
```

### 5. Bulk Actions

#### Clone Codex
**Intent**: Duplicate existing codex

**Example Commands**:
- "Clone KNYT Codex as 'KNYT Codex v2'"
- "Duplicate Developer Docs for testing"

**Parameters**:
- `sourceCodexId` (required): Codex to clone
- `newName` (required): New codex name
- `newSlug` (required): New slug

**Action Flow**:
1. Fetch source codex configuration
2. Create new codex with modified details
3. Clone all tabs
4. Return new codex details

#### Import Tabs
**Intent**: Import tabs from another codex

**Example Commands**:
- "Import Scrolls and Characters tabs from KNYT Codex to Developer Docs"
- "Copy all tabs from Qripto Codex to Community Codex"

**Parameters**:
- `sourceCodexId` (required): Source codex
- `targetCodexId` (required): Target codex
- `tabIds` (optional): Specific tabs to import

**Action Flow**:
1. Fetch source tabs
2. Create copies in target codex
3. Adjust order as needed
4. Confirm import

#### Batch Update
**Intent**: Update multiple codexes or tabs at once

**Example Commands**:
- "Enable all codexes"
- "Update all tabs in KNYT Codex to use purple color"
- "Disable all beta tabs"

**Parameters**:
- `targets` (required): Codexes or tabs to update
- `updates` (required): Properties to update

**Action Flow**:
1. Identify targets
2. Apply updates to each
3. Report success/failure for each

## Implementation Architecture

### Copilot Action Handler

```typescript
interface CopilotAction {
  intent: string;
  parameters: Record<string, any>;
  context: {
    userId: string;
    codexId?: string;
    tabId?: string;
  };
}

interface CopilotResponse {
  success: boolean;
  message: string;
  data?: any;
  actions?: {
    label: string;
    url: string;
  }[];
}

async function handleCopilotAction(
  action: CopilotAction
): Promise<CopilotResponse> {
  // Route to appropriate handler based on intent
  switch (action.intent) {
    case 'create_codex':
      return await createCodexHandler(action);
    case 'update_codex':
      return await updateCodexHandler(action);
    case 'add_tab':
      return await addTabHandler(action);
    // ... other handlers
  }
}
```

### Natural Language Processing

**Intent Recognition**:
- Use pattern matching for common phrases
- Extract entities (codex names, tab names, properties)
- Validate parameters before execution
- Request clarification for ambiguous commands

**Entity Extraction**:
```typescript
interface ExtractedEntities {
  codexName?: string;
  codexId?: string;
  tabName?: string;
  tabId?: string;
  properties?: Record<string, any>;
  action?: string;
}

function extractEntities(input: string): ExtractedEntities {
  // Parse natural language input
  // Identify codex references
  // Extract property updates
  // Determine action intent
}
```

### Permission Checks

Before executing any action:
1. Verify user has appropriate permissions
2. Check codex ownership
3. Validate edit/admin rights
4. Enforce RLS policies

```typescript
async function checkPermission(
  userId: string,
  codexId: string,
  action: 'view' | 'edit' | 'admin'
): Promise<boolean> {
  const codex = await getCodex(codexId);
  
  if (action === 'view') {
    return codex.permissions.view.includes('*') || 
           codex.permissions.view.includes(userId);
  }
  
  if (action === 'edit') {
    return codex.permissions.edit.includes(userId);
  }
  
  if (action === 'admin') {
    return codex.permissions.admin.includes(userId);
  }
  
  return false;
}
```

## Integration Points

### 1. Copilot UI Component

Location: `/app/triad/components/CopilotCodexManager.tsx`

Features:
- Natural language input field
- Action suggestions
- Command history
- Quick actions menu
- Preview pane

### 2. API Middleware

Location: `/app/api/copilot/codex/route.ts`

Responsibilities:
- Parse natural language commands
- Route to appropriate handlers
- Validate permissions
- Execute actions
- Return formatted responses

### 3. Admin UI Integration

Add Copilot button to:
- Codex management page
- Codex detail page
- Tab editor
- Bulk operations panel

## Example Conversations

### Creating a New Codex

**User**: "Create a new codex for developer documentation"

**Copilot**: 
```
I'll create a new codex for developer documentation. 
What would you like to call it?
```

**User**: "Developer Hub"

**Copilot**:
```
Great! I'll create "Developer Hub" codex.
What slug should I use? (e.g., 'dev-hub')
```

**User**: "dev-hub"

**Copilot**:
```
✅ Created codex "Developer Hub"
📝 Slug: dev-hub
🔗 Preview: /triad/embed/codex/dev-hub
⚙️ Manage: /admin/codex/dev-hub-codex

Would you like to add tabs now?
```

### Managing Tabs

**User**: "Add a Getting Started tab to Developer Hub"

**Copilot**:
```
✅ Added "Getting Started" tab to Developer Hub
📍 Position: 1
🔧 Type: static
⚙️ Configure: /admin/codex/dev-hub-codex

What component should this tab use?
```

**User**: "Use the DocsTab component"

**Copilot**:
```
✅ Updated Getting Started tab
🔧 Component: DocsTab
✨ Ready to use!
```

## Future Enhancements

### AI-Powered Features
- Content generation for tabs
- Automatic tab organization
- Smart suggestions based on usage
- Predictive configuration

### Advanced Actions
- Multi-codex operations
- Scheduled updates
- A/B testing configurations
- Analytics integration

### Voice Commands
- Voice-to-text input
- Audio feedback
- Hands-free management

## Testing Copilot Actions

### Unit Tests
```typescript
describe('Copilot Actions', () => {
  it('should create codex from natural language', async () => {
    const action = {
      intent: 'create_codex',
      parameters: {
        name: 'Test Codex',
        slug: 'test'
      }
    };
    
    const response = await handleCopilotAction(action);
    expect(response.success).toBe(true);
  });
});
```

### Integration Tests
- Test full conversation flows
- Verify API integrations
- Check permission enforcement
- Validate error handling

### User Acceptance Testing
- Natural language understanding
- Response clarity
- Action completion
- Error recovery

## Documentation for Users

### Quick Start Guide
1. Open Copilot in admin interface
2. Type natural language command
3. Follow prompts for clarification
4. Review and confirm actions
5. Check results

### Command Reference
Provide searchable command reference with:
- Intent categories
- Example commands
- Parameter descriptions
- Expected responses

### Best Practices
- Be specific in commands
- Use codex names or IDs
- Confirm destructive actions
- Review changes before saving

## Success Metrics

- **Command Success Rate**: % of commands executed successfully
- **User Satisfaction**: Feedback on natural language understanding
- **Time Savings**: Reduction in manual configuration time
- **Adoption Rate**: % of users using Copilot vs manual UI
- **Error Rate**: % of commands requiring clarification

## Rollout Plan

### Phase 1: Basic Actions (MVP)
- Create/update/delete codex
- Add/update/delete tabs
- List and query operations

### Phase 2: Advanced Actions
- Bulk operations
- Clone and import
- Preview generation

### Phase 3: AI Enhancement
- Smart suggestions
- Content generation
- Predictive configuration

### Phase 4: Voice & Mobile
- Voice commands
- Mobile optimization
- Offline support
