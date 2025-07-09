# Quick Start Guide (5 Minutes)

This guide is for users who already have their API keys and want to get up and running quickly.

**Don't have API keys yet?** See [API_KEYS_GUIDE.md](./API_KEYS_GUIDE.md) first.

## Prerequisites

- [ ] Claude Code installed
- [ ] Slack bot token (xoxb-...)
- [ ] Slack team ID (T...)
- [ ] Linear API key (lin_api_...)
- [ ] Notion token (secret_...)

## Step 1: Clone and Setup (2 minutes)

```bash
# Clone the repository
cd ~/Desktop
git clone https://github.com/your-company/feature-request-mcp.git
cd feature-request-mcp

# Make scripts executable
chmod +x *.sh

# Copy environment template
cp .env.example .env
```

## Step 2: Add Your API Keys (1 minute)

Edit the `.env` file:

```bash
open -e .env
```

Replace the placeholders with your actual keys:
```
SLACK_BOT_TOKEN=xoxb-your-actual-token
SLACK_TEAM_ID=T1234ABCD
LINEAR_API_KEY=lin_api_your-actual-key
NOTION_TOKEN=secret_your-actual-token
```

Save and close the file.

## Step 3: Run Setup (1 minute)

```bash
./setup-mcp-servers.sh
```

When prompted, choose "use" to use existing keys from your .env file.

## Step 4: Verify (1 minute)

```bash
./test-mcp-connections.sh
```

You should see:
- ✅ Slack connection successful
- ✅ Linear connection successful
- ✅ Notion connection successful

## Step 5: Create Your First Issue

### Option A: Interactive Mode
```bash
./generate-pitch.sh --interactive
```

### Option B: Direct Command
```bash
./generate-pitch.sh \
  --title "My First Feature Request" \
  --team-id "your-linear-team-id" \
  --appetite "small-batch"
```

## Common Commands

### Generate from Slack Thread
```bash
./generate-pitch.sh \
  --title "Feature from Slack discussion" \
  --team-id "abc123" \
  --slack-thread "https://workspace.slack.com/archives/C123/p1234567890123456" \
  --create
```

### Generate with Notion Context
```bash
./generate-pitch.sh \
  --title "Feature with specs" \
  --team-id "abc123" \
  --notion-page "page-id-from-notion-url" \
  --appetite "big-batch" \
  --create
```

### Generate for Customer
```bash
./generate-pitch.sh \
  --title "Customer request" \
  --team-id "abc123" \
  --customer "Acme Corp" \
  --create
```

## Keyboard Shortcuts

When using `--interactive` mode:
- `Enter` - Accept default value
- `Ctrl+C` - Cancel at any time

## Tips for Product Managers

1. **Start with Interactive Mode**: It guides you through all options
2. **Save Common Commands**: Keep frequently used commands in a text file
3. **Use Descriptive Titles**: They become your Linear issue titles
4. **Small vs Big Batch**:
   - Small batch = 1-2 person weeks
   - Big batch = 6+ person weeks

## Troubleshooting Quick Fixes

**Can't find team ID?**
```bash
# This will list all your Linear teams
claude "List my Linear teams with their IDs"
```

**Slack bot can't see channel?**
```bash
# In Slack, invite your bot to the channel:
/invite @YourBotName
```

**Something not working?**
```bash
./troubleshoot-mcp.sh
```

## Next Steps

- Read the full [README.md](./README.md) for advanced features
- Check [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed explanations
- Join #product-tools in Slack for tips and support

---

**Pro Tip**: Bookmark this page and the interactive command for quick access:
```bash
./generate-pitch.sh --interactive
```