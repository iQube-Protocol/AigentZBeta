# Aigent Z: Unified Intelligence Agent Platform

## Technical Foundation: iQube Protocol

QubeAgent introduces a new class of context and risk intelligent agents underpinned by the iQube protocol.

### Core Vision

To create a unified, secure, and adaptive framework that revolutionizes how intelligence systems understand, process, and interact with complex information landscapes. Our mission is to create an agent ecosystem that prioritizes:

- Comprehensive risk and value analysis
- Dynamic semantic context generation
- Secure and verifiable data interactions

### Key Technologies

- **iQubes**: Reliable and verifiable decentralized information assets
- **Smart Agents**: Intelligent, context-aware autonomous agents
- **LangChain**: Advanced natural language understanding
- **DB-GPT**: Semantic database querying and analysis
- **AWEL**: Adaptive Workflow Execution Layer

### Architectural Model

1. **Context Layer**
   - Driven by iQube and blakQube content
   - Dynamic context generation
   - Retrieval Augmented Generation (RAG)
   - Web search and information aggregation

2. **Service Layer**
   - API integration and service discovery
   - Wallet and blockchain interactions
   - CRUD operations management

3. **State Layer**
   - Blockchain-backed state persistence
   - Immutable transaction logging
   - Agent memory management
  
## Technologies

### 1. Blockchains

- Robust data encapsulation
- Cryptographic information management
- Decentralized governance
- Verifiable risk assessment
- Immutable programmability

### 2. Smart Agents

- Context-aware decision making
- Dynamic intelligence generation
- Adaptive reasoning capabilities

### 3. Machine Reasoning

- Multi-model and multi-modal inference and automation
- Complex prompt engineering
- Advanced natural language and non-linguistic processing

### 4. Semantic Intelligence

- Semantic context vectorization
- Natural language query processing
- Advanced database interaction

### 5. Workflow Orchestration

- Dynamic service composition
- Granular task management
- Fault-tolerant execution

## iQube Components

## Primitives

1. **MetaQube**: Public, verifiable metadata
2. **BlakQube**: Private, encrypted data
3. **TokenQube**: Token-gated data decryption and access

## Types

1. **DataQube**: Alpha-numeric data representation
2. **ContentQube**: Multi-modal content (blob) representation
3. **AgentQube**: AI agent performance and compliance tracking

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm 8+
- Python 3.8+
- tmux (for unified development script)
- Web3-compatible wallet (for blockchain features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-organization/QubeAgent.git
cd QubeAgent

# Install frontend dependencies
npm install

# Install backend dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env.development
```

### Configuration

Edit `.env.local` with your settings:

```env
# Supabase Configuration (Required for Registry)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Core API Configuration
NEXT_PUBLIC_CORE_API_URL=http://localhost:8000
CORE_API_KEY=your_api_key_here

# Registry API Configuration
NEXT_PUBLIC_REGISTRY_API_URL=http://localhost:8001
REGISTRY_API_KEY=your_registry_api_key_here

# Aigent Configuration
NEXT_PUBLIC_AIGENT_API_URL=http://localhost:8002
AIGENT_API_KEY=your_aigent_api_key_here
```

### Running the Application

#### Unified Development Environment

Use our unified development script to start both the Python backend and Next.js frontend in a single tmux session:

```bash
# Make the script executable (first time only)
chmod +x start_dev.sh

# Start both servers in a tmux session
./start_dev.sh
```

This will start:

- Flask backend on `http://localhost:5000`
- Next.js frontend on `http://localhost:3000`

#### Manual Startup

```bash
# Start Python backend
python app.py

# In a separate terminal, start Next.js frontend
npm run dev

# Production build (frontend only)
npm run build
npm start

# Run tests
npm test
```

### Project Structure

```text
/
├── app/                # Next.js application
│   ├── aigents/        # Aigent personas and chat
│   ├── api/            # Next.js API routes
│   │   ├── aigent/     # Aigent API endpoints
│   │   ├── core/       # Core API endpoints
│   │   └── registry/   # Registry API endpoints
│   ├── dashboard/      # Main dashboard
│   ├── iqube/          # iQube operations
│   ├── registry/       # Registry integration
│   └── settings/       # User settings
├── components/         # Shared UI components
│   ├── registry/       # Registry-specific components
│   └── ui/             # Shared UI library
├── agents/             # Python agent implementations
├── qube_agent/         # Core Python backend modules
│   ├── models/         # Data models
│   ├── reasoning/      # AI reasoning modules
│   └── utils/          # Utility functions
├── qube_integrations/  # External integrations
├── static/             # Static assets
└── templates/          # HTML templates for Flask
```

## Security Principles

- Minimum disclosure by default
- Network level anonymity with contextually dynamic application level identifiability
- Contextually dynamic encryption and access control
- Risk driven rules and context assessment
- Quantum readiness

## Security Tools

- Zero-knowledge encryption
- Homomorphic encryption support
- Multi-party computation
- Differential Privacy
- Comprehensive risk assessment

## Performance Characteristics

- Microservices architecture
- Horizontal scaling
- Event-driven design
- Adaptive resource allocation

## Recent Updates (v2.1.0)

### Major Stability Improvements

- **Fixed Critical Sidebar Bug**: Resolved infinite update loop that caused application crashes when interacting with form inputs
- **Enhanced UI Consistency**: Added dynamic Sats price display in MetaQube headers for Instance mode
- **Improved Navigation**: Added iQube names to View tab headers with consistent formatting across all modes

### New Features

- **metaMe Persona**: Added new AI persona with full integration into sidebar navigation and chat functionality
- **Price Synchronization**: Fixed price mismatch between MetaQube headers and data sections
- **Cleaner Headers**: Removed redundant "Template" and "Instance" text from operation headers

### Technical Improvements

- **Manual Sidebar Control**: Replaced problematic auto-expansion with user-controlled section management
- **State Management**: Separated navigation-based opening from form interactions to prevent cascading effects
- **Process Management**: Enhanced PM2 configuration with log rotation and auto-start capabilities

## Recent Work: Minting UX/UI and Library Behavior (Sept 2025)

### Summary

We significantly improved the iQube minting flow to make critical user decisions explicit and irreversible actions clear:

- Replaced inline mint actions with an application notice that requires the user to choose visibility (Public or Private) before minting.
- Reserved toast notifications strictly for outcomes (success/failure) instead of decisions.
- Ensured the UI reflects state changes consistently across the modal and the grid, including post-mint behavior.

### Key Changes

1. Application Notice Before Minting
   - A `ConfirmDialog`-based modal prompts for Public or Private and clearly warns about Public minting consequences.
   - Mint proceeds only after explicit confirmation.

2. Badge and State Consistency
   - `Library (Private)` badge takes precedence on `IQubeCard` if the item is in the user's local Library.
   - Registry badges show as `Registry (Public)` or `Registry (Private)` when minted server-side.
   - After successful mint, the modal closes, the local `library_<id>` flag is removed, and a `registryTemplateUpdated` event refreshes the grid.

3. Hydration-Safe Visibility Logic
   - Mint button visibility is computed client-side (to avoid SSR/CSR mismatches) and relies on server visibility first, with local fallbacks for Library state.

### Obstacles and Resolutions

- Hydration Errors in Next.js
  - Cause: Reading `localStorage` and `window` directly in server-rendered JSX branches caused HTML mismatches.
  - Fix: Compute client-only conditions in a `useEffect` and render from state.

- Inconsistent Mint Visibility
  - Cause: Mixed reliance on local flags vs server fields.
  - Fix: Use `template.visibility` (server) to determine minted; only use local Library flag to allow minting from view when not minted server-side.

- Inline JSX Corruption
  - Cause: An earlier attempt placed a modal block inside an edit grid section.
  - Fix: Extracted the mint prompt to the footer and migrated to the reusable `ConfirmDialog` component.

### Operator Guidance: Library vs. Registry

- Library (Private)
  - Saved locally to the browser via `localStorage` (persistent per browser profile).
  - Shown as `Library (Private)` on cards; overrides Registry badge to convey privacy.
  - Intended for drafts and private use before minting.

- Registry (Public)
  - Visible to everyone; others can view, fork, and mint derived versions.
  - Irreversible state; choose with care in the mint prompt.

- Registry (Private)
  - Visible only to the owner on the server-side registry.
  - Can be activated to Public later (future: Activate button in edit mode).

### Where Things Are Saved

- Local Library
  - `localStorage` keys: `library_<id>`, `minted_<id>`, `owner_minted_<id>`, `active_*`.
  - Aimed at immediate UI reactivity without waiting for server writes.

- Server Registry (Next.js API → Supabase)
  - Templates and their `visibility` are persisted in the backend.
  - On mint, a PATCH request sets `visibility` to `public` or `private` and optionally associates a `userId`.

For a deeper operator guide, see `docs/OPERATORS_MANUAL.md`.

## Features

### Unified Interface

- Persistent Nakamoto-style sidebar navigation with manual section control
- Global dark theme with modern UI and enhanced stability
- Keyboard shortcuts for quick navigation
- Fixed auto-expansion issues for reliable user experience

### Aigent Personas

- Multiple specialized AI agent personas including new metaMe persona
- Context Transformation panel for each agent
- Persistent chat history and context management

### iQube Operations

#### Core Operations

- **View Mode**: Browse and inspect iQube metadata and structure
- **Use Mode**: Populate iQube instances from templates with controlled editing
- **Edit Mode**: Full template editing with dynamic field management
- **Decrypt Mode**: Secure BlakQube data decryption with proper authorization
- **Mint Mode**: Convert completed templates to blockchain-backed instances
- **Activate Mode**: Activate existing iQube instances with secure codes

#### Enhanced UI Features

- **Multi-Mode Tab Navigation**: Color-coded tabs with ARIA accessibility compliance
- **Dynamic Template Management**: Instance counting and version control
- **Smart Field Validation**: Real-time validation with visual feedback
- **Source Icon Integration**: Visual indicators for data source types
- **Responsive Design**: Optimized for various screen sizes with dark theme

#### Template & Instance Management

- **Template Creation**: Build reusable iQube templates with custom fields
- **Instance Generation**: Create numbered instances from templates (e.g., "3 of 21")
- **Version Control**: Automatic version incrementing for template updates
- **Provenance Tracking**: Complete audit trail of template modifications
- **Validation System**: Comprehensive field validation before minting/saving

### Registry Integration

- Browse iQube templates and instances
- Create and register new iQubes
- View analytics and insights on registry data

## Future Roadmap

- Expanded multi-modal support
- Enhanced cross-agent collaboration
- Advanced predictive intelligence
- Decentralized AI governance models

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes
4. Write comprehensive tests
5. Submit pull request

## License

[Specify your licensing model]

## Troubleshooting

### Common Issues

#### "Supabase env not configured" Error

**Problem**: Registry API returns "Supabase env not configured" despite environment variables being set.

**Root Cause**:
- Next.js API routes (server-side) cannot access `NEXT_PUBLIC_` prefixed environment variables
- Environment variable naming mismatch between client and server code
- Corrupted `.env.local` file formatting

**Solution**:

1. Ensure both prefixed and non-prefixed Supabase variables are in `.env.local`:

   ```env
   # Server-side (for API routes)
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Client-side (for browser code)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
2. Verify `.env.local` file formatting with proper newlines
3. Restart the development server: `npm run dev`
4. Test API connectivity: `curl "http://localhost:3001/api/registry/templates"`

#### Development Server Issues

**Problem**: Old application version loading or connection refused errors.

**Solution**:

1. Kill any processes on the target port: `lsof -ti tcp:3001 | xargs -r kill -9`
2. Clean build artifacts: `rm -rf .next node_modules/.cache`
3. Reinstall dependencies: `npm install`
4. Start fresh: `PORT=3001 npm run dev`

#### Environment Variable Debugging

To verify environment variables are loaded correctly:

```bash
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')"
```

## Restore from Backup

A full local backup system is included to prevent data loss and make restores easy.

Backups live under `backups/` and include a compressed tarball of the entire working tree plus a snapshot directory. The `backups/` directory is ignored by git.

Use the helper script to restore the latest or a specific backup without overwriting your current working tree.

```bash
# Restore latest backup, install deps, and start on port 3001
./scripts/restore_from_backup.sh --install --start --port 3001

# Restore a specific backup timestamp to a custom directory (no install/start)
./scripts/restore_from_backup.sh --backup 20250912_203828 --dir /tmp/AigentZBeta_restore
```

Flags:

- `--backup <YYYYmmdd_HHMMSS>`: choose a specific backup folder
- `--dir <path>`: restore destination (defaults to `restore/<timestamp>`)
- `--install`: run `npm install` after extraction
- `--start`: run the dev server after extraction
- `--port <PORT>`: dev server port (default 3001)

Notes:

- Tarballs include `.next/` and `node_modules/` for fast startup. Running `npm install` is still recommended for native modules.
- The script extracts to a new directory and does not modify your current working tree.

## Project Progress Report

For a comprehensive, program-ready report covering inception to current status, completed work, issues encountered and resolutions, and the forward-looking backlog and two-week plan, see:

- `docs/PROGRESS_REPORT.md`

## 🚨 DVN Deployment Configuration

**CRITICAL**: The DVN (cross_chain_service) canister requires updated environment variables for AWS Amplify deployment.

### Required Environment Variables

```bash
CROSS_CHAIN_SERVICE_CANISTER_ID=sp5ye-2qaaa-aaaao-qkqla-cai
NEXT_PUBLIC_CROSS_CHAIN_SERVICE_CANISTER_ID=sp5ye-2qaaa-aaaao-qkqla-cai
```

See `DEPLOYMENT_CONFIG.md` for complete configuration details.

**Without these environment variables, the DVN functionality will not work correctly.**

## Contact

- Project Lead: [Your Name]
- Community: [Discord/Slack Link]
- Support: [Email/Support Channel]

---

**Note**: This is a living project. We encourage collaborative improvement and innovation.
