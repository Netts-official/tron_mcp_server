#!/bin/bash
set -euo pipefail

# ============================================================================
# TRON MCP Server Setup Script
# 
# Automatically installs and configures the TRON MCP Server for:
# - Claude CLI
# - Claude Desktop
# - Cursor IDE
# ============================================================================

# ----------------------------------------------------------------------------
# Constants and Configuration
# ----------------------------------------------------------------------------

# Colors for output
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SERVER_NAME="tron"
readonly SERVER_DISPLAY_NAME="TRON MCP Server"
readonly MIN_NODE_VERSION="18.0.0"
readonly REQUIRED_PACKAGES=("@modelcontextprotocol/sdk" "tronweb" "axios" "dotenv")

# ----------------------------------------------------------------------------
# Utility Functions
# ----------------------------------------------------------------------------

# Print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}   $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo ""
}

# Get the script's directory
get_script_dir() {
    cd "$(dirname "$0")" && pwd
}

# ----------------------------------------------------------------------------
# Platform Detection Functions
# ----------------------------------------------------------------------------

# Detect the operating system
detect_os() {
    case "$OSTYPE" in
        darwin*)  echo "macos" ;;
        linux*)   
            if grep -qi microsoft /proc/version 2>/dev/null; then
                echo "wsl"
            else
                echo "linux"
            fi
            ;;
        msys*|cygwin*|win32) echo "windows" ;;
        *)        echo "unknown" ;;
    esac
}

# Get Claude CLI config path
get_claude_cli_config_path() {
    echo "$HOME/.config/claude/claude_desktop_config.json"
}

# Get Claude Desktop config path based on platform
get_claude_desktop_config_path() {
    local os_type=$(detect_os)
    
    case "$os_type" in
        macos)
            echo "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
            ;;
        linux)
            echo "$HOME/.config/Claude/claude_desktop_config.json"
            ;;
        wsl)
            # Try to find Windows user directory
            local win_appdata
            if command -v wslvar &> /dev/null; then
                win_appdata=$(wslvar APPDATA 2>/dev/null)
            fi
            
            if [[ -n "$win_appdata" ]]; then
                echo "$(wslpath "$win_appdata")/Claude/claude_desktop_config.json"
            else
                # Fallback to common path
                echo "/mnt/c/Users/$USER/AppData/Roaming/Claude/claude_desktop_config.json"
            fi
            ;;
        windows)
            echo "$APPDATA/Claude/claude_desktop_config.json"
            ;;
        *)
            echo ""
            ;;
    esac
}

# ----------------------------------------------------------------------------
# Dependency Check Functions
# ----------------------------------------------------------------------------

# Compare version numbers
version_compare() {
    local version1=$1
    local version2=$2
    
    if [[ $version1 == $version2 ]]; then
        return 0
    fi
    
    local IFS=.
    local i ver1=($version1) ver2=($version2)
    
    # Fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    
    # Fill empty fields in ver2 with zeros
    for ((i=${#ver2[@]}; i<${#ver1[@]}; i++)); do
        ver2[i]=0
    done
    
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2
        fi
    done
    
    return 0
}

# Check Node.js version
check_node_version() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo ""
        echo "Please install Node.js 18 or higher:"
        echo "  • macOS: brew install node"
        echo "  • Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
        echo "  • Visit: https://nodejs.org/"
        return 1
    fi
    
    local node_version=$(node --version | sed 's/v//')
    version_compare "$node_version" "$MIN_NODE_VERSION"
    local result=$?
    
    if [[ $result -eq 2 ]]; then
        print_error "Node.js version $node_version is too old (minimum required: $MIN_NODE_VERSION)"
        echo ""
        echo "Please update Node.js to version 18 or higher"
        return 1
    fi
    
    print_success "Node.js version $node_version detected"
    return 0
}

# ----------------------------------------------------------------------------
# Installation Functions
# ----------------------------------------------------------------------------

# Install npm dependencies
install_dependencies() {
    local script_dir="$1"
    
    print_info "Installing dependencies..."
    
    cd "$script_dir"
    
    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found!"
        return 1
    fi
    
    # Install dependencies
    if npm install --silent 2>/dev/null; then
        print_success "Dependencies installed successfully"
        return 0
    else
        print_error "Failed to install dependencies"
        echo ""
        echo "Try running manually:"
        echo "  cd $script_dir"
        echo "  npm install"
        return 1
    fi
}

# Setup environment file
setup_env_file() {
    local script_dir="$1"
    
    cd "$script_dir"
    
    if [[ -f ".env" ]]; then
        print_success ".env file already exists"
        return 0
    fi
    
    if [[ ! -f ".env.example" ]]; then
        print_error ".env.example not found!"
        return 1
    fi
    
    cp .env.example .env
    print_success "Created .env from .env.example"
    
    echo ""
    print_warning "Please edit .env to add your configuration:"
    echo "  • NETWORK (mainnet/shasta/nile)"
    echo "  • TRONGRID_API_KEY (optional, for higher rate limits)"
    echo "  • PRIVATE_KEY (optional, only for sending transactions)"
    echo ""
    
    return 0
}

# ----------------------------------------------------------------------------
# Claude Integration Functions
# ----------------------------------------------------------------------------

# Update MCP configuration in JSON file
update_mcp_config() {
    local config_path="$1"
    local server_name="$2"
    local command="$3"
    local args="$4"
    
    # Create config directory if it doesn't exist
    local config_dir=$(dirname "$config_path")
    mkdir -p "$config_dir" 2>/dev/null || true
    
    # Create temporary file
    local temp_file=$(mktemp)
    
    # Use Node.js to properly handle JSON
    node -e "
const fs = require('fs');
const path = require('path');

let config = {};
const configPath = '$config_path';

// Read existing config if it exists
if (fs.existsSync(configPath)) {
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(content);
    } catch (e) {
        console.error('Warning: Could not parse existing config:', e.message);
        config = {};
    }
}

// Ensure mcpServers exists
if (!config.mcpServers) {
    config.mcpServers = {};
}

// Add or update server configuration
config.mcpServers['$server_name'] = {
    command: '$command',
    args: $args
};

// Write updated config
fs.writeFileSync('$temp_file', JSON.stringify(config, null, 2));
console.log('Configuration updated successfully');
" 2>&1
    
    if [[ $? -eq 0 ]] && [[ -f "$temp_file" ]]; then
        mv "$temp_file" "$config_path"
        return 0
    else
        rm -f "$temp_file"
        return 1
    fi
}

# Configure Claude CLI
configure_claude_cli() {
    local script_dir="$1"
    
    # Check if Claude CLI is installed
    if ! command -v claude &> /dev/null; then
        print_warning "Claude CLI not installed"
        echo ""
        echo "To install Claude CLI:"
        echo "  npm install -g @anthropic-ai/claude-cli"
        echo ""
        echo "After installation, run this script again to configure."
        return 0
    fi
    
    print_info "Configuring Claude CLI..."
    
    # Check if already configured
    local mcp_list=$(claude mcp list 2>/dev/null || true)
    if echo "$mcp_list" | grep -q "$SERVER_NAME"; then
        print_success "TRON MCP Server already configured in Claude CLI"
        
        # Ask if user wants to update
        read -p "Update existing configuration? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
        
        # Remove existing configuration
        claude mcp remove "$SERVER_NAME" -s user 2>/dev/null || true
    fi
    
    # Add MCP server to Claude CLI
    local server_path="$script_dir/src/index.js"
    
    if claude mcp add "$SERVER_NAME" -s user -- node "$server_path" 2>/dev/null; then
        print_success "Successfully configured Claude CLI"
        echo "  Run 'claude' to start using TRON MCP Server"
        return 0
    else
        print_error "Failed to configure Claude CLI automatically"
        echo ""
        echo "To configure manually, run:"
        echo "  claude mcp add $SERVER_NAME -s user -- node $server_path"
        return 1
    fi
}

# Configure Claude Desktop
configure_claude_desktop() {
    local script_dir="$1"
    
    print_info "Configuring Claude Desktop..."
    
    local config_path=$(get_claude_desktop_config_path)
    if [[ -z "$config_path" ]]; then
        print_warning "Unable to determine Claude Desktop config path for this platform"
        return 0
    fi
    
    # Check if Claude Desktop is installed by looking for the app
    local claude_installed=false
    local os_type=$(detect_os)
    
    case "$os_type" in
        macos)
            if [[ -d "/Applications/Claude.app" ]]; then
                claude_installed=true
            fi
            ;;
        windows|wsl)
            # Check common installation paths
            if [[ -f "$config_path" ]] || [[ -d "$(dirname "$config_path")" ]]; then
                claude_installed=true
            fi
            ;;
        linux)
            # Check if config directory exists
            if [[ -d "$HOME/.config/Claude" ]]; then
                claude_installed=true
            fi
            ;;
    esac
    
    if [[ "$claude_installed" == false ]]; then
        print_warning "Claude Desktop not found"
        echo ""
        echo "To install Claude Desktop:"
        echo "  Visit: https://claude.ai/download"
        echo ""
        echo "After installation, run this script again to configure."
        return 0
    fi
    
    # Update configuration
    local server_path="$script_dir/src/index.js"
    local args='["'$server_path'"]'
    
    if update_mcp_config "$config_path" "$SERVER_NAME" "node" "$args"; then
        print_success "Successfully configured Claude Desktop"
        echo "  Config: $config_path"
        echo "  Restart Claude Desktop to use TRON MCP Server"
        
        # Create backup
        cp "$config_path" "${config_path}.backup_$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
        
        return 0
    else
        print_error "Failed to configure Claude Desktop automatically"
        echo ""
        echo "To configure manually, add this to your config file:"
        echo "  Location: $config_path"
        echo ""
        cat << EOF
{
  "mcpServers": {
    "$SERVER_NAME": {
      "command": "node",
      "args": ["$server_path"]
    }
  }
}
EOF
        return 1
    fi
}

# Configure Cursor IDE
configure_cursor() {
    local script_dir="$1"
    
    print_info "Checking for Cursor IDE..."
    
    # Common Cursor settings locations
    local cursor_paths=(
        "$HOME/.config/Cursor/User/settings.json"
        "$HOME/Library/Application Support/Cursor/User/settings.json"
        "$APPDATA/Cursor/User/settings.json"
    )
    
    local cursor_config=""
    for path in "${cursor_paths[@]}"; do
        if [[ -f "$path" ]]; then
            cursor_config="$path"
            break
        fi
    done
    
    if [[ -z "$cursor_config" ]]; then
        print_warning "Cursor IDE not found"
        echo ""
        echo "If you have Cursor installed, you can manually add TRON MCP Server"
        echo "to your settings.json file. See examples/cursor/setup.md for details."
        return 0
    fi
    
    print_success "Found Cursor configuration at: $cursor_config"
    echo ""
    echo "To configure Cursor, see: examples/cursor/setup.md"
    echo "Or add this to your Cursor settings.json:"
    echo ""
    cat << EOF
{
  "mcp.servers": {
    "$SERVER_NAME": {
      "command": "node",
      "args": ["$script_dir/src/index.js"]
    }
  }
}
EOF
    
    return 0
}

# ----------------------------------------------------------------------------
# Verification Functions
# ----------------------------------------------------------------------------

# Test server startup
test_server() {
    local script_dir="$1"
    
    print_info "Testing server startup..."
    
    cd "$script_dir"
    
    # Test if server can start
    local test_output=$(timeout 3 node src/index.js 2>&1 || true)
    
    if echo "$test_output" | grep -q "MCP.*[Ss]erver\|[Ss]tarting\|[Rr]unning"; then
        print_success "Server starts successfully"
        return 0
    else
        print_warning "Could not verify server startup"
        echo "  This is normal if the server requires specific environment setup"
        return 0
    fi
}

# ----------------------------------------------------------------------------
# Main Setup Function
# ----------------------------------------------------------------------------

setup() {
    local script_dir=$(get_script_dir)
    
    print_header "TRON MCP Server Setup"
    
    # Step 1: Check system requirements
    print_info "Checking system requirements..."
    check_node_version || exit 1
    
    # Step 2: Install dependencies
    install_dependencies "$script_dir" || exit 1
    
    # Step 3: Setup environment
    setup_env_file "$script_dir" || exit 1
    
    # Step 4: Test server
    test_server "$script_dir"
    
    # Step 5: Configure Claude integrations
    print_header "Configuring Claude Integrations"
    
    local any_configured=false
    
    # Configure Claude CLI
    if configure_claude_cli "$script_dir"; then
        any_configured=true
    fi
    
    echo ""
    
    # Configure Claude Desktop
    if configure_claude_desktop "$script_dir"; then
        any_configured=true
    fi
    
    echo ""
    
    # Configure Cursor IDE
    configure_cursor "$script_dir"
    
    # Final instructions
    print_header "Setup Complete!"
    
    if [[ "$any_configured" == true ]]; then
        print_success "TRON MCP Server has been configured successfully!"
        echo ""
        echo "Next steps:"
        echo "  1. Edit .env file to add your API keys (if needed)"
        echo "  2. Restart Claude Desktop (if configured)"
        echo "  3. Start using TRON blockchain features in Claude!"
    else
        print_warning "No Claude applications were configured automatically"
        echo ""
        echo "You can configure them manually using the instructions above"
        echo "or by running this script again after installing Claude."
    fi
    
    echo ""
    echo "For more information, see:"
    echo "  • README.md - General documentation"
    echo "  • CLAUDE.md - Creating project context files"
    echo "  • examples/ - Setup guides for each platform"
    echo ""
    echo "Happy coding with TRON! 🚀"
}

# ----------------------------------------------------------------------------
# Script Entry Point
# ----------------------------------------------------------------------------

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        echo "TRON MCP Server Setup Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  -h, --help     Show this help message"
        echo "  -v, --version  Show version information"
        echo ""
        echo "This script will:"
        echo "  • Check system requirements"
        echo "  • Install dependencies"
        echo "  • Configure Claude CLI and Desktop"
        echo "  • Set up environment files"
        exit 0
        ;;
    -v|--version)
        echo "1.0.0"
        exit 0
        ;;
esac

# Run setup
setup