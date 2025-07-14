const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const { LinearClient } = require('@linear/sdk');
const axios = require('axios');
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

// Cache for customer priority labels
let customerPriorityLabels = {};

// Function to sync Linear issue with Slack thread using GraphQL directly
async function syncLinearIssueWithSlack(issueId, slackUrl) {
  const mutation = `
    mutation AttachmentLinkSlack($issueId: String!, $url: String!) {
      attachmentLinkSlack(issueId: $issueId, url: $url, syncToCommentThread: true) {
        success
        attachment {
          id
        }
      }
    }
  `;

  try {
    const response = await axios.post('https://api.linear.app/graphql', {
      query: mutation,
      variables: {
        issueId: issueId,
        url: slackUrl
      }
    }, {
      headers: {
        'Authorization': `${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Check for GraphQL errors
    if (response.data.errors) {
      console.error('❌ Linear API errors for issue:', issueId, response.data.errors);
      return null;
    }

    if (response.data.data && response.data.data.attachmentLinkSlack) {
      return response.data.data.attachmentLinkSlack;
    }

    console.error('❌ Unexpected Linear API response for issue:', issueId);
    return null;
  } catch (error) {
    console.error('❌ Error syncing Linear issue with Slack:', issueId, error.message);
    return null;
  }
}

// Function to fetch and cache customer priority labels
async function fetchCustomerPriorityLabels() {
  try {
    console.log('Fetching customer priority labels...');
    
    // Get the team
    const team = await linear.team(process.env.LINEAR_TEAM_ID);
    
    // Get all labels for the team
    const labels = await team.labels();
    
    // Filter for customer priority labels
    const priorityLabels = labels.nodes.filter(label => 
      label.name.toLowerCase().includes('nice to have') ||
      label.name.toLowerCase().includes('must have soon') ||
      label.name.toLowerCase().includes('must have now') 
    );
    
    // Create a mapping
    priorityLabels.forEach(label => {
      if (label.name.toLowerCase().includes('nice to have')) {
        customerPriorityLabels['nice_to_have'] = label.id;
      } else if (label.name.toLowerCase().includes('must have soon')) {
        customerPriorityLabels['must_have_soon'] = label.id;
      } else if (label.name.toLowerCase().includes('must have now')) {
        customerPriorityLabels['must_have_now'] = label.id;
      }
    });
    
    console.log('Customer priority labels found:', customerPriorityLabels);
  } catch (error) {
    console.error('Error fetching customer priority labels:', error);
  }
}
// Listen for shortcut trigger
app.shortcut('create_feature_request', async ({ shortcut, ack, client, logger }) => {
  try {
    await ack();

    // Debug the shortcut structure
    console.log('Shortcut type:', shortcut.type);
    console.log('Shortcut callback_id:', shortcut.callback_id);
    
    // For message shortcuts, extract channel and message info
    let channel, message_ts, originalMessageText;
    
    if (shortcut.message) {
      // Message shortcut
      message_ts = shortcut.message.ts;
      channel = shortcut.channel.id;
      originalMessageText = shortcut.message.text || '';
    } else {
      console.error('Unable to extract channel and message info from shortcut:', shortcut);
      throw new Error('Invalid shortcut payload');
    }
    
    console.log('Channel ID:', channel);
    console.log('Message TS:', message_ts);
    console.log('Channel type:', shortcut.channel?.type);
    console.log('Is private:', shortcut.channel?.is_private);
    
    // Open a loading modal initially
    const result = await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'feature_request_loading',
        title: {
          type: 'plain_text',
          text: 'Create Feature Request',
        },
        close: {
          type: 'plain_text',
          text: 'Cancel',
        },
        private_metadata: JSON.stringify({ message_ts, channel, originalMessageText }),
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '🤖 *Analyzing thread with AI...*\n\nPlease wait while I read the conversation and generate a feature request. This usually takes 5-10 seconds.',
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '⏳ Processing...',
            },
          },
        ],
      },
    });

    // Fetch and analyze the thread in the background
    analyzeThreadAndUpdateModal(client, channel, message_ts, result.view.id, shortcut.user.id, originalMessageText);

  } catch (error) {
    logger.error(error);
  }
});

// Listen for global shortcut - manual feature request creation
app.shortcut('manual_feature_request', async ({ shortcut, ack, client, logger }) => {
  try {
    await ack();

    console.log('Manual feature request shortcut triggered');
    
    // Open modal for manual feature request entry
    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'manual_feature_request_modal',
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
          channel: shortcut.channel?.id || 'unknown',
          user: shortcut.user.id 
        }),
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '📝 *Manual Feature Request*\n\nFill out the form below to create a feature request:',
            },
          },
          {
            type: 'input',
            block_id: 'title_block',
            label: {
              type: 'plain_text',
              text: 'Title *',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'title_input',
              placeholder: {
                type: 'plain_text',
                text: 'Enter a clear, concise title for the feature request',
              },
            },
          },
          {
            type: 'input',
            block_id: 'description_block',
            label: {
              type: 'plain_text',
              text: 'Description *',
            },
            element: {
              type: 'plain_text_input',
              action_id: 'description_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: 'Describe the problem, justification, and suggested solution...',
              },
            },
          },
          {
            type: 'input',
            block_id: 'customer_block',
            label: {
              type: 'plain_text',
              text: 'Customer Name',
            },
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'customer_input',
              placeholder: {
                type: 'plain_text',
                text: 'Enter customer name (optional)',
              },
            },
          },
          {
            type: 'input',
            block_id: 'priority_block',
            label: {
              type: 'plain_text',
              text: 'Customer Priority',
            },
            optional: true,
            element: {
              type: 'static_select',
              action_id: 'priority_select',
              placeholder: {
                type: 'plain_text',
                text: 'Select priority level',
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: 'Nice to have',
                  },
                  value: 'nice_to_have',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Must have soon',
                  },
                  value: 'must_have_soon',
                },
                {
                  text: {
                    type: 'plain_text',
                    text: 'Must have now (Blocker)',
                  },
                  value: 'must_have_now',
                },
              ],
            },
          },

        ],
      },
    });

  } catch (error) {
    logger.error(error);
  }
});

// Handle modal submission
app.view('feature_request_modal', async ({ ack, body, client, logger }) => {
  try {
    await ack();

    const metadata = JSON.parse(body.view.private_metadata);
    const title = body.view.state.values.title_block.title_input.value;
    const teamId = process.env.LINEAR_TEAM_ID; // Always use FEAT team
    
    // Get the stored analysis from the modal's private metadata
    const analysis = metadata.analysis || {};
    
    // Check if there's a manual description input (for fallback cases)
    const manualDescription = body.view.state.values.description_block?.description_input?.value;
    
    // Validate that we have meaningful content
    const finalTitle = title || analysis.title;
    const finalDescription = manualDescription || analysis.description;
    
    if (!finalTitle || finalTitle === 'Feature Request from Slack' || !finalDescription || finalDescription === 'No description provided') {
      await client.chat.postEphemeral({
        channel: metadata.channel,
        user: body.user.id,
        text: '❌ Cannot create issue: Missing title or description. Please try again when the AI service is available.',
      });
      return;
    }

    // Prepare issue data
    const issueData = {
      teamId: teamId,
      title: finalTitle,
      description: finalDescription,
    };
    
    // Add customer priority label if available
    if (analysis.customerPriority && customerPriorityLabels[analysis.customerPriority]) {
      issueData.labelIds = [customerPriorityLabels[analysis.customerPriority]];
      console.log(`Adding customer priority label: ${analysis.customerPriority} (${customerPriorityLabels[analysis.customerPriority]})`);
    }

    // Create Linear issue
    const issueResult = await linear.createIssue(issueData);
    
    // The Linear SDK returns an IssuePayload, we need to get the actual issue
    const issue = await issueResult.issue;
    
    console.log('Linear issue created:', {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url
    });
    
    // Link customer to the issue if customer name was extracted
    if (analysis.customerName) {
      console.log(`Attempting to link customer: ${analysis.customerName}`);
      const customerLinkResult = await linkCustomerToIssue(issue.id, analysis.customerName, metadata.originalMessageText);
      
      if (customerLinkResult && customerLinkResult.success) {
        console.log(`✅ Successfully linked customer ${customerLinkResult.customer.name} to issue`);
      } else {
        console.log('⚠️ Failed to link customer to issue');
      }
    }
    
    // Get the Slack message permalink
    let permalinkResult = null;
    try {
      permalinkResult = await client.chat.getPermalink({
        channel: metadata.channel,
        message_ts: metadata.message_ts,
      });
      
      console.log('Slack permalink:', permalinkResult.permalink);
      
      // Link the Slack thread to the Linear issue using GraphQL directly
      if (issue && permalinkResult.permalink) {
        const syncResult = await syncLinearIssueWithSlack(issue.id, permalinkResult.permalink);
        
        if (syncResult && syncResult.success) {
          console.log('✅ Successfully linked Slack thread to Linear issue:', {
            issueId: issue.id,
            attachmentId: syncResult.attachment?.id
          });
        } else {
          console.log('⚠️ Failed to sync Slack thread with Linear issue');
        }
      }
    } catch (linkError) {
      console.error('Error linking Slack thread to Linear issue:', linkError);
      // Continue anyway - the issue was created successfully
    }
    
  } catch (error) {
    logger.error(error);
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: `Error creating feature request: ${error.message}`,
    });
  }
});

// Handle manual feature request modal submission
app.view('manual_feature_request_modal', async ({ ack, body, client, logger }) => {
  try {
    await ack();

    const values = body.view.state.values;
    const metadata = JSON.parse(body.view.private_metadata);
    
    const title = values.title_block.title_input.value;
    const description = values.description_block.description_input.value;
    const customerName = values.customer_block.customer_input.value || null;
    const priority = values.priority_block.priority_select.selected_option?.value || null;
    const teamId = process.env.LINEAR_TEAM_ID; // Always use FEAT team

    console.log('Manual feature request submission:', { title, description, customerName, priority, teamId });

    // Create Linear issue directly (no Claude analysis needed)
    const issueDescription = `**Manually submitted feature request**

${description}

---
*Submitted by: <@${metadata.user}>*
*Channel: <#${metadata.channel}>*`;

    const createIssueResponse = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                url
              }
            }
          }
        `,
        variables: {
          input: {
            title: title,
            description: issueDescription,
            teamId: teamId,
          },
        },
      }),
    });

    const createIssueData = await createIssueResponse.json();
    console.log('Linear issue creation response:', createIssueData);

    if (!createIssueData.data?.issueCreate?.success) {
      throw new Error(`Failed to create Linear issue: ${JSON.stringify(createIssueData.errors)}`);
    }

    const issueId = createIssueData.data.issueCreate.issue.id;
    const issueUrl = createIssueData.data.issueCreate.issue.url;
    const issueIdentifier = createIssueData.data.issueCreate.issue.identifier;

    // Link customer to the issue if provided
    if (customerName) {
      const customerNeedResponse = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation CreateCustomerNeed($input: CustomerNeedCreateInput!) {
              customerNeedCreate(input: $input) {
                success
                customerNeed {
                  id
                }
              }
            }
          `,
          variables: {
            input: {
              issueId: issueId,
              body: `Customer: ${customerName}${priority ? `\nPriority: ${priority.replace('_', ' ')}` : ''}`,
            },
          },
        }),
      });

      const customerNeedData = await customerNeedResponse.json();
      console.log('Customer need creation response:', customerNeedData);
    }

    // Send confirmation message to the channel
    await client.chat.postMessage({
      channel: metadata.channel,
      text: `✅ Feature request created successfully!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Feature request created successfully!*\n\n*Title:* ${title}\n*Linear Issue:* <${issueUrl}|${issueIdentifier}>${customerName ? `\n*Customer:* ${customerName}` : ''}${priority ? `\n*Priority:* ${priority.replace('_', ' ')}` : ''}\n\n*Submitted by:* <@${metadata.user}>`,
          },
        },
      ],
    });

  } catch (error) {
    logger.error('Error handling manual feature request submission:', error);
    
    // Send error message to user
    const metadata = JSON.parse(body.view.private_metadata);
    await client.chat.postMessage({
      channel: metadata.channel,
      text: `❌ Failed to create feature request: ${error.message}`,
    });
  }
});

async function analyzeThreadAndUpdateModal(client, channel, message_ts, view_id, user_id, originalMessageText) {
  try {
    // Fetch the thread
    let thread;
    try {
      thread = await client.conversations.replies({
        channel: channel,
        ts: message_ts,
        limit: 100,
        inclusive: true,
      });
    } catch (error) {
      console.error('Error fetching thread:', error);
      console.error('Channel:', channel);
      console.error('Message TS:', message_ts);
      
      // Try different approaches to fetch the thread
      try {
        // First try: Get conversation history around the message timestamp
        const historyResult = await client.conversations.history({
          channel: channel,
          latest: message_ts,
          limit: 50,
          inclusive: true,
        });
        
        if (historyResult.messages && historyResult.messages.length > 0) {
          // Check if this message is part of a thread
          const originalMessage = historyResult.messages.find(msg => msg.ts === message_ts);
          
          if (originalMessage && originalMessage.thread_ts) {
            // This is a threaded message, try to get the full thread
            try {
              const threadResult = await client.conversations.replies({
                channel: channel,
                ts: originalMessage.thread_ts,
                limit: 100,
                inclusive: true,
              });
              
              if (threadResult.messages && threadResult.messages.length > 0) {
                thread = threadResult;
                console.log(`Successfully fetched thread with ${thread.messages.length} messages using thread_ts`);
              } else {
                thread = { messages: [originalMessage] };
              }
            } catch (threadError) {
              console.error('Error fetching thread using thread_ts:', threadError);
              thread = { messages: [originalMessage] };
            }
          } else {
            // Not a threaded message, use the original message
            thread = { messages: [originalMessage || historyResult.messages[0]] };
          }
        } else {
          throw new Error('No messages found in history');
        }
      } catch (fallbackError) {
        console.error('All fallback attempts failed:', fallbackError);
        
        // Create a minimal feature request without thread context
        const analysis = {
          title: 'Feature Request from Slack',
          description: '## Problem Statement\n[Unable to access thread content]\n\n## Justification\n[Please fill in]\n\n## Suggested Solution\n[Please fill in]',
          preview: 'Unable to analyze thread content. Please fill in the details manually.',
        };
        
        // Update modal with manual entry form (no team selector)
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
              analysis,
              originalMessageText
            }),
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '⚠️ *Unable to access the thread*\n\nPlease enter the feature request details manually:',
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
                  placeholder: {
                    type: 'plain_text',
                    text: 'Enter feature request title',
                  },
                },
              },
              {
                type: 'input',
                block_id: 'description_block',
                label: {
                  type: 'plain_text',
                  text: 'Description',
                },
                element: {
                  type: 'plain_text_input',
                  action_id: 'description_input',
                  multiline: true,
                  placeholder: {
                    type: 'plain_text',
                    text: 'Enter feature request description...',
                  },
                },
              },
            ],
          },
        });
        return;
      }
    }

    // Format thread for Claude
    const threadText = thread.messages.map(msg => {
      const user = msg.user || 'Unknown';
      const time = new Date(parseFloat(msg.ts) * 1000).toISOString();
      return `[${time}] ${user}: ${msg.text}`;
    }).join('\n\n');

    // Analyze with Claude
    let analysis;
    try {
      analysis = await analyzeThread(threadText);
    } catch (error) {
      console.error('Error in thread analysis:', error);
      
      let errorMessage = '⚠️ Unable to analyze the thread.';
      
      if (error.message === 'ANTHROPIC_AUTH_ERROR') {
        errorMessage = '🔐 Authentication Error: The Anthropic API key appears to be invalid.\n\nPlease check that ANTHROPIC_API_KEY is set correctly in your environment variables.';
      } else if (error.message === 'ANTHROPIC_RATE_LIMIT') {
        errorMessage = '⏱️ Rate Limit: Too many requests to the AI service.\n\nPlease try again in a few moments.';
      } else if (error.message === 'ANTHROPIC_OVERLOADED') {
        errorMessage = '🔥 Service Overloaded: The AI service is temporarily overloaded.\n\nPlease try again in a few moments.';
      } else if (error.message === 'ANTHROPIC_API_ERROR') {
        errorMessage = '❌ AI Service Error: Unable to connect to the AI service.\n\nPlease try again later or check your API configuration.';
      }
      
      // Update modal with error message - remove submit button to prevent bad issues
      await client.views.update({
        view_id: view_id,
        view: {
          type: 'modal',
          callback_id: 'feature_request_error',  // Different callback to prevent submission
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
                text: errorMessage,
              },
            },
          ],
        },
      });
      return;
    }

    // Update the modal with the analysis (no team selector - always use FEAT team)
    try {
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
          analysis,
          originalMessageText
        }),
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ *Thread analyzed successfully!*\n\nReview and edit the details below before creating the feature request (will be created in FEAT team):',
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
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Preview:*\n${analysis.preview}${analysis.customerName ? `\n\n*Customer:* ${analysis.customerName}` : ''}${analysis.customerPriority ? `\n*Priority:* ${analysis.customerPriority.replace('_', ' ')}` : ''}`,
            },
          },
        ],
      },
    });
    } catch (updateError) {
      console.error('Error updating modal:', updateError);
    }

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

Please return ONLY a valid JSON object (no additional text) with:
{
  "title": "A concise title for the Linear issue",
  "description": "The full feature request in markdown",
  "preview": "A 2-3 sentence summary for the Slack modal",
  "customerPriority": "nice_to_have" | "must_have_soon" | "must_have_now",
  "customerName": "The name of the customer mentioned in the thread, or null if no specific customer is mentioned"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    // Extract JSON from Claude's response
    const text = response.content[0].text;
    console.log('Claude response:', text);
    
    // Try to parse the entire response first
    try {
      return JSON.parse(text);
    } catch (e) {
      // If that fails, try to extract JSON from the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        // Find the last closing brace to ensure we get complete JSON
        const jsonStr = jsonMatch[0];
        const lastBrace = jsonStr.lastIndexOf('}');
        const cleanJson = jsonStr.substring(0, lastBrace + 1);
        return JSON.parse(cleanJson);
      }
    }
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    
    // Check if it's an authentication error
    if (error.status === 401 || error.message?.includes('401') || error.message?.includes('authentication')) {
      throw new Error('ANTHROPIC_AUTH_ERROR');
    }
    
    // Check if it's a rate limit error
    if (error.status === 429 || error.message?.includes('429')) {
      throw new Error('ANTHROPIC_RATE_LIMIT');
    }
    
    // Check if it's an overload error
    if (error.status === 529 || error.message?.includes('529') || error.message?.includes('overloaded')) {
      throw new Error('ANTHROPIC_OVERLOADED');
    }
    
    // Generic API error
    throw new Error('ANTHROPIC_API_ERROR');
  }

  // Fallback (shouldn't reach here)
  return {
    title: 'Feature Request from Slack',
    description: 'Unable to analyze thread due to API error',
    preview: 'Error analyzing thread',
  };
}

// Function to find or create a customer and link to issue
async function linkCustomerToIssue(issueId, customerName, originalMessage) {
  try {
    // First, search for existing customers
    const searchQuery = `
      query SearchCustomers($name: String!) {
        customers(filter: { name: { contains: $name } }) {
          nodes {
            id
            name
          }
        }
      }
    `;

    const searchResponse = await axios.post('https://api.linear.app/graphql', {
      query: searchQuery,
      variables: { name: customerName }
    }, {
      headers: {
        'Authorization': `${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let customerId;
    if (searchResponse.data.data?.customers?.nodes?.length > 0) {
      // Use existing customer
      customerId = searchResponse.data.data.customers.nodes[0].id;
      console.log(`Found existing customer: ${customerName} (${customerId})`);
    } else {
      // Create new customer
      const createCustomerMutation = `
        mutation CreateCustomer($name: String!) {
          customerCreate(input: { name: $name }) {
            success
            customer {
              id
              name
            }
          }
        }
      `;

      const createResponse = await axios.post('https://api.linear.app/graphql', {
        query: createCustomerMutation,
        variables: { name: customerName }
      }, {
        headers: {
          'Authorization': `${process.env.LINEAR_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (createResponse.data.data?.customerCreate?.success) {
        customerId = createResponse.data.data.customerCreate.customer.id;
        console.log(`Created new customer: ${customerName} (${customerId})`);
      } else {
        console.error('Failed to create customer:', createResponse.data);
        return null;
      }
    }

    // Link customer to issue
    const linkMutation = `
      mutation LinkCustomerToIssue($issueId: String!, $customerId: String!, $body: String) {
        customerNeedCreate(input: { 
          issueId: $issueId, 
          customerId: $customerId,
          body: $body
        }) {
          success
          customerNeed {
            id
          }
        }
      }
    `;

    const linkResponse = await axios.post('https://api.linear.app/graphql', {
      query: linkMutation,
      variables: { 
        issueId: issueId,
        customerId: customerId,
        body: originalMessage ? `Original message: ${originalMessage}` : null
      }
    }, {
      headers: {
        'Authorization': `${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (linkResponse.data.data?.customerNeedCreate?.success) {
      return {
        success: true,
        customer: { id: customerId, name: customerName }
      };
    }

    return null;
  } catch (error) {
    console.error('Error linking customer to issue:', error);
    return null;
  }
}

// Workflow Step Handlers

// Handle workflow step edit (when user adds the step to a workflow)
app.step('create_linear_feature_request_step', async ({ step, configure, ack, client }) => {
  await ack();

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Configure Linear Feature Request Step*\n\nSet up the fields for creating feature requests in your workflow:'
      }
    },
    {
      type: 'input',
      block_id: 'title_input',
      element: {
        type: 'plain_text_input',
        action_id: 'title',
        placeholder: {
          type: 'plain_text',
          text: 'Feature request title'
        }
      },
      label: {
        type: 'plain_text',
        text: 'Title'
      }
    },
    {
      type: 'input',
      block_id: 'description_input',
      element: {
        type: 'plain_text_input',
        action_id: 'description',
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: 'Feature request description'
        }
      },
      label: {
        type: 'plain_text',
        text: 'Description'
      }
    },
    {
      type: 'input',
      block_id: 'customer_input',
      optional: true,
      element: {
        type: 'plain_text_input',
        action_id: 'customer_name',
        placeholder: {
          type: 'plain_text',
          text: 'Customer name (optional)'
        }
      },
      label: {
        type: 'plain_text',
        text: 'Customer Name'
      }
    },
    {
      type: 'input',
      block_id: 'priority_input',
      optional: true,
      element: {
        type: 'static_select',
        action_id: 'priority',
        placeholder: {
          type: 'plain_text',
          text: 'Select priority'
        },
        options: [
          {
            text: {
              type: 'plain_text',
              text: 'Nice to have'
            },
            value: 'nice_to_have'
          },
          {
            text: {
              type: 'plain_text',
              text: 'Must have soon'
            },
            value: 'must_have_soon'
          },
          {
            text: {
              type: 'plain_text',
              text: 'Must have now (Blocker)'
            },
            value: 'must_have_now'
          }
        ]
      },
      label: {
        type: 'plain_text',
        text: 'Priority'
      }
    }
  ];

  await configure({ blocks });
});

// Handle workflow step save (when user saves the step configuration)
app.view('create_linear_feature_request_step', async ({ ack, view, update }) => {
  await ack();

  const values = view.state.values;
  const title = values.title_input?.title?.value;
  const description = values.description_input?.description?.value;
  const customerName = values.customer_input?.customer_name?.value;
  const priority = values.priority_input?.priority?.selected_option?.value;

  const inputs = {
    title: { value: title || '' },
    description: { value: description || '' },
    customer_name: { value: customerName || '' },
    priority: { value: priority || '' }
  };

  const outputs = [
    {
      type: 'text',
      name: 'issue_id',
      label: 'Linear Issue ID'
    },
    {
      type: 'text', 
      name: 'issue_url',
      label: 'Linear Issue URL'
    },
    {
      type: 'text',
      name: 'issue_identifier', 
      label: 'Linear Issue Identifier'
    }
  ];

  await update({ inputs, outputs });
});

// Handle workflow step execute (when the workflow runs)
app.event('workflow_step_execute', async ({ event, complete, fail, client }) => {
  const { callback_id, workflow_step } = event;
  
  if (callback_id !== 'create_linear_feature_request_step') {
    return;
  }

  try {
    const { inputs } = workflow_step;
    
    const title = inputs.title?.value || 'Workflow Feature Request';
    const description = inputs.description?.value || 'Feature request created from workflow';
    const customerName = inputs.customer_name?.value;
    const priority = inputs.priority?.value;

    console.log('Executing workflow step:', { title, description, customerName, priority });

    // Create the Linear issue
    const issueDescription = `**Feature request from Slack workflow**

${description}

---
*Created via workflow automation*`;

    const createIssueResponse = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                url
              }
            }
          }
        `,
        variables: {
          input: {
            title: title,
            description: issueDescription,
            teamId: process.env.LINEAR_TEAM_ID,
            labelIds: priority && customerPriorityLabels[priority] ? [customerPriorityLabels[priority]] : undefined
          },
        },
      }),
    });

    const createIssueData = await createIssueResponse.json();
    
    if (!createIssueData.data?.issueCreate?.success) {
      throw new Error(`Failed to create Linear issue: ${JSON.stringify(createIssueData.errors)}`);
    }

    const issue = createIssueData.data.issueCreate.issue;
    console.log('Workflow created Linear issue:', issue);

    // Link customer if provided
    if (customerName) {
      try {
        const customerNeedResponse = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.LINEAR_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              mutation CreateCustomerNeed($input: CustomerNeedCreateInput!) {
                customerNeedCreate(input: $input) {
                  success
                }
              }
            `,
            variables: {
              input: {
                issueId: issue.id,
                body: `Customer: ${customerName}${priority ? `\nPriority: ${priority.replace('_', ' ')}` : ''}\n\nCreated via Slack workflow automation.`
              },
            },
          }),
        });
        
        const customerNeedData = await customerNeedResponse.json();
        console.log('Customer need creation for workflow:', customerNeedData);
      } catch (customerError) {
        console.error('Error linking customer in workflow:', customerError);
        // Don't fail the workflow for customer linking errors
      }
    }

    // Complete the workflow step with outputs
    await complete({
      outputs: {
        issue_id: issue.id,
        issue_url: issue.url,
        issue_identifier: issue.identifier
      }
    });

    console.log('✅ Workflow step completed successfully');

  } catch (error) {
    console.error('❌ Workflow step execution failed:', error);
    await fail({
      error: {
        message: `Failed to create feature request: ${error.message}`
      }
    });
  }
});

// Start the app
(async () => {
  // Fetch customer priority labels on startup
  await fetchCustomerPriorityLabels();
  
  // When using Socket Mode, we need to start a basic HTTP server for Render health checks
  const http = require('http');
  const PORT = process.env.PORT || 3000;
  
  // Create a simple HTTP server for health checks
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });
  
  server.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
  });
  
  // Start the Slack app
  await app.start();
  console.log('⚡️ Slack Linear bot is running\!');
})();
