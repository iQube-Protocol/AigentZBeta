#!/bin/zsh

# Environment Setup Script for QubeAgent

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

# Install or Update Command Line Tools
install_command_line_tools() {
    log_info "Checking Command Line Tools..."
    
    # Check if Command Line Tools are installed
    if ! xcode-select -p &> /dev/null; then
        log_warning "Command Line Tools not found. Installing..."
        xcode-select --install
        
        # Wait for installation to complete
        log_info "Please complete the Command Line Tools installation when prompted."
        log_warning "Press Enter once installation is complete."
        read
    else
        # Check for updates
        softwareupdate --list | grep "Command Line Tools"
        if [ $? -eq 0 ]; then
            log_warning "Command Line Tools updates are available."
            log_info "Please update via Software Update in System Preferences."
            log_warning "Alternatively, you can run:"
            echo "  sudo rm -rf /Library/Developer/CommandLineTools"
            echo "  sudo xcode-select --install"
            exit 1
        else
            log_info "Command Line Tools are up to date."
        fi
    fi
}

# Check and fix zsh directory permissions
fix_zsh_permissions() {
    log_info "Checking and fixing zsh directory permissions..."
    sudo chown -R $(whoami) /usr/local/share/zsh /usr/local/share/zsh/site-functions
    chmod u+w /usr/local/share/zsh /usr/local/share/zsh/site-functions
}

# Install Homebrew
install_homebrew() {
    if ! command -v brew &> /dev/null; then
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    else
        log_info "Homebrew is already installed"
    fi
}

# Update .zshrc
update_zshrc() {
    log_info "Updating .zshrc with Homebrew and pyenv configurations..."
    
    # Backup existing .zshrc
    cp ~/.zshrc ~/.zshrc.backup
    
    # Add Homebrew and pyenv configurations if not already present
    if ! grep -q "# Homebrew" ~/.zshrc; then
        cat >> ~/.zshrc << EOL

# Homebrew
export PATH="/opt/homebrew/bin:$PATH"

# Pyenv
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"
EOL
    fi
    
    # Reload shell configuration
    source ~/.zshrc
}

# Install pyenv
install_pyenv() {
    if ! command -v pyenv &> /dev/null; then
        log_info "Installing pyenv via Homebrew..."
        brew install pyenv
    else
        log_info "Pyenv is already installed"
    fi
}

# Install Python 3.11.7
install_python() {
    log_info "Installing Python 3.11.7..."
    
    # Install necessary dependencies
    brew install xz zlib

    # Install Python with additional compilation options
    PYTHON_CONFIGURE_OPTS="--enable-framework" \
    LDFLAGS="-L/usr/local/opt/zlib/lib" \
    CPPFLAGS="-I/usr/local/opt/zlib/include" \
    pyenv install 3.11.7

    # Set global Python version
    pyenv global 3.11.7
    
    # Verify Python version
    python_version=$(python3 --version)
    log_info "Installed Python version: $python_version"

    # Verify lzma module
    python3 -c "import lzma" || log_warning "LZMA module might not be working correctly"
}

# Main execution
main() {
    log_info "Starting QubeAgent Environment Setup..."
    
    install_command_line_tools
    fix_zsh_permissions
    install_homebrew
    update_zshrc
    install_pyenv
    install_python
    
    log_info "Environment setup completed successfully! 🚀"
    log_warning "Please restart your terminal or run 'source ~/.zshrc'"
}

# Run main function
main
