#!/bin/bash

# MCP Troubleshooting Script
# This script helps diagnose and fix common MCP setup issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Icons
CHECK="✓"
CROSS="✗"
ARROW="→"
INFO="ℹ"
WRENCH="🔧"
SEARCH="🔍"

# Function to print colored output
print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_error() {
    echo -e "${RED}${CROSS}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_info() {
    echo -e "${CYAN}${INFO}${NC}  $1"
}

print_fix() {
    echo -e "${MAGENTA}${WRENCH}${NC} $1"
}

print_checking() {
    echo -e "${BLUE}${SEARCH}${NC} Checking $1..."
}

print_section() {
    echo ""
    echo -e "${BOLD}━━━ $1 ━━━${NC}"
    echo ""
}

# Banner
show_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
 __  __  ____ ____    ____        _                
|  \/  |/ ___|  _ \  |  _ \  ___| |__  _   _  __ _ 
| |\/| | |   | |_) | | | | |/ _ \ '_ \| | | |/ _` |
| |  | | |___|  __/  | |_| |  __/ |_) | |_| | (_| |
|_|  |_|\____|_|     |____/ \___|_.__/ \__,_|\__, |
                                              |___/ 
          MCP Troubleshooting Assistant
EOF
    echo -e "${NC}"
}

# Check system requirements
check_system() {
    print_section "System Requirements"
    
    local issues=0
    
    # Check OS
    print_checking "Operating System"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_success "macOS detected"
    else
        print_error "This script is designed for macOS"
        ((issues++))
    fi
    
    # Check Claude installation
    print_checking "Claude Code"
    if command -v claude &> /dev/null; then
        local version=$(claude --version 2>/dev/null || echo "unknown")
        print_success "Claude Code installed (version: $version)"
    else
        print_error "Claude Code not found"
        print_fix "Install Claude from: https://claude.ai/download"
        ((issues++))
    fi
    
    # Check Node.js
    print_checking "Node.js"
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        print_success "Node.js installed ($node_version)"
    else
        print_error "Node.js not found"
        print_fix "Install Node.js from: https://nodejs.org"
        ((issues++))
    fi
    
    # Check npm
    print_checking "npm"
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        print_success "npm installed ($npm_version)"
    else
        print_error "npm not found"
        print_fix "npm should come with Node.js installation"
        ((issues++))
    fi
    
    # Check git
    print_checking "Git"
    if command -v git &> /dev/null; then
        local git_version=$(git --version | cut -d' ' -f3)
        print_success "Git installed ($git_version)"
    else
        print_error "Git not found"
        print_fix "Install Xcode Command Line Tools: xcode-select --install"
        ((issues++))
    fi
    
    return $issues
}

# Check environment configuration
check_environment() {
    print_section "Environment Configuration"
    
    local issues=0
    
    # Check .env file
    print_checking ".env file"
    if [ -f .env ]; then
        print_success ".env file exists"
        
        # Load it
        set -a
        source .env
        set +a
        
        # Check each required variable
        print_checking "Environment variables"
        
        if [ -z "$SLACK_BOT_TOKEN" ]; then
            print_error "SLACK_BOT_TOKEN is not set"
            ((issues++))
        elif [[ ! "$SLACK_BOT_TOKEN" =~ ^xoxb- ]]; then
            print_error "SLACK_BOT_TOKEN has wrong format (should start with xoxb-)"
            ((issues++))
        else
            print_success "SLACK_BOT_TOKEN is set correctly"
        fi
        
        if [ -z "$SLACK_TEAM_ID" ]; then
            print_error "SLACK_TEAM_ID is not set"
            ((issues++))
        elif [[ ! "$SLACK_TEAM_ID" =~ ^T[A-Z0-9]{8,10}$ ]]; then
            print_error "SLACK_TEAM_ID has wrong format (should be like T1234ABCD)"
            ((issues++))
        else
            print_success "SLACK_TEAM_ID is set correctly"
        fi
        
        if [ -z "$LINEAR_API_KEY" ]; then
            print_error "LINEAR_API_KEY is not set"
            ((issues++))
        elif [[ ! "$LINEAR_API_KEY" =~ ^lin_api_ ]]; then
            print_error "LINEAR_API_KEY has wrong format (should start with lin_api_)"
            ((issues++))
        else
            print_success "LINEAR_API_KEY is set correctly"
        fi
        
        if [ -z "$NOTION_TOKEN" ]; then
            print_error "NOTION_TOKEN is not set"
            ((issues++))
        elif [[ ! "$NOTION_TOKEN" =~ ^secret_ ]]; then
            print_error "NOTION_TOKEN has wrong format (should start with secret_)"
            ((issues++))
        else
            print_success "NOTION_TOKEN is set correctly"
        fi
        
    else
        print_error ".env file not found"
        print_fix "Run: cp .env.example .env"
        print_fix "Then edit .env with your API keys"
        ((issues++))
    fi
    
    return $issues
}

# Check MCP servers
check_mcp_servers() {
    print_section "MCP Server Configuration"
    
    local issues=0
    
    # Check if claude mcp list works
    print_checking "MCP command availability"
    if claude mcp list &>/dev/null; then
        print_success "MCP commands available"
    else
        print_error "MCP commands not available"
        print_fix "Make sure you have the latest version of Claude"
        return 1
    fi
    
    # Get list of configured servers
    local servers=$(claude mcp list 2>/dev/null || echo "")
    
    # Check each required server
    print_checking "Configured MCP servers"
    
    if echo "$servers" | grep -q "slack-server"; then
        print_success "slack-server is configured"
    else
        print_error "slack-server is not configured"
        print_fix "Run: ./setup-mcp-servers.sh"
        ((issues++))
    fi
    
    if echo "$servers" | grep -q "linear-server"; then
        print_success "linear-server is configured"
    else
        print_error "linear-server is not configured"
        print_fix "Run: ./setup-mcp-servers.sh"
        ((issues++))
    fi
    
    if echo "$servers" | grep -q "notion-server"; then
        print_success "notion-server is configured"
    else
        print_error "notion-server is not configured"
        print_fix "Run: ./setup-mcp-servers.sh"
        ((issues++))
    fi
    
    if echo "$servers" | grep -q "filesystem-server"; then
        print_success "filesystem-server is configured"
    else
        print_warning "filesystem-server is not configured (optional)"
    fi
    
    return $issues
}

# Test API connections
test_api_connections() {
    print_section "API Connection Tests"
    
    local issues=0
    
    if [ ! -f .env ]; then
        print_warning "Skipping API tests - no .env file"
        return 1
    fi
    
    # Test Slack
    print_checking "Slack API"
    local slack_test=$(curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
        "https://slack.com/api/auth.test" 2>/dev/null || echo "{}")
    
    if echo "$slack_test" | grep -q '"ok":true'; then
        print_success "Slack API key is valid"
        
        # Check team ID
        local team_id=$(echo "$slack_test" | grep -o '"team_id":"[^"]*"' | cut -d'"' -f4)
        if [ "$team_id" = "$SLACK_TEAM_ID" ]; then
            print_success "Slack team ID matches"
        else
            print_error "Slack team ID mismatch (expected: $SLACK_TEAM_ID, got: $team_id)"
            print_fix "Update SLACK_TEAM_ID in your .env file"
            ((issues++))
        fi
    else
        print_error "Slack API key is invalid"
        print_fix "Check your SLACK_BOT_TOKEN in .env"
        ((issues++))
    fi
    
    # Test Linear
    print_checking "Linear API"
    local linear_test=$(curl -s -H "Authorization: $LINEAR_API_KEY" \
        "https://api.linear.app/graphql" \
        -d '{"query":"{ viewer { id } }"}' 2>/dev/null || echo "{}")
    
    if echo "$linear_test" | grep -q '"viewer"'; then
        print_success "Linear API key is valid"
    else
        print_error "Linear API key is invalid"
        print_fix "Check your LINEAR_API_KEY in .env"
        ((issues++))
    fi
    
    # Test Notion
    print_checking "Notion API"
    local notion_test=$(curl -s -H "Authorization: Bearer $NOTION_TOKEN" \
        -H "Notion-Version: 2022-06-28" \
        "https://api.notion.com/v1/users/me" 2>/dev/null || echo "{}")
    
    if echo "$notion_test" | grep -q '"type"'; then
        print_success "Notion API key is valid"
    else
        print_error "Notion API key is invalid"
        print_fix "Check your NOTION_TOKEN in .env"
        ((issues++))
    fi
    
    return $issues
}

# Check common issues
check_common_issues() {
    print_section "Common Issues"
    
    # Check if running in correct directory
    print_checking "Working directory"
    if [ -f "generate-pitch.sh" ]; then
        print_success "In correct project directory"
    else
        print_error "Not in feature-request-mcp directory"
        print_fix "cd to the feature-request-mcp directory"
    fi
    
    # Check file permissions
    print_checking "Script permissions"
    if [ -x "setup-mcp-servers.sh" ]; then
        print_success "Scripts are executable"
    else
        print_warning "Scripts may not be executable"
        print_fix "Run: chmod +x *.sh"
    fi
    
    # Check for spaces in API keys
    if [ -f .env ]; then
        print_checking "API key formatting"
        if grep -E "(SLACK_BOT_TOKEN|LINEAR_API_KEY|NOTION_TOKEN)=['\"]" .env &>/dev/null; then
            print_warning "API keys might have quotes - remove any quotes from .env file"
        else
            print_success "API key formatting looks correct"
        fi
    fi
}

# Suggest fixes
suggest_fixes() {
    print_section "Recommended Actions"
    
    echo -e "${BOLD}If you're having issues:${NC}"
    echo ""
    echo "1. ${CYAN}Reset and start fresh:${NC}"
    echo "   ./reset-mcp-setup.sh"
    echo "   ./setup-mcp-servers.sh"
    echo ""
    echo "2. ${CYAN}Manually check API keys:${NC}"
    echo "   cat .env  # Make sure no extra spaces or quotes"
    echo ""
    echo "3. ${CYAN}Test individual connections:${NC}"
    echo "   ./test-mcp-connections.sh"
    echo ""
    echo "4. ${CYAN}Get help:${NC}"
    echo "   - Check API_KEYS_GUIDE.md for key setup"
    echo "   - Ask in #product-tools on Slack"
    echo "   - Review SETUP_GUIDE.md"
}

# Generate diagnostic report
generate_report() {
    local report_file="mcp-diagnostic-report.txt"
    
    echo "MCP Diagnostic Report" > "$report_file"
    echo "Generated: $(date)" >> "$report_file"
    echo "=========================" >> "$report_file"
    echo "" >> "$report_file"
    
    # System info
    echo "System Information:" >> "$report_file"
    echo "- OS: $(uname -a)" >> "$report_file"
    echo "- Claude: $(claude --version 2>/dev/null || echo 'not found')" >> "$report_file"
    echo "- Node: $(node --version 2>/dev/null || echo 'not found')" >> "$report_file"
    echo "- npm: $(npm --version 2>/dev/null || echo 'not found')" >> "$report_file"
    echo "" >> "$report_file"
    
    # MCP servers
    echo "MCP Servers:" >> "$report_file"
    claude mcp list >> "$report_file" 2>&1 || echo "Error listing MCP servers" >> "$report_file"
    echo "" >> "$report_file"
    
    # Environment (sanitized)
    echo "Environment Variables (sanitized):" >> "$report_file"
    if [ -f .env ]; then
        grep -E "^(SLACK_BOT_TOKEN|SLACK_TEAM_ID|LINEAR_API_KEY|NOTION_TOKEN)=" .env | \
            sed 's/=.*/=<REDACTED>/' >> "$report_file"
    else
        echo ".env file not found" >> "$report_file"
    fi
    
    print_info "Diagnostic report saved to: $report_file"
    print_info "You can share this report when asking for help (sensitive data is redacted)"
}

# Main execution
main() {
    clear
    show_banner
    
    print_info "This script will help diagnose MCP setup issues"
    echo ""
    
    local total_issues=0
    
    # Run all checks
    check_system
    total_issues=$((total_issues + $?))
    
    check_environment
    total_issues=$((total_issues + $?))
    
    check_mcp_servers
    total_issues=$((total_issues + $?))
    
    test_api_connections
    total_issues=$((total_issues + $?))
    
    check_common_issues
    
    # Summary
    print_section "Summary"
    
    if [ $total_issues -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✨ No issues found! ✨${NC}"
        echo ""
        print_info "Everything appears to be configured correctly"
        print_info "If you're still having issues, try:"
        echo "   - Running ./test-mcp-connections.sh"
        echo "   - Checking if your Slack bot is invited to channels"
        echo "   - Verifying Notion pages are shared with your integration"
    else
        echo -e "${RED}${BOLD}Found $total_issues issue(s) that need attention${NC}"
        echo ""
        suggest_fixes
    fi
    
    echo ""
    read -p "Generate diagnostic report? (y/n) [n]: " generate_report_choice
    if [[ "$generate_report_choice" =~ ^[Yy]$ ]]; then
        generate_report
    fi
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi