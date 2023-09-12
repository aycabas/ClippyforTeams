// Import required packages
import * as restify from "restify";

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  MemoryStorage,
} from "botbuilder";

import config from "./config";

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: config.botId,
  MicrosoftAppPassword: config.botPassword,
  MicrosoftAppType: "MultiTenant",
});

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
  {},
  credentialsFactory
);

const adapter = new CloudAdapter(botFrameworkAuthentication);

// Catch-all for errors.
const onTurnErrorHandler = async (context: TurnContext, error: Error) => {
  // This check writes out errors to console log .vs. app insights.
  // NOTE: In production environment, you should consider logging this to Azure
  //       application insights.
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  // Send a message to the user
  await context.sendActivity(`The bot encountered unhandled error:\n ${error.message}`);
  await context.sendActivity("To continue to run this bot, please fix the bot source code.");
};

// Set the onTurnError for the singleton CloudAdapter.
adapter.onTurnError = onTurnErrorHandler;

// Create HTTP server.
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\nBot Started, ${server.name} listening to ${server.url}`);
});

import { Application, DefaultPromptManager, DefaultTurnState, OpenAIModerator, OpenAIPlanner, AI, AzureOpenAIPlanner } from '@microsoft/teams-ai';
import path from "path";

// ConversationState is used to store the state of conversations between turns.
interface ConversationState {}
type ApplicationTurnState = DefaultTurnState<ConversationState>;

// Create planner
const planner = new AzureOpenAIPlanner({
  apiKey: config.openAIKey,
  endpoint: config.openAIEndpoint,
  apiVersion: '2023-03-15-preview',
  defaultModel: 'gpt-35-turbo',
  logRequests: true,
  useSystemMessage: true
});

// create promptManager
const promptManager = new DefaultPromptManager(path.join(__dirname, './prompts'));

// create storage
const storage = new MemoryStorage();

//create app

const app = new Application<ApplicationTurnState>({
  storage,
  ai:{
    planner,
    promptManager,
    prompt: 'chat'

  }

});

app.message('reset', async (context: TurnContext, state: ApplicationTurnState) => {
  state.conversation.delete();
  await context.sendActivity('Resetting conversation, let\'s start over');

});

// Listen for incoming requests.
server.post("/api/messages", async (req, res) => {
  await adapter.process(req, res, async (context) => {
    await app.run(context);
  });
});
