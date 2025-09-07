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
cp .env.example .env
# Edit .env with your specific configurations
```

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
npm run start
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
- Check `.env` file configurations
- Verify MetaMask network settings
- Confirm Python and Node.js versions

### 9.2 Debugging
- Use `logging.basicConfig(level=logging.DEBUG)` for verbose logging
- Check browser console for frontend errors
- Review backend logs for server-side issues

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
