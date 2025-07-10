#!/bin/bash

# MCP Connection Test Script
# This script verifies all MCP servers are properly configured and working

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
print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_failure() {
    echo -e "${RED}❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️ ${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ️ ${NC} $1"
}

print_testing() {
    echo -e "${BLUE}🔍${NC} Testing $1..."
}

# Banner
show_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
 __  __  ____ ____    _____         _   
|  \/  |/ ___|  _ \  |_   _|__  ___| |_ 
| |\/| | |   | |_) |   | |/ _ \/ __| __|
| |  | | |___|  __/    | |  __/\__ \ |_ 
|_|  |_|\____|_|       |_|\___||___/\__|
                                         
     MCP Connection Test Suite
EOF
    echo -e "${NC}"
}

# Load environment variables
load_env() {
    if [ -f .env ]; then
        set -a
        source .env
        set +a
        print_info "Loaded environment variables from .env"
    else
        print_failure "No .env file found!"
        print_info "Run ./setup-mcp-servers.sh first to create your configuration"
        exit 1
    fi
}

# Check if Claude is installed
check_claude() {
    print_testing "Claude installation"
    
    if command -v claude &> /dev/null; then
        local version=$(claude --version 2>/dev/null || echo "unknown")
        print_success "Claude is installed (version: $version)"
        return 0
    else
        print_failure "Claude is not installed"
        print_info "Please install Claude from https://claude.ai/download"
        return 1
    fi
}

# Test Slack connection
test_slack() {
    print_testing "Slack MCP server"
    
    # Create a temporary test file
    local test_result=$(mktemp)
    
    # Test Slack connection
    if claude --no-interactive > "$test_result" 2>&1 << 'EOF'
Use the Slack MCP server to list channels with limit 1. Just return the channel name if successful.
EOF
    then
        if grep -qE "(channel|general|random)" "$test_result"; then
            print_success "Slack connection successful"
            print_info "Bot can access channels"
            rm -f "$test_result"
            return 0
        else
            print_failure "Slack connection failed - no channels found"
            print_info "Make sure your bot is invited to channels"
            cat "$test_result"
            rm -f "$test_result"
            return 1
        fi
    else
        print_failure "Slack connection failed"
        print_info "Check your SLACK_BOT_TOKEN and SLACK_TEAM_ID"
        cat "$test_result"
        rm -f "$test_result"
        return 1
    fi
}

# Test Linear connection
test_linear() {
    print_testing "Linear MCP server"
    
    # Create a temporary test file
    local test_result=$(mktemp)
    
    # Test Linear connection
    if claude --no-interactive > "$test_result" 2>&1 << 'EOF'
Use the Linear MCP server to list teams. Just return the first team name if successful.
EOF
    then
        if grep -qE "(team|Team)" "$test_result"; then
            print_success "Linear connection successful"
            print_info "API key is valid and has access to teams"
            rm -f "$test_result"
            return 0
        else
            print_failure "Linear connection failed - no teams found"
            print_info "Your API key might not have proper permissions"
            cat "$test_result"
            rm -f "$test_result"
            return 1
        fi
    else
        print_failure "Linear connection failed"
        print_info "Check your LINEAR_API_KEY"
        cat "$test_result"
        rm -f "$test_result"
        return 1
    fi
}

# Test Notion connection
test_notion() {
    print_testing "Notion MCP server"
    
    # Create a temporary test file
    local test_result=$(mktemp)
    
    # Test Notion connection
    if claude --no-interactive > "$test_result" 2>&1 << 'EOF'
Use the Notion MCP server to get information about the current user (get-self). Just return the user type if successful.
EOF
    then
        if grep -qE "(bot|user|User)" "$test_result"; then
            print_success "Notion connection successful"
            print_info "Integration token is valid"
            rm -f "$test_result"
            return 0
        else
            print_failure "Notion connection failed"
            print_info "Token might be invalid or expired"
            cat "$test_result"
            rm -f "$test_result"
            return 1
        fi
    else
        print_failure "Notion connection failed"
        print_info "Check your NOTION_TOKEN"
        cat "$test_result"
        rm -f "$test_result"
        return 1
    fi
}

# Test filesystem access
test_filesystem() {
    print_testing "Filesystem MCP server"
    
    # Create a temporary test file
    local test_result=$(mktemp)
    
    # Test filesystem access
    if claude --no-interactive > "$test_result" 2>&1 << 'EOF'
Use the filesystem MCP server to list files in the current directory. Just confirm if you can see any .md files.
EOF
    then
        if grep -qE "(README|\.md|markdown)" "$test_result"; then
            print_success "Filesystem access working"
            print_info "Can read files in project directory"
            rm -f "$test_result"
            return 0
        else
            print_warning "Filesystem access unclear"
            print_info "May need to reconfigure filesystem server"
            rm -f "$test_result"
            return 0
        fi
    else
        print_failure "Filesystem access failed"
        rm -f "$test_result"
        return 1
    fi
}

# Quick functionality test
test_integration() {
    print_testing "Integration test"
    
    echo ""
    print_info "Attempting to fetch a Slack channel list and verify Linear access..."
    
    # Create a temporary test file
    local test_result=$(mktemp)
    
    if claude --no-interactive > "$test_result" 2>&1 << 'EOF'
Please do two quick tests:
1. List one Slack channel using the Slack MCP server
2. List one Linear team using the Linear MCP server
Just return "Both services working" if both succeed.
EOF
    then
        if grep -q "Both services working" "$test_result"; then
            print_success "Integration test passed - services can work together"
        else
            print_warning "Partial success - check individual service results above"
        fi
    else
        print_failure "Integration test failed"
    fi
    
    rm -f "$test_result"
}

# Generate summary report
generate_report() {
    echo ""
    echo -e "${BOLD}==== Test Summary ====${NC}"
    echo ""
    
    local all_passed=true
    
    # Check each result
    if [ "$CLAUDE_OK" = true ]; then
        echo -e "Claude Code:    ${GREEN}✅ Installed${NC}"
    else
        echo -e "Claude Code:    ${RED}❌ Not installed${NC}"
        all_passed=false
    fi
    
    if [ "$SLACK_OK" = true ]; then
        echo -e "Slack Server:   ${GREEN}✅ Connected${NC}"
    else
        echo -e "Slack Server:   ${RED}❌ Failed${NC}"
        all_passed=false
    fi
    
    if [ "$LINEAR_OK" = true ]; then
        echo -e "Linear Server:  ${GREEN}✅ Connected${NC}"
    else
        echo -e "Linear Server:  ${RED}❌ Failed${NC}"
        all_passed=false
    fi
    
    if [ "$NOTION_OK" = true ]; then
        echo -e "Notion Server:  ${GREEN}✅ Connected${NC}"
    else
        echo -e "Notion Server:  ${RED}❌ Failed${NC}"
        all_passed=false
    fi
    
    if [ "$FILESYSTEM_OK" = true ]; then
        echo -e "Filesystem:     ${GREEN}✅ Accessible${NC}"
    else
        echo -e "Filesystem:     ${YELLOW}⚠️  Check needed${NC}"
    fi
    
    echo ""
    
    if [ "$all_passed" = true ]; then
        echo -e "${GREEN}${BOLD}✨ All systems operational! ✨${NC}"
        echo ""
        print_info "You're ready to start creating feature requests!"
        print_info "Try: ./generate-pitch.sh --interactive"
    else
        echo -e "${RED}${BOLD}⚠️  Some services need attention${NC}"
        echo ""
        print_info "Fix the issues above and run this test again"
        print_info "For help, run: ./troubleshoot-mcp.sh"
    fi
}

# Main execution
main() {
    clear
    show_banner
    
    print_info "This script will test all MCP server connections"
    print_info "It may take a minute to complete all tests"
    echo ""
    
    # Load environment
    load_env
    echo ""
    
    # Run tests and store results
    CLAUDE_OK=false
    SLACK_OK=false
    LINEAR_OK=false
    NOTION_OK=false
    FILESYSTEM_OK=false
    
    if check_claude; then CLAUDE_OK=true; fi
    echo ""
    
    if test_slack; then SLACK_OK=true; fi
    echo ""
    
    if test_linear; then LINEAR_OK=true; fi
    echo ""
    
    if test_notion; then NOTION_OK=true; fi
    echo ""
    
    if test_filesystem; then FILESYSTEM_OK=true; fi
    echo ""
    
    # Run integration test if basics pass
    if [ "$SLACK_OK" = true ] && [ "$LINEAR_OK" = true ]; then
        test_integration
    fi
    
    # Generate report
    generate_report
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi