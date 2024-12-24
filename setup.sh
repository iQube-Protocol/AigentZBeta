#!/bin/bash

# QubeAgent Project Setup Script
# Version: 1.0
# Date: 2024-12-24

# Ensure script is run with bash
if [ "$BASH_VERSION" = '' ]; then
    echo "Please run with bash"
    exit 1
fi

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project Configuration
PROJECT_NAME="QubeAgent"
PYTHON_VERSION="3.10"
VENV_NAME="${PROJECT_NAME}_env"

# Dependency Versions
LANGCHAIN_VERSION="0.1.0"
WEB3_VERSION="6.0.0"

# Logging function
log() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Prerequisite Checks
check_prerequisites() {
    log "Checking system prerequisites..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 not found. Please install Python ${PYTHON_VERSION}"
    fi

    # Check pip
    if ! command -v pip3 &> /dev/null; then
        error "pip not found. Please install pip"
    fi

    # Check virtual environment support
    if ! python3 -m venv --help &> /dev/null; then
        error "Python venv module not found. Please install python3-venv"
    fi
}

# Create Project Structure
create_project_structure() {
    log "Creating project structure..."
    
    mkdir -p "${PROJECT_NAME}"
    cd "${PROJECT_NAME}"
    
    # Create main directories
    mkdir -p {agents,wallets,tests,docs,config,qube_integrations}
    
    # Create initial files
    touch README.md .env .gitignore
    
    # Create initial Python files
    cat > agents/qube_agent.py << EOL
from langchain.agents import BaseMultiActionAgent
from wallets.wallet_manager import WalletManager
from qube_integrations.qube_handler import QubeHandler

class QubeSmartAgent(BaseMultiActionAgent):
    def __init__(self, wallet_manager, qube_handler):
        self.wallet = wallet_manager
        self.qube_handler = qube_handler
    
    def plan_and_execute(self, objective):
        # Agent decision-making logic
        # Integrate wallet and qube interactions
        pass
    
    def process_qube(self, qube_token_id):
        # Specific method for processing iQubes
        decrypted_data = self.qube_handler.decrypt(qube_token_id)
        return decrypted_data
EOL

    cat > wallets/wallet_manager.py << EOL
from web3 import Web3
import logging

class WalletManager:
    def __init__(self, provider_url):
        self.web3 = Web3(Web3.HTTPProvider(provider_url))
        self.account = self.web3.eth.account.create()
        self.logger = logging.getLogger(__name__)
    
    def transfer_assets(self, to_address, amount, token_type='ETH'):
        try:
            # Secure asset transfer implementation
            transaction = {
                'to': to_address,
                'value': self.web3.to_wei(amount, 'ether'),
                'gas': 2000000,
                'gasPrice': self.web3.eth.gas_price,
                'nonce': self.web3.eth.get_transaction_count(self.account.address)
            }
            
            signed_txn = self.web3.eth.account.sign_transaction(transaction, self.account.privatekey)
            tx_hash = self.web3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            self.logger.info(f"Transfer of {amount} {token_type} to {to_address}. Tx Hash: {tx_hash.hex()}")
            return tx_hash
        except Exception as e:
            self.logger.error(f"Asset transfer failed: {e}")
            raise
EOL

    cat > qube_integrations/qube_handler.py << EOL
import logging
from typing import Dict, Any

class QubeHandler:
    def __init__(self, encryption_key=None):
        self.logger = logging.getLogger(__name__)
        self._encryption_key = encryption_key
    
    def decrypt(self, qube_token_id: str) -> Dict[str, Any]:
        try:
            # Placeholder for actual decryption logic
            # In real implementation, this would interact with iQube protocol
            self.logger.info(f"Attempting to decrypt iQube with token ID: {qube_token_id}")
            
            # Simulated decryption
            decrypted_data = {
                'token_id': qube_token_id,
                'status': 'decryption_successful',
                'data': 'Placeholder decrypted content'
            }
            
            return decrypted_data
        except Exception as e:
            self.logger.error(f"Decryption failed for token {qube_token_id}: {e}")
            raise
EOL

    # Create requirements file
    cat > requirements.txt << EOL
langchain==${LANGCHAIN_VERSION}
web3==${WEB3_VERSION}
python-dotenv
pytest
cryptography
EOL

    # Create .gitignore
    cat > .gitignore << EOL
__pycache__/
*.py[cod]
*$py.class
.env
${VENV_NAME}/
*.log
.DS_Store
EOL

    # Create README
    cat > README.md << EOL
# QubeAgent

## Project Overview
Decentralized AI agent with iQube integration and blockchain capabilities

## Setup
1. Create virtual environment
2. Activate environment
3. Install dependencies: \`pip install -r requirements.txt\`

## Configuration
Copy \`.env.example\` to \`.env\` and fill in required variables

## Core Components
- Wallet Management
- iQube Integration
- Intelligent Agent Framework
EOL

    log "Project structure created successfully"
}

# Setup Virtual Environment
setup_virtual_environment() {
    log "Setting up virtual environment..."
    
    python3 -m venv "${VENV_NAME}"
    source "${VENV_NAME}/bin/activate"
    
    log "Virtual environment activated"
}

# Install Dependencies
install_dependencies() {
    log "Installing project dependencies..."
    
    pip install --upgrade pip
    pip install -r requirements.txt
    
    log "Dependencies installed successfully"
}

# Initialize Git Repository
init_git_repository() {
    log "Initializing Git repository..."
    
    git init
    git add .
    git commit -m "Initial project setup for QubeAgent"
    
    log "Git repository initialized"
}

# Main Execution
main() {
    clear
    echo -e "${YELLOW}QubeAgent Setup${NC}"
    
    check_prerequisites
    create_project_structure
    setup_virtual_environment
    install_dependencies
    init_git_repository
    
    echo -e "\n${GREEN}Project setup complete!${NC}"
    echo -e "Navigate to ${PROJECT_NAME} and activate venv with:"
    echo -e "source ${VENV_NAME}/bin/activate"
}

# Run the main function
main
