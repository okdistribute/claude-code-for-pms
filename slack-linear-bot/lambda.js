const { App, AwsLambdaReceiver } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');
const { LinearClient } = require('@linear/sdk');

// Initialize the receiver
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initialize app with Lambda receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,
});

// Initialize Claude and Linear (same as before)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const linear = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
});

// Copy all your event handlers from index.js here
// (shortcuts, views, helper functions)

// Lambda handler
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
};