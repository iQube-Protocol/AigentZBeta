# QubeAgent Build Manual

## 1. Development Environment Setup

### 1.1 Prerequisites
- Python 3.13+
- pip
- virtualenv
- Node.js 16+
- npm
- MetaMask Browser Extension

### 1.2 Recommended Development Tools
- Visual Studio Code
- PyCharm Professional
- Docker Desktop
- Postman

## 2. Repository Cloning

```bash
git clone https://github.com/your-org/QubeAgent.git
cd QubeAgent
```

## 3. Python Environment Setup

### 3.1 Create Virtual Environment
```bash
python3 -m venv qubeagent_env
source qubeagent_env/bin/activate  # On macOS/Linux
# OR
qubeagent_env\Scripts\activate     # On Windows
```

### 3.2 Install Python Dependencies
```bash
pip install -r requirements.txt
```

## 4. Frontend Setup

### 4.1 Install Node Dependencies
```bash
npm install
npm install web3.js
```

### 4.2 Environment Configuration
```bash
cp .env.example .env.local
# Edit .env.local with your specific configurations
```

**Required Environment Variables for Registry:**
```env
# Supabase Configuration (Required for Registry)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: Both prefixed (`NEXT_PUBLIC_`) and non-prefixed versions are required:
- Non-prefixed versions are used by Next.js API routes (server-side)
- Prefixed versions are used by client-side React components

## 5. Blockchain Configuration

### 5.1 MetaMask Setup
1. Install MetaMask Browser Extension
2. Create a new wallet or import existing
3. Connect to Polygon Amoy Testnet
   - Network Name: Polygon Amoy Testnet
   - RPC URL: https://rpc-amoy.polygon.technology/
   - Chain ID: 80002
   - Currency Symbol: MATIC

## 6. Database Initialization

### 6.1 DB-GPT Configuration
```bash
python -m dbgpt.setup
dbgpt init-database
```

### 6.2 AWEL Framework Setup
```bash
python -m awel.initialize
awel configure
```

## 7. Running the Application

### 7.1 Development Server
```bash
# Start backend
python app.py

# Start frontend (in separate terminal)
npm run dev
# Or specify port explicitly
PORT=3001 npm run dev
```

### 7.2 Production Deployment
```bash
# Build frontend
npm run build

# Start production server
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app:app
```

## 8. Testing

### 8.1 Run Unit Tests
```bash
pytest tests/
```

### 8.2 Run Integration Tests
```bash
pytest integration_tests/
```

## 9. Troubleshooting

### 9.1 Common Issues
- Ensure all dependencies are installed
- Check `.env.local` file configurations
- Verify MetaMask network settings
- Confirm Python and Node.js versions

### 9.2 Supabase Configuration Issues

#### "Supabase env not configured" Error
**Symptoms**: Registry API returns error despite environment variables being set

**Root Causes**:
1. Missing non-prefixed environment variables for server-side API routes
2. Corrupted `.env.local` file formatting
3. Environment variable naming mismatch

**Resolution Steps**:
1. Verify both prefixed and non-prefixed Supabase variables exist in `.env.local`
2. Check file formatting - ensure proper newlines between variables
3. Restart development server after changes
4. Test connectivity: `curl "http://localhost:3001/api/registry/templates"`

**Debug Environment Variables**:
```bash
# Check if variables are loaded
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')"
```

### 9.3 Development Server Issues

#### Old Application Version Loading
**Symptoms**: Changes not reflected, old UI/API responses

**Resolution**:
```bash
# Kill processes on target port
lsof -ti tcp:3001 | xargs -r kill -9

# Clean build artifacts
rm -rf .next node_modules/.cache

# Reinstall and restart
npm install
PORT=3001 npm run dev
```

### 9.4 General Debugging
- Use `logging.basicConfig(level=logging.DEBUG)` for verbose logging
- Check browser console for frontend errors
- Review backend logs for server-side issues
- Verify API routes are hitting correct handlers (not proxies)

## 10. Continuous Integration

### 10.1 GitHub Actions
- Automated testing on pull requests
- Build and deployment workflows
- Security scanning

## 11. Performance Optimization

### 11.1 Caching Strategies
- Implement Redis caching
- Use memoization for expensive computations
- Optimize database queries

## 12. Security Best Practices

### 12.1 Secrets Management
- Never commit sensitive information
- Use environment variables
- Rotate API keys and credentials regularly

## 13. Documentation

### 13.1 Generating Docs
```bash
sphinx-build -b html docs/ docs/_build
```

## 14. Contribution Guidelines

1. Create feature branch
2. Write tests
3. Implement feature
4. Run tests
5. Update documentation
6. Submit pull request

## 15. Version Management

Use semantic versioning:
- Major version: Significant architectural changes
- Minor version: New features, backwards compatible
- Patch version: Bug fixes and minor improvements

## 16. Monitoring and Logging

### 16.1 Recommended Tools
- Sentry for error tracking
- Prometheus for metrics
- ELK Stack for log management

## 17. Appendix

### 17.1 Recommended Reading
- Web3.js Documentation
- DB-GPT Guides
- AWEL Framework Specifications
- LangChain Best Practices
```
