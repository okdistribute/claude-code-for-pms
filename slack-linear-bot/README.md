# Slack Linear Feature Request Bot

This bot converts Slack threads into Linear feature requests using Claude AI to analyze and format the content.

## Features

- Right-click any Slack message and select "Create Feature Request" 
- Automatically analyzes the thread using Claude
- Formats the content according to your feature request template
- Creates the issue in Linear with proper formatting
- Links the Slack thread to the Linear issue for bidirectional comment syncing
- Posts confirmation back to the Slack thread

## Setup Instructions

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From an app manifest"
3. Select your workspace
4. Paste the contents of `manifest.json`
5. Review and create the app

### 2. Configure Slack App

1. Go to "Basic Information" and install the app to your workspace
2. Go to "OAuth & Permissions" and copy the Bot User OAuth Token
3. Go to "Basic Information" → "App Credentials" and copy the Signing Secret
4. Go to "Basic Information" → "App-Level Tokens" and create a token with `connections:write` scope

### 3. Get API Keys

1. **Claude API**: Get your API key from [console.anthropic.com](https://console.anthropic.com)
2. **Linear API**: 
   - Go to Linear → Settings → API → Personal API keys
   - Create a new key with "Write" access

### 4. Configure the Bot

1. Copy `.env.example` to `.env`
2. Fill in all the values:
   ```
   SLACK_BOT_TOKEN=xoxb-your-token
   SLACK_SIGNING_SECRET=your-signing-secret  
   SLACK_APP_TOKEN=xapp-your-app-token
   ANTHROPIC_API_KEY=your-anthropic-api-key
   LINEAR_API_KEY=your-linear-api-key
   LINEAR_TEAM_ID=your-feat-team-id
   ```

### 5. Install and Run

```bash
npm install
npm start
```

## Usage

1. Find any Slack thread you want to convert
2. Right-click on any message in the thread
3. Select "More message shortcuts..." → "Create Feature Request"
4. Review the generated title and preview
5. Click "Create" to create the Linear issue

The bot will automatically link the Slack thread to the created Linear issue. This enables:
- Comments added to the Slack thread will sync to the Linear issue
- Comments added to the Linear issue will sync back to the Slack thread
- Status updates (completed/cancelled) will notify the Slack thread

## Customization

### Adding More Teams

Edit `index.js` and add more options to the team selector:

```javascript
options: [
  {
    text: { type: 'plain_text', text: 'Feature Requests (FEAT)' },
    value: 'feat-team-id',
  },
  {
    text: { type: 'plain_text', text: 'SDK Team' },
    value: 'sdk-team-id',
  },
]
```

### Modifying the Template

Edit the prompt in the `analyzeThread` function to change how feature requests are formatted.

### Adding Labels

To automatically add labels based on content:

```javascript
const issue = await linear.createIssue({
  teamId: teamId,
  title: title,
  description: description,
  labelIds: ['label-id-1', 'label-id-2'], // Add label IDs
});
```

## Deployment

For production deployment:

1. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start index.js --name linear-bot
   pm2 save
   pm2 startup
   ```

2. Or deploy to a platform like Heroku, Railway, or Render

## Troubleshooting

- **Bot not responding**: Check that socket mode is enabled and the app-level token is correct
- **Can't see shortcut**: Make sure the app is installed to your workspace
- **API errors**: Verify all API keys are correct and have proper permissions
