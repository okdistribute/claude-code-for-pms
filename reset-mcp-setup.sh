#!/bin/bash

# MCP Reset Script
# This script removes all MCP configurations and allows a fresh start

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
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

print_info() {
    echo -e "${CYAN}ℹ${NC}  $1"
}

print_step() {
    echo -e "\n${BLUE}▶${NC} ${BOLD}$1${NC}"
}

# Banner
show_banner() {
    echo -e "${RED}"
    cat << "EOF"
 __  __  ____ ____    ____                _   
|  \/  |/ ___|  _ \  |  _ \ ___  ___  ___| |_ 
| |\/| | |   | |_) | | |_) / _ \/ __|/ _ \ __|
| |  | | |___|  __/  |  _ <  __/\__ \  __/ |_ 
|_|  |_|\____|_|     |_| \_\___||___/\___|\__|
                                               
        Clean Slate - Start Fresh
EOF
    echo -e "${NC}"
}

# Confirm reset
confirm_reset() {
    echo -e "${YELLOW}${BOLD}⚠️  WARNING: This will remove all MCP configurations! ⚠️${NC}"
    echo ""
    print_info "This script will:"
    echo "  • Remove all configured MCP servers"
    echo "  • Keep your .env file intact (API keys safe)"
    echo "  • Allow you to run setup again from scratch"
    echo ""
    
    read -p "Are you sure you want to reset? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Reset cancelled. No changes made."
        exit 0
    fi
}

# Backup current configuration
backup_config() {
    print_step "Creating backup of current configuration..."
    
    local backup_dir="mcp-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup .env if it exists
    if [ -f .env ]; then
        cp .env "$backup_dir/.env.backup"
        print_success "Backed up .env file to $backup_dir/"
    fi
    
    # Save current MCP server list
    if command -v claude &> /dev/null; then
        claude mcp list > "$backup_dir/mcp-servers.txt" 2>&1 || true
        print_success "Saved current MCP server list"
    fi
    
    print_info "Backup created in: $backup_dir/"
}

# Remove MCP servers
remove_mcp_servers() {
    print_step "Removing MCP servers..."
    
    if ! command -v claude &> /dev/null; then
        print_warning "Claude not found - skipping MCP server removal"
        return
    fi
    
    # List of servers to remove
    local servers=("slack-server" "linear-server" "notion-server" "filesystem-server")
    
    for server in "${servers[@]}"; do
        print_info "Removing $server..."
        if claude mcp remove "$server" 2>/dev/null; then
            print_success "$server removed"
        else
            print_info "$server was not configured or already removed"
        fi
    done
}

# Clean up local files
cleanup_files() {
    print_step "Cleaning up temporary files..."
    
    # Remove any temporary test files
    rm -f test-connections-temp.sh 2>/dev/null || true
    rm -f mcp-diagnostic-report.txt 2>/dev/null || true
    
    print_success "Temporary files cleaned up"
}

# Show next steps
show_next_steps() {
    print_step "Reset Complete!"
    
    echo ""
    print_success "All MCP configurations have been removed"
    print_info "Your API keys in .env are still safe"
    
    echo ""
    echo -e "${BOLD}Next steps:${NC}"
    echo ""
    echo "1. ${CYAN}Run the setup script again:${NC}"
    echo "   ./setup-mcp-servers.sh"
    echo ""
    echo "2. ${CYAN}Or if you need new API keys:${NC}"
    echo "   rm .env"
    echo "   cp .env.example .env"
    echo "   # Edit .env with new keys"
    echo "   ./setup-mcp-servers.sh"
    echo ""
    echo "3. ${CYAN}Test your setup:${NC}"
    echo "   ./test-mcp-connections.sh"
    
    echo ""
    print_info "Your backup is saved in: mcp-backup-*/"
}

# Main execution
main() {
    clear
    show_banner
    
    print_info "This script will reset your MCP configuration"
    echo ""
    
    # Confirm before proceeding
    confirm_reset
    
    # Create backup
    backup_config
    
    # Remove MCP servers
    remove_mcp_servers
    
    # Clean up files
    cleanup_files
    
    # Show next steps
    show_next_steps
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi