# Complete Setup Guide for Product Managers

Welcome! This guide will walk you through setting up Claude Code with MCP (Model Context Protocol) servers to automatically generate Linear issues from various data sources. No technical experience required!

## Table of Contents
1. [What You'll Be Able to Do](#what-youll-be-able-to-do)
2. [Prerequisites](#prerequisites)
3. [Step 1: Install Claude Code](#step-1-install-claude-code)
4. [Step 2: Get Your API Keys](#step-2-get-your-api-keys)
5. [Step 3: Run the Setup Script](#step-3-run-the-setup-script)
6. [Step 4: Verify Everything Works](#step-4-verify-everything-works)
7. [Step 5: Your First Feature Request](#step-5-your-first-feature-request)
8. [Troubleshooting](#troubleshooting)
9. [Getting Help](#getting-help)

## What You'll Be Able to Do

After completing this setup, you'll be able to:
- Generate Linear issues in Shape Up format from Slack conversations
- Pull in context from Notion documentation
- Reference existing Linear issues
- Create comprehensive feature requests in minutes instead of hours

## Prerequisites

Before starting, make sure you have:
- [ ] A Mac computer (Intel or Apple Silicon)
- [ ] Admin access to your computer (ability to install software)
- [ ] Access to your company's Slack workspace
- [ ] Access to your company's Linear workspace
- [ ] Access to your company's Notion workspace
- [ ] About 30 minutes for the initial setup

## Step 1: Install Claude Code

Claude Code is the command-line interface for Claude that allows you to use MCP servers.

1. **Check if you have Claude Code installed:**
   - Open Terminal (find it in Applications > Utilities > Terminal)
   - Type `claude --version` and press Enter
   - If you see a version number, skip to Step 2
   - If you see "command not found", continue below

2. **Install Claude Code:**
   - Visit https://claude.ai/download
   - Download Claude for macOS
   - Open the downloaded file and drag Claude to your Applications folder
   - Open Claude from your Applications folder
   - Sign in with your Anthropic account (or create one)
   - Claude Code comes bundled with the desktop app

3. **Enable Claude Code:**
   - In the Claude desktop app, go to Settings
   - Look for "Developer" or "Advanced" section
   - Enable "Claude Code" or "CLI Access"
   - Restart Terminal

4. **Verify installation:**
   - In Terminal, type `claude --version` and press Enter
   - You should now see a version number

## Step 2: Get Your API Keys

You'll need API keys for each service. Follow the detailed instructions in [API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md) for each service:

### Quick Overview:
- **Slack**: You'll create a personal bot (takes ~15 minutes)
- **Linear**: Your admin can provide this or you can generate your own
- **Notion**: Your admin can provide this or you can create an integration

**Important**: Keep these keys secure! Never share them or commit them to git.

## Step 3: Run the Setup Script

1. **Download this repository:**
   - Open Terminal
   - Copy and paste this command:
   ```bash
   cd ~/Desktop && git clone https://github.com/your-company/feature-request-mcp.git && cd feature-request-mcp
   ```
   - Press Enter

2. **Make the setup script executable:**
   ```bash
   chmod +x setup-mcp-servers.sh
   ```

3. **Run the setup script:**
   ```bash
   ./setup-mcp-servers.sh
   ```

4. **Follow the prompts:**
   - The script will ask for your API keys
   - It will validate each key before proceeding
   - It will automatically configure all MCP servers
   - It will create test connections to verify everything works

## Step 4: Verify Everything Works

Run the test script to make sure all connections are working:

```bash
./test-mcp-connections.sh
```

You should see green checkmarks for:
- ✅ Slack connection successful
- ✅ Linear connection successful  
- ✅ Notion connection successful
- ✅ All systems ready!

If you see any red X marks, see the [Troubleshooting](#troubleshooting) section.

## Step 5: Your First Feature Request

Let's create your first feature request to make sure everything works!

1. **Interactive mode (recommended for first time):**
   ```bash
   ./generate-pitch.sh --interactive
   ```

2. **Follow the prompts:**
   - Enter a title for your feature request
   - Provide your Linear team ID (you can find this in Linear settings)
   - Choose small-batch (1-2 weeks) or big-batch (4-6 weeks)
   - Add any Slack threads, Notion pages, or other context

3. **Review the generated issue:**
   - The script will show you a preview
   - You can choose to create it in Linear or save it as a file

## Troubleshooting

### Common Issues and Solutions

**"Permission denied" when running scripts:**
```bash
chmod +x *.sh
```

**"Command not found: claude":**
- Make sure you've installed the Claude desktop app
- Restart Terminal after installation
- Try `/Applications/Claude.app/Contents/MacOS/claude --version`

**"Invalid API key" errors:**
- Double-check your API keys in the `.env` file
- Make sure there are no extra spaces or quotes
- Regenerate the key if needed

**Slack bot can't see channels:**
- Make sure your bot is invited to the channels
- Check that your bot has the correct OAuth scopes

**Can't find Linear team ID:**
- Go to Linear > Settings > Teams
- Click on your team
- The ID is in the URL: `linear.app/your-company/team/TEAM-ID-HERE`

### Running the Troubleshooting Script

If you're still having issues:

```bash
./troubleshoot-mcp.sh
```

This will:
- Check all prerequisites
- Validate API keys
- Test connections
- Provide specific error messages and solutions

## Getting Help

### Internal Resources
- Slack: #product-tools channel
- Notion: Search for "MCP Setup Help"
- Linear: Tag issues with `mcp-setup-help`

### Reset Everything
If you need to start over:
```bash
./reset-mcp-setup.sh
```
This will remove all MCP configurations and let you start fresh.

## Next Steps

Now that you're set up:
1. Read the [README.md](./README.md) for detailed usage examples
2. Check out [QUICK_START.md](./QUICK_START.md) for common workflows
3. Join #claude-code-productivity in Slack to share tips and get help

Congratulations! You're now ready to create comprehensive feature requests in minutes! 🎉