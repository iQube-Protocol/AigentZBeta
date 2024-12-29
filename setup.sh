#!/bin/bash

# QubeAgent Project Setup Script
# Automates Python environment setup, dependency installation, and project initialization

set -e  # Exit immediately if a command exits with a non-zero status
set -o pipefail  # Fail on any part of a pipe

# ANSI Color Codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Prerequisite Check
check_prerequisites() {
    log_info "Checking system prerequisites..."
    
    # Check Homebrew
    if ! command -v brew &> /dev/null; then
        log_warning "Homebrew not found. Please install Homebrew manually:"
        echo "1. Visit https://brew.sh"
        echo "2. Run: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi

    # Check pyenv
    if ! command -v pyenv &> /dev/null; then
        log_info "Installing pyenv..."
        brew install pyenv
    fi

    # Check Python version management
    if ! pyenv versions | grep 3.11.7 &> /dev/null; then
        log_info "Installing Python 3.11.7..."
        pyenv install 3.11.7
    fi
}

# Python Environment Setup
setup_python_environment() {
    log_info "Setting up Python environment..."
    
    # Set global Python version
    pyenv global 3.11.7
    
    # Verify Python version
    python_version=$(python3 --version)
    if [[ ! $python_version == *"3.11.7"* ]]; then
        log_error "Failed to set Python 3.11.7"
    fi

    # Create virtual environment
    if [ ! -d "venv" ]; then
        log_info "Creating virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Upgrade pip and setuptools
    pip install --upgrade pip setuptools wheel
}

# Dependency Installation
install_dependencies() {
    log_info "Installing project dependencies..."
    
    # Install from requirements.txt
    pip install -r requirements.txt

    # Install project in editable mode
    pip install -e .
}

# Project Initialization
initialize_project() {
    log_info "Initializing QubeAgent project..."
    
    # Generate configuration if not exists
    if [ ! -f "config.yml" ]; then
        cp config.example.yml config.yml
        log_warning "Please update config.yml with your specific configurations"
    fi

    # Set executable permissions
    chmod +x setup.sh
}

# Main Execution
main() {
    log_info "Starting QubeAgent Project Setup..."

    # Run setup stages
    check_prerequisites
    setup_python_environment
    install_dependencies
    initialize_project

    log_info "QubeAgent project setup completed successfully! 🚀"
    log_warning "Activate the virtual environment with: source venv/bin/activate"
}

# Run main function
main
