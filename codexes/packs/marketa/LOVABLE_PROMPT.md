/**
 * Lovable Prompt for Marketa Console Thin Client
 * 
 * Copy and paste this into Lovable.dev to generate the complete Marketa Console UI
 * as an experience cartridge that can be deployed via Codex without core AigentZ modifications.
 */

Build a thin-client marketing console called "Marketa Console" as an experience cartridge for the AigentZ ecosystem.

## Context
Marketa is AigentZ's Chief Marketing Agent that orchestrates multi-channel campaigns, generates content, manages rewards, and provides hyper-personalized marketing. This console must operate as a thin client that calls backend APIs without direct database access.

## Tech Stack
- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **API**: Fetch calls to `/api/marketa/*` endpoints only
- **State**: React hooks + React Query for data fetching
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts for analytics
- **Icons**: Lucide React

## Architecture Requirements
- **No direct database access** - All data via API calls
- **Experience cartridge pattern** - Deployable via Codex system
- **Component modularity** - Each feature as independent component
- **Type safety** - Full TypeScript coverage
- **Responsive design** - Mobile, tablet, desktop

## Core Features to Build

### 1) Dashboard
- **Phase selector**: Dropdown (codex1, regcf, pre_fairlaunch, fairlaunch)
- **KPI tiles**: 
  - Packs Pending Approval
  - Packs Approved
  - Packs Sent
  - Rewards Issued ($KNYT, Q¢)
- **Recent activity feed**: Last 10 delivery logs and CRM events
- **Quick actions**: Generate Pack, View Partners, Publish Campaign

### 2) Partners Management
- **Partner list page**: Table with name, code, role type, channels, webhook status
- **Partner detail/edit form**:
  - Basic info: name, code, role_type
  - Brand constraints: JSON editor for brand rules
  - Channel preferences: Multi-select for available channels
  - Make webhook URL: Text input with validation
  - Approval contacts: Array of contact emails
- **Actions**: Create, Edit, Delete, Test Webhook

### 3) Campaign & Pack Generation
- **Pack generation wizard**:
  - Step 1: Pack type (owned_wpp or partner_wpp)
  - Step 2: Partner selection (if partner_wpp)
  - Step 3: Phase selection
  - Step 4: Channel checklist (linkedin, x, instagram, tiktok, newsletter, discord, telegram, whatsapp, sms)
  - Step 5: Week of date picker
  - Step 6: Tone and CTAs configuration
- **Pack list page**: Status, type, partner, version, created date
- **Pack detail/editor**:
  - Tabs: hero, short1, short2, short3, newsletter, community
  - Each item shows: thread label, mode label, CTA, UTM links
  - Editable text areas for copy and hashtags
  - Platform variant previews
  - Actions: Request edits, Regenerate, Approve

### 4) Publishing Interface
- **Pack selection**: Dropdown to choose approved pack
- **Target configuration**:
  - Owned channels: Make webhook (Buffer), Mailjet (segment selection), Discord (channel selection)
  - SMS: Segment selection with provider warning
  - WhatsApp/Telegram: Segment selection via Make
  - Partner channels: Partner selection with webhook
- **Publish options**: Dry run toggle, schedule time
- **Results display**: Success/failure status, delivery URLs, error messages

### 5) Audience Segments
- **Segment builder**:
  - Value tier multi-select (0..4)
  - Engagement tier multi-select (cold, warm, active, advocate)
  - Flag toggles: mythos_bias, logos_bias, builder_flag
  - Partner affinity dropdown
  - Consent filters: email_opt_in, sms_opt_in, whatsapp_opt_in
- **Preview panel**: Shows segment count and sample profile IDs
- **Save/Load**: Save segment definitions for reuse

### 6) Reports & Analytics
- **Dashboard charts**:
  - Campaign performance over time
  - Channel delivery rates
  - Engagement metrics (opens, clicks, conversions)
  - Rewards distribution
- **Filter controls**: Date range, partner, channel, campaign
- **Data tables**: Detailed breakdown with export options
- **KPI cards**: Key metrics with trend indicators

## API Integration

### Required API Calls
```typescript
// Core CRUD
GET    /api/marketa/partners
POST   /api/marketa/partners
PUT    /api/marketa/partners/[id]
DELETE /api/marketa/partners/[id]

GET    /api/marketa/campaigns
POST   /api/marketa/campaigns
PUT    /api/marketa/campaigns/[id]

GET    /api/marketa/packs
POST   /api/marketa/packs/generate
PUT    /api/marketa/packs/[id]/approve
PUT    /api/marketa/packs/[id]/request-edits
PUT    /api/marketa/packs/[id]/regenerate

POST   /api/marketa/publish
POST   /api/marketa/segments/preview
POST   /api/marketa/rewards/issue
POST   /api/marketa/crm/event

GET    /api/marketa/reports/summary
GET    /api/marketa/reports/campaigns
GET    /api/marketa/reports/channels
```

### API Client Service
Create a comprehensive API client with:
- Error handling and retry logic
- Type-safe request/response interfaces
- Loading states and error boundaries
- Caching for frequently accessed data

## Component Structure

### Directory Layout
```
codexes/packs/marketa/
├── components/
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── KPIStats.tsx
│   │   ├── ActivityFeed.tsx
│   │   └── QuickActions.tsx
│   ├── Partners/
│   │   ├── PartnerList.tsx
│   │   ├── PartnerForm.tsx
│   │   ├── PartnerCard.tsx
│   │   └── WebhookTester.tsx
│   ├── Campaigns/
│   │   ├── PackWizard.tsx
│   │   ├── PackList.tsx
│   │   ├── PackEditor.tsx
│   │   ├── PackItemEditor.tsx
│   │   └── ContentPreview.tsx
│   ├── Publishing/
│   │   ├── PublishInterface.tsx
│   │   ├── TargetPicker.tsx
│   │   ├── DeliveryResults.tsx
│   │   └── ScheduleOptions.tsx
│   ├── Segments/
│   │   ├── SegmentBuilder.tsx
│   │   ├── SegmentPreview.tsx
│   │   ├── ProfileFilters.tsx
│   │   └── SavedSegments.tsx
│   └── Reports/
│       ├── AnalyticsDashboard.tsx
│       ├── CampaignMetrics.tsx
│       ├── ChannelPerformance.tsx
│       └── RewardsSummary.tsx
├── pages/
│   ├── page.tsx                    # Main dashboard
│   ├── partners/page.tsx
│   ├── partners/[id]/page.tsx
│   ├── campaigns/page.tsx
│   ├── campaigns/[id]/page.tsx
│   ├── publish/page.tsx
│   ├── segments/page.tsx
│   └── reports/page.tsx
├── services/
│   ├── marketaApi.ts              # API client
│   ├── types.ts                   # TypeScript types
│   ├── utils.ts                   # Helper functions
│   └── constants.ts               # Configuration constants
├── hooks/
│   ├── useMarketaApi.ts           # Custom API hooks
│   ├── usePartners.ts             # Partner-specific hooks
│   ├── useCampaigns.ts            # Campaign-specific hooks
│   └── useAnalytics.ts            # Analytics hooks
└── lib/
    ├── validations.ts             # Zod schemas
    ├── formatters.ts              # Data formatting utilities
    └── constants.ts               # App constants
```

## Key Implementation Details

### Form Validation
- Use Zod schemas for all form validation
- Implement real-time validation feedback
- Handle complex nested objects (brand constraints, channel preferences)

### Data Fetching
- Implement React Query for server state management
- Add optimistic updates for better UX
- Handle pagination and infinite scrolling where needed

### Error Handling
- Global error boundary for unexpected errors
- Toast notifications for user feedback
- Graceful degradation for API failures

### Loading States
- Skeleton loaders for all data displays
- Progress indicators for long-running operations
- Disabled states during form submission

### Responsive Design
- Mobile-first approach
- Adaptive layouts for different screen sizes
- Touch-friendly interface elements

## Styling Requirements

### Design System
- Use shadcn/ui components as base
- Custom color scheme matching Marketa brand (rose primary)
- Consistent spacing and typography
- Dark mode support

### Interactive Elements
- Hover states on all clickable elements
- Smooth transitions and micro-animations
- Loading spinners for async operations
- Success/error state indicators

## Accessibility
- Semantic HTML structure
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatibility

## Performance Considerations
- Code splitting by route
- Lazy loading heavy components
- Optimized re-renders with memo
- Efficient data fetching patterns

## Deliverables

### Required Files
1. **Complete component library** as specified above
2. **API client service** with full endpoint coverage
3. **Type definitions** for all data structures
4. **Page components** for all major features
5. **Custom hooks** for reusable logic
6. **Utility functions** for common operations

### Quality Requirements
- **100% TypeScript coverage** - No `any` types
- **Component documentation** - JSDoc comments for all components
- **Unit tests** - Critical business logic coverage
- **Error boundaries** - Graceful error handling
- **Responsive design** - Works on all device sizes

### Integration Points
- **Sidebar navigation** - Integrate with existing AigentZ sidebar
- **Orchestrator menu** - Add Marketa option
- **Permission system** - Respect user role permissions
- **Theme system** - Use existing theme context

## Success Criteria
- [ ] Complete UI generated and functional
- [ ] All API endpoints integrated with proper error handling
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Forms validate properly with good UX
- [ ] Data displays update in real-time
- [ ] Loading states and error handling implemented
- [ ] Accessibility standards met
- [ ] Performance optimized (fast load times)
- [ ] Code is well-documented and maintainable

## Next Steps After Generation
1. Review generated components for accuracy
2. Test API integration with mock data
3. Implement error handling and edge cases
4. Add unit tests for critical functionality
5. Deploy as experience cartridge via Codex
6. Test hot-swap deployment capability

Generate the complete Marketa Console following these specifications. Focus on creating a production-ready, maintainable, and user-friendly marketing console that can operate as an independent experience cartridge within the AigentZ ecosystem.
