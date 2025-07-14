# API Keys Setup Guide

This guide provides step-by-step instructions for obtaining API keys for Slack, Linear, and Notion. Each section includes screenshots placeholders and exact steps to follow.

## Table of Contents
1. [Slack Bot Token Setup](#slack-bot-token-setup) (~15 minutes)
2. [Linear API Key](#linear-api-key) (~2 minutes)
3. [Notion Integration](#notion-integration) (~5 minutes)
4. [Storing Your Keys Safely](#storing-your-keys-safely)

---

## Slack Bot Token Setup

**Time Required:** ~15 minutes  
**What You'll Get:** A bot token that looks like `xoxb...`

### Step 1: Create a New Slack App

1. **Go to Slack API Website**
   - Open https://api.slack.com/apps in your browser
   - Click the green **"Create New App"** button

2. **Choose Creation Method**
   - Select **"From scratch"** (not from manifest)

3. **Name Your App**
   - App Name: `[YourName] MCP Bot` (e.g., "Sarah MCP Bot")
   - Pick workspace: Select your company's workspace
   - Click **"Create App"**

### Step 2: Configure OAuth & Permissions

1. **Navigate to OAuth Settings**
   - In the left sidebar, click **"OAuth & Permissions"**

2. **Add Bot Token Scopes**
   - Scroll down to **"Scopes"** section
   - Under **"Bot Token Scopes"**, click **"Add an OAuth Scope"**
   - Add these scopes ONE BY ONE:
     - `channels:history` - Read message history
     - `channels:read` - View basic channel info
     - `chat:write` - Send messages
     - `groups:history` - Read private channel history
     - `groups:read` - View private channel info
     - `im:history` - Read direct messages
     - `im:read` - View direct message info
     - `mpim:history` - Read group DM history
     - `mpim:read` - View group DM info
     - `users:read` - View user info
   

### Step 3: Install App to Workspace

1. **Install Your App**
   - Scroll to the top of the OAuth page
   - Click **"Install to Workspace"**

2. **Authorize the App**
   - Review the permissions
   - Click **"Allow"**
   - You'll be redirected back to the app settings

3. **Copy Your Bot Token**
   - You'll now see a **"Bot User OAuth Token"**
   - It starts with `xoxb-`
   - Click **"Copy"** button
   - **SAVE THIS TOKEN** - you'll need it later!

### Step 4: Get Your Team ID

1. **Open Slack in Browser**
   - Go to https://app.slack.com
   - Make sure you're in the right workspace

2. **Find Team ID**
   - Click your workspace name (top-left)
   - Select **"Settings & administration"**
   - Click **"Workspace settings"**
   - The URL will change to something like:
     `https://[workspace].slack.com/admin/settings#workspace`
   - Look for **"Workspace ID"** on the page
   - It looks like: `T1234ABCD`
   - Copy this ID

### Step 5: Invite Bot to Channels

**Important:** Your bot can only see channels it's been invited to!

1. **In Slack App**
   - Go to any channel you want to analyze
   - Type `/add `
   - Press Enter under "Add apps to channel"
   - Search for your bot name
   - Repeat for all relevant channels

---

## Linear API Key

**Time Required:** ~2 minutes  
**What You'll Get:** A key that looks like `lin_api_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890`

### Option A: Get Your Personal API Key

1. **Go to Linear Settings**
   - Open Linear in your browser
   - Click the organization name in the top left
   - Select **"Settings"**

2. **Navigate to API**
   - In settings, click **"API"** in the left sidebar

3. **Create Personal Key**
   - Click **"Create key"**
   - Label: `MCP Integration`
   - Click **"Create key"**
   - **COPY THE KEY IMMEDIATELY** - you won't see it again!

### Option B: Ask Your Admin

If your organization manages API keys centrally:
1. Message your Linear admin
2. Request an API key for "MCP Feature Request Tool"
3. They should provide a key with read/write access to issues

---

## Notion Integration

**Time Required:** ~5 minutes  
**What You'll Get:** A token that looks like `secret_aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890`

### Step 1: Create Integration

1. **Go to Notion Integrations**
   - Open https://www.notion.so/my-integrations
   - Sign in if needed
   - Click **"+ New integration"**

2. **Configure Integration**
   - Name: `[YourName] MCP Integration`
   - Associated workspace: Select your company workspace
   - Capabilities:
     - ✅ Read content
     - ✅ Update content
     - ✅ Insert content
   - Click **"Submit"**

3. **Copy Secret Key**
   - You'll see **"Internal Integration Token"**
   - Click **"Show"** then **"Copy"**
   - **SAVE THIS TOKEN** - it's your API key!

### Step 2: Connect Integration to Pages

**Important:** The integration can only see pages you explicitly share with it!

1. **Share Pages with Integration**
   - Go to any Notion page you want to access
   - Click **"Share"** button (top-right)
   - Click **"Invite"**
   - Search for your integration name
   - Select it and click **"Invite"**

2. **For Databases**
   - Open the database page
   - Use the same Share → Invite process
   - The integration will have access to all pages in the database

**Pro Tip:** Share a parent page to give access to all child pages!

---

## Storing Your Keys Safely

### What You Should Have Now

After completing all steps, you should have:
1. **Slack Bot Token**: `xoxb-...` (long string)
2. **Slack Team ID**: `T1234ABCD` (short ID)
3. **Linear API Key**: `lin_api_...` (long string)
4. **Notion Token**: `secret_...` (long string)

### Create Your .env File

1. **In Terminal, navigate to the project:**
   ```bash
   cd ~/Desktop/feature-request-mcp
   ```

2. **Create the .env file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit the file:**
   ```bash
   open -e .env
   ```

4. **Add your keys:**
   ```
   # Slack Configuration
   SLACK_BOT_TOKEN=xoxb-your-actual-token-here
   SLACK_TEAM_ID=T1234ABCD
   
   # Linear Configuration  
   LINEAR_API_KEY=lin_api_your-actual-key-here
   
   # Notion Configuration
   NOTION_TOKEN=secret_your-actual-token-here
   ```

5. **Save and close the file**

### Security Best Practices

**DO:**
- ✅ Keep your `.env` file local only
- ✅ Use a password manager to store copies
- ✅ Regenerate keys if you think they're compromised
- ✅ Use different keys for different environments

**DON'T:**
- ❌ Share keys in Slack/email
- ❌ Commit `.env` to git
- ❌ Use the same keys as other team members
- ❌ Leave keys in your downloads folder

---

## Verification Checklist

Before proceeding to the next step, verify you have:

- [ ] Slack bot token (starts with `xoxb-`)
- [ ] Slack team ID (like `T1234ABCD`)
- [ ] Linear API key (starts with `lin_api_`)
- [ ] Notion token (starts with `secret_`)
- [ ] Created `.env` file with all keys
- [ ] Invited Slack bot to relevant channels
- [ ] Shared Notion pages with integration

## Troubleshooting

### "Invalid Token" Errors

**Slack:**
- Make sure token starts with `xoxb-` not `xoxp-`
- Check you copied the full token (they're long!)
- Try regenerating the token

**Linear:**
- Ensure you're using the API key, not your password
- Check the key hasn't expired
- Verify you have the right permissions

**Notion:**
- Confirm the integration is connected to your workspace
- Check you've shared pages with the integration
- Make sure you copied the full token

### Can't Find Settings

**Slack:**
- You may need workspace admin to approve app creation
- Try using the desktop app instead of web

**Linear:**
- API access might be restricted by your admin
- Ask in your #linear-help channel

**Notion:**
- Integration creation might require admin approval
- Check with your Notion workspace owner

---

## Next Steps

Once you have all your API keys:
1. Return to [SETUP_GUIDE.md](./SETUP_GUIDE.md)
2. Continue with Step 3: Run the Setup Script
3. The script will validate all your keys automatically

Need help? Ask in #product-tools on Slack!
