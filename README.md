# Claude Code for PMs

Aggregate data from multiple sources using Claude Code and Model Context
Protocol (MCP) servers.

## 🚀 Getting Started

**New to Claude or MCP?** No problem! We've created a complete setup guide just for you:

### 📚 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**

This guide will walk you through:
- Installing Claude Code (5 minutes)
- Getting your API keys (15-20 minutes) 
- Running the automated setup (5 minutes)
- Creating your first feature request

---

## Overview

This system allows you to automatically generate well-structured Linear issues following the Shape Up methodology by pulling data from:
- **Slack** threads and channel discussions  
- **Linear** existing issues for context
- **Notion** documentation pages
- **Local code files** for technical analysis
- **Meeting Transcripts** for detailed context

## Quick Start

### 1. Test Your Setup

Make sure everything is working:

```bash
./test-mcp-connections.sh
```

You should see green checkmarks for all services.

### 2. Interactive Mode (Recommended)

The easiest way to create your first issue:

```bash
./generate-pitch.sh --interactive
```

The script will prompt you for everything it needs!

### 3. Working with Slack Threads

The tool supports Slack thread URLs:

```bash
# Using a thread URL (recommended)
./generate-pitch.sh \
  --slack-thread "https://workspace.slack.com/archives/C123ABC/p1234567890123456"

```
### 4. Command Line Mode

If you prefer to specify everything upfront:

```bash
# Create issue with customer request
./generate-pitch.sh \
  --title "Composite Indexes" \
  --team-id "QE" \
  --customer "Acme Corp" \
  --slack-thread "https://workspace.slack.com/archives/C123ABC/p1234567890123456" \
  --notion-page "https://www.notion.so/getditto/Multi-key-Small-Peer-indexes-2299d9829a3280dda0b3fecbbc210ca1?source=copy_link"
  --files "../ditto/core/query" 
```

## Output Management

Linear issues are saved in `./pitches/` with naming convention:
- `pitch-YYYY-MM-DD-feature-name.md`

### Integration with Linear

The generated markdown files can be:
1. Automatically created in Linear using the `--create` flag
2. Manually copied into Linear's issue creation interface
3. Used as templates for further refinement

```bash
# View generated issue
cat pitches/pitch-*.md

# Create directly in Linear
./generate-pitch.sh --title "Your issue" --team-id "abc123" --create
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


### Verbose Mode

Use `-v` or `--verbose` to see Claude's real-time processing:

```bash
./generate-pitch.sh --title "Performance optimization" \
  --team-id "abc123" --verbose
```

This shows:
- MCP server calls being made
- Data being fetched from each source
- Claude's analysis process
- Issue generation progress



## Troubleshooting

### 🛠️ Automated Troubleshooting

We've created scripts to help diagnose and fix issues:

```bash
# Run the troubleshooting assistant
./troubleshoot-mcp.sh

# Test all connections
./test-mcp-connections.sh

# Start fresh if needed
./reset-mcp-setup.sh
```

### Common Issues & Quick Fixes

**"Command not found" errors:**
- Make sure you're in the right directory: `cd ~/Desktop/feature-request-mcp`
- Make scripts executable: `chmod +x *.sh`

**"Invalid API key" errors:**
- Check your `.env` file has no extra spaces or quotes
- Make sure tokens have the right format:
  - Slack: starts with `xoxb-`
  - Linear: starts with `lin_api_`
  - Notion: starts with `secret_`

**Slack bot can't see channels:**
- Your bot needs to be invited! In Slack, type: `/invite @YourBotName`

**Can't find Linear team ID:**
- Go to Linear → Settings → Teams → Click your team
- The ID is in the URL: `linear.app/company/team/TEAM-ID-HERE`

### Getting Help

- 📖 Check our guides: [SETUP_GUIDE.md](./SETUP_GUIDE.md) and [API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md)
- 💬 Ask in #product-tools on Slack
- 🐛 File an issue in this repository

## Best Practices

### 1. Data Source Selection
- Include 2-3 diverse sources for comprehensive context
- Combine discussion sources (Slack) with documentation (Notion), meeting notes and transcripts (Files)
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
2. **Enhance Format**: Customize the output format for your team
3. **Custom Workflows**: Build domain-specific generation scripts
4. **Add Integrations**: Connect to other project management tools

## License

MIT License - feel free to adapt for your organization's needs.
