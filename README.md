# Claude Code for PMs

Aggregate data from multiple sources using Claude Code and Model Context
Protocol (MCP) servers.

## 🚀 Getting Started

---

## Overview

This system sets up your Claude environment for optimal use as a PM.

Sets up servers for pulling in external sources:
- **Slack** threads and channel discussions  
- **Linear** existing issues for context
- **Notion** documentation pages
- **Local code files** for technical analysis
- **Meeting Transcripts** for detailed context


### 1. Setup MCP servers

Follow the 📚 **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**

Make sure everything is working:

```bash
./scripts/test-mcp-connections.sh
```

You should see green checkmarks for all services.

### 2. Create feature request

A feature request can come from a slack thread, where colleagues from many
sides of the organization will chime in on implementation details or
requirements to further understand the problem asynchronously. 

This information is difficult to process and we want to standardize this
information in a form so that feature requests can be organized in linear.

To make it easier to translate a slack thread into a feature request format, there is a command tool you can add to your claude setup. 

Copy `commands/feature-request.md` to `~/.claude/commands/feature-request.md`

To use it, simply type:
```
/feature-request https://dittolive.slack.com/archives/C068TSL9668/p1751888194097889
```



### 2. Generate shape up pitch

Once you've received one or more feature requests, reviewed them and tied them
to customers, you then can move into the planning stage to get this work
scheduled with engineering. In this stage, you'll need to write a shape-up
pitch based on the feature request. This tool helps you create a first draft
given as much context as possible.

You should provide as much detail, including relevant files or folders in the
codebase so that the AI Agent can grab build engineering context for the pitch
itself.

You should always review, edit, and check the output for correctness. This is
just intended as a first draft of your pitch, and you are ultimately
responsible for the content so please do read it before sending it to the
betting table.

```bash
./generate-pitch.sh --interactive
```

If you prefer to specify everything upfront:

```bash
# Create issue with customer request
./generate-pitch.sh \
  --title "Composite Indexes" \
  --team-id "QE" \
  --customer "Acme Corp" \
  --linear-issue FEAT-7 \
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
