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
    let channel, message_ts;
    
    if (shortcut.message) {
      // Message shortcut
      message_ts = shortcut.message.ts;
      channel = shortcut.channel.id;
    } else {
      console.error('Unable to extract channel and message info from shortcut:', shortcut);
      throw new Error('Invalid shortcut payload');
    }
    
    console.log('Channel ID:', channel);
    console.log('Message TS:', message_ts);
    console.log('Channel type:', shortcut.channel?.type);
    console.log('Is private:', shortcut.channel?.is_private);
    
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
    analyzeThreadAndUpdateModal(client, channel, message_ts, result.view.id, shortcut.user.id);

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
    
    // Validate that we have meaningful content
    const finalTitle = title || analysis.title;
    const finalDescription = analysis.description;
    
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
      const customerLinkResult = await linkCustomerToIssue(issue.id, analysis.customerName, analysis.customerPriority);
      
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
    
    // Post confirmation message to the user
    let confirmationText = `✅ Feature request created: ${issue.identifier} - ${issue.title}\n${issue.url}`;
    
    // Add customer info if available
    if (analysis.customerName) {
      confirmationText += `\n👤 Customer: ${analysis.customerName}`;
    }
    
    // Add Slack thread link info if successful
    if (permalinkResult?.permalink) {
      confirmationText += `\n🔗 Slack thread linked to the issue`;
    }
    
    await client.chat.postEphemeral({
      channel: metadata.channel,
      user: body.user.id,
      text: confirmationText,
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

async function analyzeThreadAndUpdateModal(client, channel, message_ts, view_id, user_id) {
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
      
      // Try to fetch just the single message as a fallback
      try {
        const result = await client.conversations.history({
          channel: channel,
          latest: message_ts,
          limit: 1,
          inclusive: true,
        });
        
        if (result.messages && result.messages.length > 0) {
          thread = { messages: [result.messages[0]] };
        } else {
          throw new Error('No message found');
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        
        // Create a minimal feature request without thread context
        const analysis = {
          title: 'Feature Request from Slack',
          description: '## Problem Statement\n[Unable to access thread content]\n\n## Justification\n[Please fill in]\n\n## Suggested Solution\n[Please fill in]',
          preview: 'Unable to analyze thread content. Please fill in the details manually.',
        };
        
        // Update modal with manual entry form
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
                  text: '⚠️ Unable to access the thread. Please enter the details manually:',
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

    // Update the modal with the analysis
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
              text: `*Preview:*\n${analysis.preview}${analysis.customerName ? `\n\n*Customer:* ${analysis.customerName}` : ''}`,
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
async function linkCustomerToIssue(issueId, customerName, customerPriority) {
  if (!customerName || customerName.trim() === '') {
    console.log('No customer name provided, skipping customer linking');
    return null;
  }

  // Map customer priority to numeric value
  let priorityValue = 1; // Default
  if (customerPriority === 'must_have_now') {
    priorityValue = 3;
  } else if (customerPriority === 'must_have_soon') {
    priorityValue = 2;
  } else if (customerPriority === 'nice_to_have') {
    priorityValue = 1;
  }

  try {
    // First, try to find existing customer
    const searchQuery = `
      query SearchCustomers($filter: CustomerFilter!) {
        customers(filter: $filter) {
          nodes {
            id
            name
          }
        }
      }
    `;

    const searchResponse = await axios.post('https://api.linear.app/graphql', {
      query: searchQuery,
      variables: {
        filter: {
          name: {
            containsIgnoreCase: customerName.trim()
          }
        }
      }
    }, {
      headers: {
        'Authorization': `${process.env.LINEAR_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Customer search response:', JSON.stringify(searchResponse.data, null, 2));

    let customerId = null;

    // Check if customer already exists
    if (searchResponse.data.data?.customers?.nodes?.length > 0) {
      const existingCustomer = searchResponse.data.data.customers.nodes[0];
      customerId = existingCustomer.id;
      console.log(`Found existing customer: ${existingCustomer.name} (${customerId})`);
    } 
    // If we still don't have a customer ID, log why
    if (!customerId) {
      console.log('No customer ID available - either not found and creation failed, or customer functionality not available');
      return null;
    }

    // Now create a CustomerNeed and link it to the issue
    if (customerId) {
      const createNeedMutation = `
        mutation CustomerNeedCreate($input: CustomerNeedCreateInput!) {
          customerNeedCreate(input: $input) {
            success
          }
        }
      `;

      const createNeedResponse = await axios.post('https://api.linear.app/graphql', {
        query: createNeedMutation,
        variables: {
          input: {
            customerId: customerId,
            issueId: issueId,
            priority: priorityValue
          }
        }
      }, {
        headers: {
          'Authorization': `${process.env.LINEAR_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Create customer need response:', JSON.stringify(createNeedResponse.data, null, 2));

      if (createNeedResponse.data.errors) {
        console.error('GraphQL errors creating customer need:', createNeedResponse.data.errors);
        return null;
      }

      if (createNeedResponse.data.data?.customerNeedCreate?.success) {
        console.log(`✅ Successfully created customer need for ${customerName} on issue ${issueId}`);
        return {
          success: true,
          customer: createNeedResponse.data.data.customerNeedCreate.customerNeed.customer
        };
      } else {
        console.error('Failed to create customer need - no success in response');
        return null;
      }
    }

  } catch (error) {
    console.error('Error linking customer to issue:', error.message);
    return null;
  }
}

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
  console.log('⚡️ Slack Linear bot is running!');
})();
