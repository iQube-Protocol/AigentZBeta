# QubeAgent Build Manual

This document provides detailed instructions for building and deploying the QubeAgent application.

## Development Environment Setup

### System Requirements
- macOS, Linux, or Windows
- Python 3.8 or higher
- Node.js 14+ (for web3 integration)
- Git

### Python Dependencies
```bash
pip install -r requirements.txt
```

Required packages:
- Flask==2.0.1
- web3==7.6.1
- cryptography==44.0.0
- python-dotenv==1.0.0

### Environment Configuration

1. Create a `.env` file in the project root:
```bash
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key
INFURA_PROJECT_ID=your-infura-project-id
CONTRACT_ADDRESS=your-contract-address
```

2. Configure blockchain settings in `config.py`:
```python
NETWORK_URL = f"https://sepolia.infura.io/v3/{INFURA_PROJECT_ID}"
CONTRACT_ABI_PATH = "contracts/TokenQube.json"
```

## Building for Development

1. Set up the development environment:
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install development dependencies:
```bash
pip install -r requirements-dev.txt
```

3. Run tests:
```bash
python -m pytest tests/
```

4. Start development server:
```bash
flask run --debug
```

## Building for Production

1. Set production environment variables:
```bash
export FLASK_ENV=production
export FLASK_DEBUG=0
```

2. Configure production settings:
- Update `config.py` with production values
- Set up proper SSL certificates
- Configure production database if needed

3. Deploy using Gunicorn (recommended):
```bash
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

## Docker Deployment

1. Build the Docker image:
```bash
docker build -t qubeagent .
```

2. Run the container:
```bash
docker run -d -p 5000:5000 qubeagent
```

## Security Considerations

1. Key Management:
- Use proper key management services in production
- Never commit sensitive keys to version control
- Rotate keys regularly

2. Access Control:
- Implement rate limiting
- Use proper authentication middleware
- Validate all blockchain interactions

3. Data Protection:
- Encrypt sensitive data at rest
- Use secure communication channels
- Implement proper session management

## Troubleshooting

Common issues and solutions:

1. Web3 Connection Issues:
```bash
# Check Infura connection
curl -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":1}' "https://sepolia.infura.io/v3/YOUR-PROJECT-ID"
```

2. Database Errors:
- Verify environment variables
- Check database connections
- Ensure proper permissions

3. Encryption Issues:
- Verify key format and encoding
- Check encryption library version
- Ensure proper key storage

## Monitoring and Logging

1. Configure logging:
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
```

2. Monitor system health:
- Set up health check endpoints
- Implement proper error tracking
- Use monitoring services (e.g., Sentry)

## Maintenance

Regular maintenance tasks:
1. Update dependencies regularly
2. Monitor security advisories
3. Backup configuration and data
4. Review and rotate access keys
5. Update documentation as needed
