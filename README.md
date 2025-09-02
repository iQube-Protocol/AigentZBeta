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

## Features

### Unified Interface

- Persistent Nakamoto-style sidebar navigation
- Global dark theme with modern UI
- Keyboard shortcuts for quick navigation

### Aigent Personas

- Multiple specialized AI agent personas
- Context Transformation panel for each agent
- Persistent chat history and context management

### iQube Operations

- Lookup iQube metadata by ID
- Activate iQubes with secure activation codes
- Decrypt BlakQube data with proper authorization
- Mint TokenQubes on various blockchain networks

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

## Contact

- Project Lead: [Your Name]
- Community: [Discord/Slack Link]
- Support: [Email/Support Channel]

---

**Note**: This is a living project. We encourage collaborative improvement and innovation.
