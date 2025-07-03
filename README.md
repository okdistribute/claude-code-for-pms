# Linear Issue MCP Generator (Shape Up Format)

A comprehensive system for generating Linear issues in Shape Up format by aggregating data from multiple sources using Claude Code and Model Context Protocol (MCP) servers.

## Overview

This system allows you to automatically generate well-structured Linear issues following the Shape Up methodology by pulling data from:
- **Slack** threads and channel discussions  
- **Linear** existing issues for context
- **Notion** documentation pages
- **Local code files** for technical analysis
- **Meeting Transcripts** via Otter.ai (through Zapier MCP) or ChatterBox.io

## Quick Start

### 1. Setup Environment

Create a `.env` file with your credentials:

```bash
# Create .env file
touch .env
```

Add the following credentials to `.env`:
```bash
# Slack credentials (required)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_TEAM_ID=your-team-id

# Optional: Otter.ai via Zapier
ZAPIER_API_KEY=your-zapier-api-key
OTTER_ZAPIER_ENDPOINT=your-otter-zapier-endpoint
```

### 2. Install MCP Servers

Run the setup script to configure all MCP servers:

```bash
./setup-mcp-servers.sh
```

This will install and configure:
- Slack MCP server for accessing threads and channels
- Linear MCP server (if not already installed)
- Notion MCP server (if not already installed)
- Optional: Zapier MCP for Otter.ai integration

### 3. Generate Linear Issue

Use the generator script with your data sources:

```bash
# Interactive mode (recommended for first use)
./generate-linear-issue.sh --interactive

# Command line mode with Slack thread
./generate-linear-issue.sh \
  --title "SQLite in-memory for tests" \
  --team-id "your-team-id" \
  --slack-thread "https://workspace.slack.com/archives/C123/p1234567890123456" \
  --appetite "small-batch" \
  --files "src/components/**" \
  --create

# Create issue with customer request
./generate-linear-issue.sh \
  --title "Export to CSV feature" \
  --team-id "your-team-id" \
  --customer "Acme Corp" \
  --slack-thread "customer-feedback" \
  --create
```

## Detailed Usage

### Command Line Options

```bash
./generate-linear-issue.sh [OPTIONS]

Options:
  -t, --title TITLE           Issue title (required)
  -T, --team-id ID            Linear team ID (required for --create)
  -s, --slack-thread URL      Slack thread URL or channel name
  -l, --linear-issue ID       Related Linear issue ID
  -n, --notion-page ID        Notion page ID to include
  -f, --files PATTERN         File pattern to analyze
  -o, --output FILE           Output file (default: auto-generated)
  -a, --appetite APPETITE     Appetite: small-batch|big-batch
  --otter-meeting ID          Otter.ai meeting ID (via Zapier)
  --requester NAME            Requester name
  --create                    Create issue directly in Linear
  --customer NAME             Create customer request for NAME (requires --create)
  --interactive               Interactive mode with prompts
  -v, --verbose               Show detailed progress
  -h, --help                  Show help message
```

## Linear Issue Format (Shape Up)

The system generates Linear issues following the Shape Up methodology:

### Generated Issue Structure

```markdown
# Problem

Articulate the problem that this piece of work addresses
What is the status quo and why does that not work?
Why does the problem matter?
Why is this the right time to address this problem?

# Appetite

How much time and resources are we willing to spend to address this problem?
[small-batch: 1-2 weeks | big-batch: 4-6 weeks]

# Solution

Give a "fat marker" sketch of the solution, identifying key architectural or design decisions. 
Tie the scope back to the appetite — are we confident we can build this with the resources we're willing to spend on it?
What are the constraints on the solution?

# Out of Bounds & Rabbit Holes

Identify and describe potential hurdles or areas of uncertainty in the proposed solution
Describe any areas that are intentionally out of scope
```

## MCP Server Configuration

### Slack Server

Official MCP server that provides:
- Thread conversation access (primary use case)
- Channel message history
- User information
- Message search capabilities

### Linear Server  

MCP server for Linear integration:
- Create issues directly
- Reference existing issues
- Access team and project information
- Manage issue states and labels

### Notion Server

MCP server for documentation:
- Access Notion pages
- Search documentation
- Reference specs and requirements

### Filesystem Access

Claude Code's built-in capabilities for:
- Local file analysis
- Code pattern matching
- Project structure understanding

## Advanced Usage

### Integrating Otter.ai Transcripts

To use Otter.ai transcripts in your issues:

1. **Set up Zapier MCP integration** for Otter.ai
2. **Use the --otter-meeting flag** with your meeting ID 

### Creating Customer Requests

The tool can automatically create customer requests linked to issues:

```bash
./generate-linear-issue.sh \
  --title "API rate limiting" \
  --team-id "abc123" \
  --customer "Enterprise Co" \
  --slack-thread "support-channel" \
  --create
```

Features:
- **Smart Customer Matching**: Searches for existing customers before creating new ones
- **Interactive Confirmation**: Prompts you to confirm customer selection
- **Automatic Linking**: Creates customer request linked to the generated issue
- **Clickable Links**: Provides direct links to both issue and customer in Linear

### Working with Slack Threads

The tool supports both Slack thread URLs and channel names:

```bash
# Using a thread URL (recommended)
./generate-linear-issue.sh \
  --slack-thread "https://workspace.slack.com/archives/C123ABC/p1234567890123456"

# Using just a channel name
./generate-linear-issue.sh \
  --slack-thread "engineering-team"
```

### Verbose Mode

Use `-v` or `--verbose` to see Claude's real-time processing:

```bash
./generate-linear-issue.sh --title "Performance optimization" \
  --team-id "abc123" --verbose
```

This shows:
- MCP server calls being made
- Data being fetched from each source
- Claude's analysis process
- Issue generation progress

### Batch Processing

Generate multiple issues from a planning discussion:

```bash
# First, identify all issues discussed
claude "Review the Slack thread at [URL] and list all potential issues discussed"

# Then generate individual issues
for title in "Issue 1" "Issue 2" "Issue 3"; do
  ./generate-linear-issue.sh --title "$title" \
    --team-id "abc123" --slack-thread "[URL]" --appetite "small-batch"
done
```

## Output Management

Linear issues are saved in `./linear-issues/` with naming convention:
- `linear-issue-YYYY-MM-DD-feature-name.md`

### Integration with Linear

The generated markdown files can be:
1. Automatically created in Linear using the `--create` flag
2. Manually copied into Linear's issue creation interface
3. Used as templates for further refinement

```bash
# View generated issue
cat linear-issues/linear-issue-*.md

# Create directly in Linear
./generate-linear-issue.sh --title "Your issue" --team-id "abc123" --create
```

## Troubleshooting

### MCP Server Issues

```bash
# Check MCP server status
claude mcp list

# Test individual servers
claude "Test Slack connection by listing channels"
claude "Test Linear connection by listing teams"
```

### Authentication Problems

1. **Slack**: Check bot token permissions and team access
2. **Linear**: Ensure API key has proper permissions
3. **Notion**: Verify integration access to pages
4. **Environment**: Ensure all variables are set in `.env`

### Permission Issues

Update Claude permissions in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(claude mcp:*)",
      "Bash(npm install:*)",
      "WebFetch(domain:docs.anthropic.com)"
    ]
  }
}
```

## Best Practices

### 1. Data Source Selection
- Include 2-3 diverse sources for comprehensive context
- Combine discussion sources (Slack) with documentation (Notion)
- Always include relevant code analysis for technical features

### 2. Feature Request Quality
- Use descriptive, action-oriented titles
- Provide clear business justification
- Include measurable success criteria
- Specify technical dependencies and risks

### 3. Workflow Integration
- Generate issues immediately after Slack discussions
- Link to existing Linear issues for context
- Use Shape Up format for clear problem/solution framing
- Create issues directly in Linear with `--create` flag

## Contributing

To extend this system:

1. **Add MCP Servers**: Integrate additional data sources
2. **Enhance Format**: Customize the Shape Up format for your team
3. **Custom Workflows**: Build domain-specific generation scripts
4. **Add Integrations**: Connect to other project management tools

## License

MIT License - feel free to adapt for your organization's needs.
