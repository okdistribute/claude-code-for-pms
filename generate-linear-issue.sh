#!/bin/bash

# Linear Issue Generator with Shape Up Format
# This script aggregates data from multiple sources to generate comprehensive Linear issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
OUTPUT_DIR="./linear-issues"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TODAY=$(date +"%Y-%m-%d")

# Help function
show_help() {
    echo "Linear Issue Generator (Shape Up Format)"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --title TITLE           Issue title (required)"
    echo "  -T, --team-id ID            Linear team ID (required)"
    echo "  -z, --zoom-meeting ID       Zoom meeting ID to include"
    echo "  -s, --slack-thread URL      Slack thread URL or channel name"
    echo "  -l, --linear-issue ID       Related Linear issue ID"
    echo "  -n, --notion-page ID        Notion page ID to include"
    echo "  -f, --files PATTERN         File pattern to analyze (e.g., 'src/**/*.js')"
    echo "  -o, --output FILE           Output file for generated content"
    echo "  -a, --appetite APPETITE     Appetite: small-batch|big-batch"
    echo "  --requester NAME            Requester name (default: current user)"
    echo "  --create                    Create issue directly in Linear"
    echo "  --customer NAME             Create customer request for NAME (requires --create)"
    echo "  --interactive               Interactive mode with prompts"
    echo "  -v, --verbose               Show detailed progress and Claude's output"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --title \"SQLite in-memory for tests\" --team-id \"abc123\" --slack-thread \"https://workspace.slack.com/archives/C123/p1234567890123456\""
    echo "  $0 --interactive --create"
    echo "  $0 -t \"User dashboard\" -T \"xyz789\" -z 123456789 -l PROJ-123 --appetite small-batch"
    echo "  $0 -t \"Export feature\" -T \"abc123\" --customer \"Acme Corp\" --create"
}

# Parse Slack URL to extract channel ID and thread timestamp
parse_slack_url() {
    local url="$1"
    
    # Pattern: https://workspace.slack.com/archives/CHANNEL_ID/pTIMESTAMP
    if [[ "$url" =~ /archives/([A-Z0-9]+)/p([0-9]+) ]]; then
        SLACK_CHANNEL_ID="${BASH_REMATCH[1]}"
        # Convert timestamp format: p1751379400721089 -> 1751379400.721089
        local ts="${BASH_REMATCH[2]}"
        SLACK_THREAD_TS="${ts:0:10}.${ts:10}"
        return 0
    fi
    
    # If not a URL, treat as channel name
    SLACK_CHANNEL="$url"
    return 1
}

# Parse command line arguments
parse_args() {
    TITLE=""
    TEAM_ID=""
    ZOOM_MEETING=""
    SLACK_CHANNEL=""
    SLACK_CHANNEL_ID=""
    SLACK_THREAD_TS=""
    LINEAR_ISSUE=""
    NOTION_PAGE=""
    FILE_PATTERN=""
    OUTPUT_FILE=""
    APPETITE=""
    REQUESTER=$(whoami)
    CREATE_ISSUE=false
    INTERACTIVE=false
    VERBOSE=false
    CUSTOMER_NAME=""
    CREATE_CUSTOMER_REQUEST=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--title)
                TITLE="$2"
                shift 2
                ;;
            -T|--team-id)
                TEAM_ID="$2"
                shift 2
                ;;
            -z|--zoom-meeting)
                ZOOM_MEETING="$2"
                shift 2
                ;;
            -s|--slack-thread)
                parse_slack_url "$2"
                shift 2
                ;;
            -l|--linear-issue)
                LINEAR_ISSUE="$2"
                shift 2
                ;;
            -n|--notion-page)
                NOTION_PAGE="$2"
                shift 2
                ;;
            -f|--files)
                FILE_PATTERN="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            -a|--appetite)
                APPETITE="$2"
                shift 2
                ;;
            --requester)
                REQUESTER="$2"
                shift 2
                ;;
            --create)
                CREATE_ISSUE=true
                shift
                ;;
            --customer)
                CUSTOMER_NAME="$2"
                CREATE_CUSTOMER_REQUEST=true
                shift 2
                ;;
            --interactive)
                INTERACTIVE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Interactive mode
interactive_mode() {
    print_step "Interactive Linear Issue Generation (Shape Up Format)"
    echo ""
    
    read -p "Issue title: " TITLE
    read -p "Linear team ID: " TEAM_ID
    read -p "Appetite (small-batch/big-batch): " APPETITE
    
    read -p "Requester name [$REQUESTER]: " requester_input
    REQUESTER=${requester_input:-$REQUESTER}
    
    echo ""
    print_step "Data Sources (leave empty to skip)"
    
    read -p "Zoom meeting ID: " ZOOM_MEETING
    read -p "Slack thread URL or channel name: " slack_input
    if [[ -n "$slack_input" ]]; then
        parse_slack_url "$slack_input"
    fi
    read -p "Related Linear issue ID: " LINEAR_ISSUE
    read -p "Notion page ID: " NOTION_PAGE
    read -p "File pattern to analyze: " FILE_PATTERN
    read -p "Output file (optional): " OUTPUT_FILE
    
    read -p "Create issue in Linear? (y/n) [n]: " create_input
    if [[ "$create_input" =~ ^[Yy]$ ]]; then
        CREATE_ISSUE=true
        
        read -p "Create customer request? (y/n) [n]: " customer_input
        if [[ "$customer_input" =~ ^[Yy]$ ]]; then
            CREATE_CUSTOMER_REQUEST=true
            read -p "Customer name: " CUSTOMER_NAME
        fi
    fi
}

# Validate inputs
validate_inputs() {
    if [[ -z "$TITLE" ]]; then
        print_error "Title is required. Use -t/--title or --interactive mode."
        exit 1
    fi
    
    if [[ "$CREATE_ISSUE" == true && -z "$TEAM_ID" ]]; then
        print_error "Team ID is required when creating issues. Use -T/--team-id."
        exit 1
    fi
    
    if [[ "$CREATE_CUSTOMER_REQUEST" == true && "$CREATE_ISSUE" != true ]]; then
        print_error "Customer requests require --create flag to create the issue first."
        exit 1
    fi
    
    if [[ -n "$APPETITE" && ! "$APPETITE" =~ ^(small-batch|big-batch)$ ]]; then
        print_error "Appetite must be small-batch or big-batch"
        exit 1
    fi
}

# Generate output filename
generate_output_filename() {
    if [[ -z "$OUTPUT_FILE" ]]; then
        # Create safe filename from title
        SAFE_TITLE=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
        OUTPUT_FILE="${OUTPUT_DIR}/linear-issue-${TODAY}-${SAFE_TITLE}.md"
    fi
    
    mkdir -p "$(dirname "$OUTPUT_FILE")"
}

# Generate data collection prompt
generate_data_prompt() {
    local temp_file=$(mktemp)
    
    cat > "$temp_file" << EOF
Please help me generate a Linear issue using the Shape Up format based on the following information.

**Issue Title:** $TITLE
**Requester:** $REQUESTER
${APPETITE:+**Appetite:** $APPETITE}

Please collect and analyze data from the following sources:

EOF

    # Add data source references
    if [[ -n "$ZOOM_MEETING" ]]; then
        echo "- **Zoom Meeting:** @zoom:transcript://$ZOOM_MEETING" >> "$temp_file"
    fi
    
    if [[ -n "$SLACK_THREAD_TS" && -n "$SLACK_CHANNEL_ID" ]]; then
        echo "- **Slack Thread:** Channel ID: $SLACK_CHANNEL_ID, Thread: $SLACK_THREAD_TS" >> "$temp_file"
        echo "  Please use the Slack MCP to fetch the thread replies from this specific conversation." >> "$temp_file"
    elif [[ -n "$SLACK_CHANNEL" ]]; then
        echo "- **Slack Channel:** @slack:channel://$SLACK_CHANNEL" >> "$temp_file"
    fi
    
    if [[ -n "$LINEAR_ISSUE" ]]; then
        echo "- **Related Linear Issue:** @linear:issue://$LINEAR_ISSUE" >> "$temp_file"
    fi
    
    if [[ -n "$NOTION_PAGE" ]]; then
        echo "- **Notion Page:** @notion:page://$NOTION_PAGE" >> "$temp_file"
    fi
    
    if [[ -n "$FILE_PATTERN" ]]; then
        echo "- **Code Files:** Analyze files matching pattern: $FILE_PATTERN" >> "$temp_file"
    fi
    
    cat >> "$temp_file" << 'EOF'

**Instructions:**
1. Collect relevant information from each specified data source
2. Analyze the content to understand the problem, context, and technical considerations
3. Generate a Linear issue description using the Shape Up format below
4. Focus on extracting concrete problems, realistic appetites, and clear solutions

**Shape Up Format Template:**

# Problem

Articulate the problem that this piece of work addresses

What is the status quo and why does that not work?

Why does the problem matter?

Why is this the right time to address this problem?

# Appetite

How much time and resources are we willing to spend to address this problem?

# Solution

Give a "fat marker" sketch of the solution, identifying key architectural or design decisions. Tie the scope back to the appetite — are we confident we can build this with the resources we're willing to spend on it?

What are the constraints on the solution?

# Out of Bounds & Rabbit Holes

Identify and describe potential hurdles or areas of uncertainty in the proposed solution

Describe any areas that are intentionally out of scope that don't relate to specific parts of the solution

---

Please generate the issue description following this exact format. Use concrete details from the data sources to fill in each section. If information is missing for a section, note what additional clarification would be needed.
EOF

    echo "$temp_file"
}

# Generate issue content using Claude
generate_issue_content() {
    print_step "Generating Linear issue content with Claude..."
    
    local prompt_file=$(generate_data_prompt)
    local temp_output=$(mktemp)
    
    if [[ "$VERBOSE" == true ]]; then
        print_step "Claude is now processing your request..."
        echo "This involves:"
        [[ -n "$ZOOM_MEETING" ]] && echo "  - Fetching Zoom meeting transcript"
        [[ -n "$SLACK_THREAD_TS" ]] && echo "  - Fetching Slack thread conversation"
        [[ -n "$SLACK_CHANNEL" ]] && echo "  - Searching Slack channel"
        [[ -n "$LINEAR_ISSUE" ]] && echo "  - Getting Linear issue details"
        [[ -n "$NOTION_PAGE" ]] && echo "  - Fetching Notion page content"
        [[ -n "$FILE_PATTERN" ]] && echo "  - Analyzing code files"
        echo "  - Generating Shape Up formatted issue description"
        echo ""
        echo "Claude's output:"
        echo "----------------"
    fi
    
    # Use Claude to process the data and generate the issue content
    if [[ "$VERBOSE" == true ]]; then
        # Show real-time output
        if claude < "$prompt_file" 2>&1 | tee "$temp_output"; then
            # Extract just the generated content (after the last separator)
            if grep -q "^# Problem" "$temp_output"; then
                tail -n +$(grep -n "^# Problem" "$temp_output" | tail -1 | cut -d: -f1) "$temp_output" > "$OUTPUT_FILE"
            else
                cp "$temp_output" "$OUTPUT_FILE"
            fi
            echo "----------------"
        else
            print_error "Failed to generate issue content with Claude"
            print_status "Prompt file saved at: $prompt_file"
            exit 1
        fi
    else
        if claude < "$prompt_file" > "$temp_output" 2>/dev/null; then
            cp "$temp_output" "$OUTPUT_FILE"
        else
            print_error "Failed to generate issue content with Claude"
            print_status "Prompt file saved at: $prompt_file"
            print_status "You can manually run: claude < $prompt_file"
            exit 1
        fi
    fi
    
    # Cleanup
    rm -f "$prompt_file" "$temp_output"
}

# Search for existing customers in Linear
search_customers() {
    local search_term="$1"
    print_step "Searching for customers matching: $search_term"
    
    # Use Claude to search for customers
    local customers=$(claude --no-interactive << EOF
Search Linear for customers with names similar to "$search_term". List the customer names and their IDs.
EOF
)
    
    echo "$customers"
}

# Confirm customer selection
confirm_customer() {
    local customer_name="$1"
    
    print_step "Searching for existing customers..."
    
    # Search for customers
    local search_results=$(search_customers "$customer_name")
    
    if [[ -n "$search_results" ]]; then
        print_status "Found potential matches:"
        echo "$search_results"
        echo ""
        
        # Ask for confirmation
        read -p "Do any of these match the customer '$customer_name'? (y/n) [n]: " use_existing
        
        if [[ "$use_existing" =~ ^[Yy]$ ]]; then
            read -p "Enter the customer ID from above (or press Enter to create new): " CUSTOMER_ID
            if [[ -n "$CUSTOMER_ID" ]]; then
                print_status "Using existing customer with ID: $CUSTOMER_ID"
                return 0
            fi
        fi
    fi
    
    # Create new customer
    print_warning "No existing customer selected. Will create new customer: $customer_name"
    read -p "Continue with creating new customer? (y/n) [y]: " create_new
    
    if [[ ! "$create_new" =~ ^[Nn]$ ]]; then
        CUSTOMER_ID=""
        return 0
    else
        print_error "Customer request creation cancelled"
        return 1
    fi
}

# Create Linear issue via API
create_linear_issue() {
    print_step "Creating Linear issue..."
    
    # Read the generated content
    local description=$(cat "$OUTPUT_FILE")
    
    if [[ "$VERBOSE" == true ]]; then
        print_step "Calling Linear API to create issue..."
        echo "Team ID: $TEAM_ID"
        echo "Title: $TITLE"
        echo ""
    fi
    
    # Create the issue using Linear MCP
    if [[ "$VERBOSE" == true ]]; then
        local result=$(claude --no-interactive << EOF 2>&1 | tee /dev/stderr
@linear create-issue --title "$TITLE" --team-id "$TEAM_ID" --description "$(cat "$OUTPUT_FILE")"
EOF
)
    else
        local result=$(claude --no-interactive << EOF
@linear create-issue --title "$TITLE" --team-id "$TEAM_ID" --description "$(cat "$OUTPUT_FILE")"
EOF
)
    fi
    
    if [[ $? -eq 0 ]]; then
        print_status "Linear issue created successfully!"
        
        # Extract issue ID from result
        CREATED_ISSUE_ID=$(echo "$result" | grep -oE 'id: "[^"]+"' | cut -d'"' -f2 | head -1)
        
        if [[ -n "$CREATED_ISSUE_ID" ]]; then
            print_status "Issue ID: $CREATED_ISSUE_ID"
            
            # Create customer request if requested
            if [[ "$CREATE_CUSTOMER_REQUEST" == true && -n "$CUSTOMER_NAME" ]]; then
                create_customer_request "$CREATED_ISSUE_ID"
            fi
        fi
        
        echo "$result"
    else
        print_error "Failed to create Linear issue"
        print_status "Issue content saved to: $OUTPUT_FILE"
        print_status "You can manually create the issue with the generated content"
    fi
}

# Create customer request for the issue
create_customer_request() {
    local issue_id="$1"
    
    print_step "Creating customer request for: $CUSTOMER_NAME"
    
    # First, confirm customer
    if ! confirm_customer "$CUSTOMER_NAME"; then
        return 1
    fi
    
    # Create the customer request
    local request_body="Customer request from $CUSTOMER_NAME regarding: $TITLE"
    
    if [[ "$VERBOSE" == true ]]; then
        print_step "Creating customer request..."
    fi
    
    local result
    if [[ -n "$CUSTOMER_ID" ]]; then
        # Use existing customer
        result=$(claude --no-interactive << EOF
Create a Linear customer request:
- Issue ID: $issue_id
- Customer ID: $CUSTOMER_ID
- Body: "$request_body"
EOF
)
    else
        # Create new customer
        result=$(claude --no-interactive << EOF
Create a new Linear customer "$CUSTOMER_NAME" and then create a customer request:
- Issue ID: $issue_id
- Customer Name: $CUSTOMER_NAME
- Body: "$request_body"
EOF
)
    fi
    
    if [[ $? -eq 0 ]]; then
        print_status "Customer request created successfully!"
        
        # Print clickable links
        print_step "Review your created items:"
        
        # Get workspace URL
        local workspace_url=$(claude --no-interactive << EOF
Get the Linear workspace URL for this team.
EOF
)
        
        if [[ -n "$workspace_url" && -n "$CREATED_ISSUE_ID" ]]; then
            echo ""
            print_status "Issue Link: ${workspace_url}/issue/${CREATED_ISSUE_ID}"
            print_status "Customer Link: ${workspace_url}/customers"
        fi
    else
        print_error "Failed to create customer request"
    fi
}

# Main execution
main() {
    print_status "Linear Issue Generator (Shape Up Format) starting..."
    
    parse_args "$@"
    
    if [[ "$INTERACTIVE" == true ]]; then
        interactive_mode
    fi
    
    validate_inputs
    generate_output_filename
    
    print_status "Generating Linear issue: $TITLE"
    print_status "Output file: $OUTPUT_FILE"
    
    generate_issue_content
    
    print_status "Issue content saved to: $OUTPUT_FILE"
    
    if [[ "$CREATE_ISSUE" == true ]]; then
        create_linear_issue
    else
        print_status "Run with --create to create the issue in Linear"
        echo ""
        print_step "Generated Issue Preview:"
        echo "---"
        head -n 20 "$OUTPUT_FILE"
        echo "..."
        echo "---"
        print_status "Full content saved to: $OUTPUT_FILE"
    fi
    
    print_status "Linear issue generation completed successfully!"
}

# Run main function with all arguments
main "$@"