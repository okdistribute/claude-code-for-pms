const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const { LinearClient } = require('@linear/sdk');
require('dotenv').config();

// Initialize Slack app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Linear
const linear = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
});

// Listen for shortcut trigger
app.shortcut('create_feature_request', async ({ shortcut, ack, client, logger }) => {
  try {
    await ack();

    // Debug the shortcut structure
    console.log('Shortcut type:', shortcut.type);
    console.log('Shortcut callback_id:', shortcut.callback_id);
    
    // For message shortcuts, extract channel and message info
    let channel, message_ts;
    
    if (shortcut.message) {
      // Message shortcut
      message_ts = shortcut.message.ts;
      channel = shortcut.channel.id;
    } else if (shortcut.message_ts && shortcut.channel) {
      // Alternative structure
      message_ts = shortcut.message_ts;
      channel = shortcut.channel;
    } else {
      console.error('Unable to extract channel and message info from shortcut:', shortcut);
      throw new Error('Invalid shortcut payload');
    }
    
    console.log('Channel ID:', channel);
    console.log('Message TS:', message_ts);
    
    // Open a modal immediately
    const result = await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'feature_request_modal',
        title: {
          type: 'plain_text',
          text: 'Create Feature Request',
        },
        submit: {
          type: 'plain_text',
          text: 'Create',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        private_metadata: JSON.stringify({ message_ts, channel }),
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'I\'ll analyze the thread and create a Linear feature request. You can customize the details below.',
            },
          },
          {
            type: 'input',
            block_id: 'title_block',
            label: {
              type: 'plain_text',
              text: 'Title (will be auto-generated)',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'title_input',
              placeholder: {
                type: 'plain_text',
                text: 'Analyzing thread...',
              },
            },
            optional: true,
          },
          {
            type: 'input',
            block_id: 'team_block',
            label: {
              type: 'plain_text',
              text: 'Linear Team',
            },
            element: {
              type: 'static_select',
              action_id: 'team_select',
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: 'Feature Requests (FEAT)',
                },
                value: process.env.LINEAR_TEAM_ID,
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'Feature Requests (FEAT)',
                  },
                  value: process.env.LINEAR_TEAM_ID,
                },
              ],
            },
          },
        ],
      },
    });

    // Fetch and analyze the thread in the background
    analyzeThreadAndUpdateModal(client, channel, message_ts, result.view.id);

  } catch (error) {
    logger.error(error);
  }
});

// Handle modal submission
app.view('feature_request_modal', async ({ ack, body, view, client, logger }) => {
  try {
    await ack();

    const metadata = JSON.parse(view.private_metadata);
    const title = view.state.values.title_block.title_input.value;
    const teamId = view.state.values.team_block.team_select.selected_option.value;
    
    // Get the stored analysis from the modal's private metadata
    const analysis = metadata.analysis || {};

    // Create Linear issue
    const issue = await linear.createIssue({
      teamId: teamId,
      title: title || analysis.title || 'Feature Request from Slack',
      description: analysis.description || 'No description provided',
    });

    // Post confirmation message
    await client.chat.postMessage({
      channel: metadata.channel,
      thread_ts: metadata.message_ts,
      text: `✅ Feature request created: ${issue.issue.identifier} - ${issue.issue.title}\n${issue.issue.url}`,
    });

  } catch (error) {
    logger.error(error);
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: `Error creating feature request: ${error.message}`,
    });
  }
});

async function analyzeThreadAndUpdateModal(client, channel, message_ts, view_id) {
  try {
    // Fetch the thread
    let thread;
    try {
      thread = await client.conversations.replies({
        channel: channel,
        ts: message_ts,
        limit: 100,
      });
    } catch (error) {
      console.error('Error fetching thread:', error);
      
      // Update modal with error message
      await client.views.update({
        view_id: view_id,
        view: {
          type: 'modal',
          callback_id: 'feature_request_modal',
          title: {
            type: 'plain_text',
            text: 'Error',
          },
          close: {
            type: 'plain_text',
            text: 'Close',
          },
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `⚠️ Unable to access the channel or message.\n\nPlease ensure:\n• The bot is added to the channel\n• You're using the shortcut on a message (not in the compose box)`,
              },
            },
          ],
        },
      });
      return;
    }

    // Format thread for Claude
    const threadText = thread.messages.map(msg => {
      const user = msg.user || 'Unknown';
      const time = new Date(parseFloat(msg.ts) * 1000).toISOString();
      return `[${time}] ${user}: ${msg.text}`;
    }).join('\n\n');

    // Analyze with Claude
    const analysis = await analyzeThread(threadText);

    // Update the modal with the analysis
    await client.views.update({
      view_id: view_id,
      view: {
        type: 'modal',
        callback_id: 'feature_request_modal',
        title: {
          type: 'plain_text',
          text: 'Create Feature Request',
        },
        submit: {
          type: 'plain_text',
          text: 'Create',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        private_metadata: JSON.stringify({ 
          message_ts, 
          channel,
          analysis 
        }),
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ Thread analyzed! Review and edit the details below:',
            },
          },
          {
            type: 'input',
            block_id: 'title_block',
            label: {
              type: 'plain_text',
              text: 'Title',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'title_input',
              initial_value: analysis.title,
            },
          },
          {
            type: 'input',
            block_id: 'team_block',
            label: {
              type: 'plain_text',
              text: 'Linear Team',
            },
            element: {
              type: 'static_select',
              action_id: 'team_select',
              initial_option: {
                text: {
                  type: 'plain_text',
                  text: 'Feature Requests (FEAT)',
                },
                value: process.env.LINEAR_TEAM_ID,
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'Feature Requests (FEAT)',
                  },
                  value: process.env.LINEAR_TEAM_ID,
                },
              ],
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Preview:*\n${analysis.preview}`,
            },
          },
        ],
      },
    });

  } catch (error) {
    console.error('Error analyzing thread:', error);
  }
}

async function analyzeThread(threadText) {
  const prompt = `Analyze this Slack thread and create a feature request for Linear.

Thread:
${threadText}

I'm going to give you a slack thread. Please make feature request tickets based
on the following slack thread. There could be more than one feature request
mentioned on this slack thread. Try to parse out if this issue is tied to a
particular customer and what that customer's name is. Additionally, add a label
for 'customer priority': one of: 
- Nice to have, 
- Must have soon, or 
- Must have now (Blocker) 

Once you've created the ticket(s), then look to see if there are any existing
issues in linear on any team that look like they would be related to this
ticket. List those links in a bulleted list in the text body of the feature
request. reate a feature request with this format:

## Problem Statement
What problem is the customer trying to solve? Detail everything you can learn about the use case.

## Justification
Why is it important to a customer? Is it blocking a rollout? Is it just annoying ergonomics?

## Suggested Solution
If there's a clear thing that needs to be done, add it, otherwise leave this blank.

Return a JSON object with:
- title: A concise title for the Linear issue
- description: The full feature request in markdown
- preview: A 2-3 sentence summary for the Slack modal`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt,
    }],
  });

  try {
    // Extract JSON from Claude's response
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Error parsing Claude response:', e);
  }

  // Fallback
  return {
    title: 'Feature Request from Slack',
    description: response.content[0].text,
    preview: 'Feature request created from Slack thread',
  };
}

// Start the app
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack Linear bot is running!');
})();