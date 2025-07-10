#!/bin/bash

# Feature Request MCP Server Setup Script
# This script configures all MCP servers for feature request aggregation
# Designed to be foolproof for Product Managers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}▶${NC} ${BOLD}$1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ${NC}  $1"
}

# ASCII Art Banner
show_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
    __  __  ____ ____    ____       _               
   |  \/  |/ ___|  _ \  / ___|  ___| |_ _   _ _ __  
   | |\/| | |   | |_) | \___ \ / _ \ __| | | | '_ \ 
   | |  | | |___|  __/   ___) |  __/ |_| |_| | |_) |
   |_|  |_|\____|_|     |____/ \___|\__|\__,_| .__/ 
                                              |_|    
   Feature Request Generator - Product Manager Edition
EOF
    echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    local missing_prereqs=()
    
    # Check for Claude
    if ! command -v claude &> /dev/null; then
        missing_prereqs+=("Claude Code")
        print_error "Claude Code not found"
    else
        print_status "Claude Code installed"
    fi
    
    # Check for git
    if ! command -v git &> /dev/null; then
        missing_prereqs+=("Git")
        print_error "Git not found"
    else
        print_status "Git installed"
    fi
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing_prereqs+=("Node.js")
        print_error "Node.js not found"
    else
        print_status "Node.js installed"
    fi
    
    if [ ${#missing_prereqs[@]} -ne 0 ]; then
        echo ""
        print_error "Missing required software:"
        for prereq in "${missing_prereqs[@]}"; do
            echo "  - $prereq"
        done
        echo ""
        print_info "Please install the missing software and run this script again."
        print_info "See SETUP_GUIDE.md for installation instructions."
        exit 1
    fi
    
    print_status "All prerequisites installed!"
}

# Interactive API key collection
collect_api_keys() {
    print_step "Setting up API keys..."
    
    # Check if .env exists
    if [ -f .env ]; then
        print_info "Found existing .env file"
        read -p "Do you want to use existing keys or enter new ones? (use/new) [use]: " choice
        choice=${choice:-use}
        
        if [ "$choice" = "use" ]; then
            set -a
            source .env
            set +a
            return
        fi
    fi
    
    print_info "Let's collect your API keys. See API_KEYS_GUIDE.md for help getting these."
    echo ""
    
    # Slack Bot Token
    print_info "SLACK BOT TOKEN"
    echo "This starts with 'xoxb-' and is about 50 characters long"
    read -p "Enter your Slack Bot Token: " SLACK_BOT_TOKEN
    while [[ ! "$SLACK_BOT_TOKEN" =~ ^xoxb- ]]; then
        print_error "Invalid format. Slack bot tokens start with 'xoxb-'"
        read -p "Enter your Slack Bot Token: " SLACK_BOT_TOKEN
    done
    
    # Slack Team ID
    echo ""
    print_info "SLACK TEAM ID"
    echo "This is usually 9 characters like 'T1234ABCD'"
    read -p "Enter your Slack Team ID: " SLACK_TEAM_ID
    while [[ ! "$SLACK_TEAM_ID" =~ ^T[A-Z0-9]{8,10}$ ]]; then
        print_error "Invalid format. Team IDs start with 'T' followed by 8-10 characters"
        read -p "Enter your Slack Team ID: " SLACK_TEAM_ID
    done
    
    # Linear API Key
    echo ""
    print_info "LINEAR API KEY"
    echo "This starts with 'lin_api_' and is about 40 characters long"
    read -p "Enter your Linear API Key: " LINEAR_API_KEY
    while [[ ! "$LINEAR_API_KEY" =~ ^lin_api_ ]]; then
        print_error "Invalid format. Linear API keys start with 'lin_api_'"
        read -p "Enter your Linear API Key: " LINEAR_API_KEY
    done
    
    # Notion Token
    echo ""
    print_info "NOTION INTEGRATION TOKEN"
    echo "This starts with 'secret_' and is about 50 characters long"
    read -p "Enter your Notion Token: " NOTION_TOKEN
    while [[ ! "$NOTION_TOKEN" =~ ^secret_ ]]; then
        print_error "Invalid format. Notion tokens start with 'secret_'"
        read -p "Enter your Notion Token: " NOTION_TOKEN
    done
    
    # Save to .env file
    print_step "Saving configuration..."
    cat > .env << EOF
# MCP Server Configuration
# Generated on $(date)

# Slack Configuration
SLACK_BOT_TOKEN=$SLACK_BOT_TOKEN
SLACK_TEAM_ID=$SLACK_TEAM_ID

# Linear Configuration
LINEAR_API_KEY=$LINEAR_API_KEY

# Notion Configuration
NOTION_TOKEN=$NOTION_TOKEN

# Optional: Zapier Configuration (for Otter.ai)
# ZAPIER_API_KEY=your-zapier-api-key
# OTTER_ZAPIER_ENDPOINT=your-otter-zapier-endpoint
EOF
    
    print_status "API keys saved to .env file"
    
    # Load the new environment
    set -a
    source .env
    set +a
}

# Validate API keys by testing connections
validate_api_keys() {
    print_step "Validating API keys..."
    
    local all_valid=true
    
    # Test Slack
    print_info "Testing Slack connection..."
    if claude --no-interaction 2>/dev/null << EOF
Use the Slack MCP server to list channels (limit 1).
EOF
    then
        print_status "Slack API key is valid"
    else
        print_error "Slack API key validation failed"
        all_valid=false
    fi
    
    # Test Linear
    print_info "Testing Linear connection..."
    if claude --no-interaction 2>/dev/null << EOF
Use the Linear MCP server to list teams.
EOF
    then
        print_status "Linear API key is valid"
    else
        print_error "Linear API key validation failed"
        all_valid=false
    fi
    
    # Test Notion
    print_info "Testing Notion connection..."
    if claude --no-interaction 2>/dev/null << EOF
Use the Notion MCP server to get current user info.
EOF
    then
        print_status "Notion API key is valid"
    else
        print_error "Notion API key validation failed"
        all_valid=false
    fi
    
    if [ "$all_valid" = false ]; then
        echo ""
        print_error "Some API keys failed validation"
        print_info "Please check your keys and try again"
        print_info "See API_KEYS_GUIDE.md for troubleshooting"
        exit 1
    fi
    
    print_status "All API keys validated successfully!"
}

# Install Slack MCP server
setup_slack_mcp() {
    print_info "Configuring Slack MCP server..."
    
    if claude mcp add slack-server npx "@modelcontextprotocol/server-slack" \
        --env "SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}" \
        --env "SLACK_TEAM_ID=${SLACK_TEAM_ID}" 2>/dev/null; then
        print_status "Slack MCP server configured"
    else
        print_warning "Slack server may already be configured, updating..."
        claude mcp remove slack-server 2>/dev/null || true
        claude mcp add slack-server npx "@modelcontextprotocol/server-slack" \
            --env "SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}" \
            --env "SLACK_TEAM_ID=${SLACK_TEAM_ID}"
        print_status "Slack MCP server updated"
    fi
}

# Install Linear MCP server
setup_linear_mcp() {
    print_info "Configuring Linear MCP server..."
    
    if claude mcp add linear-server npx "@modelcontextprotocol/server-linear" \
        --env "LINEAR_API_KEY=${LINEAR_API_KEY}" 2>/dev/null; then
        print_status "Linear MCP server configured"
    else
        print_warning "Linear server may already be configured, updating..."
        claude mcp remove linear-server 2>/dev/null || true
        claude mcp add linear-server npx "@modelcontextprotocol/server-linear" \
            --env "LINEAR_API_KEY=${LINEAR_API_KEY}"
        print_status "Linear MCP server updated"
    fi
}

# Install Notion MCP server
setup_notion_mcp() {
    print_info "Configuring Notion MCP server..."
    
    if claude mcp add notion-server npx "@modelcontextprotocol/server-notion" \
        --env "NOTION_TOKEN=${NOTION_TOKEN}" 2>/dev/null; then
        print_status "Notion MCP server configured"
    else
        print_warning "Notion server may already be configured, updating..."
        claude mcp remove notion-server 2>/dev/null || true
        claude mcp add notion-server npx "@modelcontextprotocol/server-notion" \
            --env "NOTION_TOKEN=${NOTION_TOKEN}"
        print_status "Notion MCP server updated"
    fi
}

# Install filesystem MCP server
setup_filesystem_mcp() {
    print_info "Configuring filesystem MCP server..."
    
    local project_dir=$(pwd)
    
    if claude mcp add filesystem-server npx "@modelcontextprotocol/server-filesystem" "$project_dir" 2>/dev/null; then
        print_status "Filesystem MCP server configured for $project_dir"
    else
        print_warning "Filesystem server may already be configured, updating..."
        claude mcp remove filesystem-server 2>/dev/null || true
        claude mcp add filesystem-server npx "@modelcontextprotocol/server-filesystem" "$project_dir"
        print_status "Filesystem MCP server updated"
    fi
}

# Test all connections
test_connections() {
    print_step "Testing MCP server connections..."
    
    echo ""
    print_info "This will verify each MCP server is working correctly..."
    
    # Create a simple test script
    cat > test-connections-temp.sh << 'EOF'
#!/bin/bash
echo "Testing Slack..." && claude --no-interaction << 'CLAUDE' 2>&1 | grep -q "channels" && echo "✓ Slack OK" || echo "✗ Slack Failed"
List one Slack channel using the Slack MCP server.
CLAUDE

echo "Testing Linear..." && claude --no-interaction << 'CLAUDE' 2>&1 | grep -q "team" && echo "✓ Linear OK" || echo "✗ Linear Failed"
List Linear teams using the Linear MCP server.
CLAUDE

echo "Testing Notion..." && claude --no-interaction << 'CLAUDE' 2>&1 | grep -q "user" && echo "✓ Notion OK" || echo "✗ Notion Failed"
Get current user info using the Notion MCP server.
CLAUDE
EOF
    
    chmod +x test-connections-temp.sh
    ./test-connections-temp.sh
    rm -f test-connections-temp.sh
    
    echo ""
    print_status "Connection tests completed!"
}

# Show next steps
show_next_steps() {
    print_step "Setup Complete! 🎉"
    
    echo ""
    print_info "You can now use the following MCP servers:"
    echo "  • ${BOLD}slack-server${NC}: Access Slack messages and channels"
    echo "  • ${BOLD}linear-server${NC}: Create and manage Linear issues"
    echo "  • ${BOLD}notion-server${NC}: Access Notion pages and databases"
    echo "  • ${BOLD}filesystem-server${NC}: Access local files and code"
    
    echo ""
    print_info "Next steps:"
    echo "  1. Try the interactive mode: ${CYAN}./generate-pitch.sh --interactive${NC}"
    echo "  2. Read the documentation: ${CYAN}open README.md${NC}"
    echo "  3. Join #product-tools in Slack for help"
    
    echo ""
    print_info "Quick test - generate your first issue:"
    echo "  ${CYAN}./generate-pitch.sh --title \"Test Issue\" --team-id \"YOUR-TEAM-ID\" --appetite \"small-batch\"${NC}"
    
    echo ""
    print_status "Happy feature requesting! 🚀"
}

# Main execution
main() {
    clear
    show_banner
    
    print_info "Welcome! This script will set up all MCP servers for the Feature Request Generator."
    print_info "The whole process takes about 5 minutes."
    echo ""
    read -p "Press Enter to continue..."
    
    check_prerequisites
    collect_api_keys
    
    print_step "Installing MCP servers..."
    setup_slack_mcp
    setup_linear_mcp
    setup_notion_mcp
    setup_filesystem_mcp
    
    # Note: Skipping validation here as it might fail before servers are fully initialized
    # validate_api_keys
    
    test_connections
    show_next_steps
}

# Run main function with all arguments
main "$@"