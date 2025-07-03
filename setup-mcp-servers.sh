#!/bin/bash

# Feature Request MCP Server Setup Script
# This script configures Slack MCP servers for feature request aggregation

set -e

echo "Setting up MCP servers for feature request aggregation..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if environment variables are set
check_env_vars() {
    local missing_vars=()
    
    
    # Slack credentials
    if [ -z "$SLACK_BOT_TOKEN" ]; then
        missing_vars+=("SLACK_BOT_TOKEN")
    fi
    if [ -z "$SLACK_TEAM_ID" ]; then
        missing_vars+=("SLACK_TEAM_ID")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Please set these variables and run the script again."
        echo "You can create a .env file or export them directly:"
        echo ""
        echo "export SLACK_BOT_TOKEN='xoxb-your-slack-bot-token'"
        echo "export SLACK_TEAM_ID='your_slack_team_id'"
        exit 1
    fi
}

# Install Slack MCP server
setup_slack_mcp() {
    print_status "Setting up Slack MCP server..."
    
    claude mcp add slack-server npx "@modelcontextprotocol/server-slack" \
        --env "SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}" \
        --env "SLACK_TEAM_ID=${SLACK_TEAM_ID}"
    
    print_status "Slack MCP server configured successfully!"
}

# Install filesystem MCP server (if not already present)
setup_filesystem_mcp() {
    print_status "Setting up filesystem MCP server..."
    
    claude mcp add filesystem-server npx "@modelcontextprotocol/server-filesystem" "/Users/raemckelvey/dev"
    
    print_status "Filesystem MCP server configured successfully!"
}


# Main execution
main() {
    print_status "Starting MCP server setup..."
    
    # Load .env file if it exists
    if [ -f .env ]; then
        print_status "Loading environment variables from .env file..."
        set -a
        source .env
        set +a
    fi
    
    check_env_vars
    setup_slack_mcp
    setup_filesystem_mcp
    
    print_status "All MCP servers configured successfully!"
    print_status "You can now use the following servers:"
    echo "  - slack-server: Access Slack messages and channels"
    echo "  - filesystem-server: Access local files and code"
    echo ""
    print_status "Run 'claude mcp list' to see all configured servers"
}

main "$@"