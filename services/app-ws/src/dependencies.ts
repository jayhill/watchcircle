import {
  createDbOperations,
  createDocumentClient,
  createDynamoClient,
  createSessionTokenService,
} from "@watchcircle/common";

import { createConnectionStore, createConnectHandler } from "./handlers/connect.js";
import {
  createDynamoChatSendStore,
  createEventChatBroadcaster,
  createChatSendAction,
  createDynamoSenderContextResolver,
} from "./handlers/chat-send.js";
import { createConnectionCleanupStore, createDisconnectHandler } from "./handlers/disconnect.js";
import { createDefaultRouteHandler as createDefaultRouteDispatchHandler } from "./handlers/default.js";
import { loadWsSecretsFromSsm, readWsSecretsFromEnv } from "./ssm-config.js";
import { createApiGatewayWsSender, createNoopWsSender } from "./ws-sender.js";

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function createDefaultConnectHandler() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const region = process.env.AWS_REGION ?? "us-east-2";
  const secrets = readWsSecretsFromEnv();
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

  const dynamo = createDynamoClient({ region, endpoint: dynamoEndpoint });
  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  const sessions = createSessionTokenService({
    sessionSecret: secrets.sessionJwtSecret,
    wsSecret: secrets.wsJwtSecret,
  });
  const connectionStore = createConnectionStore({ db });

  return createConnectHandler({
    sessions,
    connectionStore,
  });
}

export async function createDefaultConnectHandlerFromSsm() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const stage = readRequiredEnv("STAGE");
  const region = process.env.AWS_REGION ?? "us-east-2";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
  const ssmPrefix = process.env.SSM_PREFIX ?? "/watchcircle";

  const dynamo = createDynamoClient({ region, endpoint: dynamoEndpoint });
  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  const secrets = await loadWsSecretsFromSsm({
    stage,
    region,
    ssmPrefix,
  });
  const sessions = createSessionTokenService({
    sessionSecret: secrets.sessionJwtSecret,
    wsSecret: secrets.wsJwtSecret,
  });
  const connectionStore = createConnectionStore({ db });

  return createConnectHandler({
    sessions,
    connectionStore,
  });
}

export function createDefaultDisconnectHandler() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const region = process.env.AWS_REGION ?? "us-east-2";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

  const dynamo = createDynamoClient({ region, endpoint: dynamoEndpoint });
  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  const connectionStore = createConnectionCleanupStore({ db });

  return createDisconnectHandler({
    connectionStore,
  });
}

export function createDefaultRouteHandler() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const region = process.env.AWS_REGION ?? "us-east-2";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

  const dynamo = createDynamoClient({ region, endpoint: dynamoEndpoint });
  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });

  const store = createDynamoChatSendStore({ db });
  const senderContextResolver = createDynamoSenderContextResolver({ db });
  const sender = process.env.WS_MANAGEMENT_ENDPOINT
    ? createApiGatewayWsSender()
    : createNoopWsSender();
  const connectionCleanupStore = createConnectionCleanupStore({ db });
  const broadcaster = createEventChatBroadcaster({
    db,
    sender,
    connectionCleanupStore,
  });

  const chatSendAction = createChatSendAction({
    store,
    broadcaster,
    senderContextResolver,
  });

  return createDefaultRouteDispatchHandler({
    chatSendAction: async (input) => chatSendAction(input),
  });
}

export async function createDefaultRouteHandlerFromSsm() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const stage = readRequiredEnv("STAGE");
  const region = process.env.AWS_REGION ?? "us-east-2";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
  const ssmPrefix = process.env.SSM_PREFIX ?? "/watchcircle";

  const dynamo = createDynamoClient({ region, endpoint: dynamoEndpoint });
  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  await loadWsSecretsFromSsm({
    stage,
    region,
    ssmPrefix,
  });

  const store = createDynamoChatSendStore({ db });
  const senderContextResolver = createDynamoSenderContextResolver({ db });
  const sender = process.env.WS_MANAGEMENT_ENDPOINT
    ? createApiGatewayWsSender()
    : createNoopWsSender();
  const connectionCleanupStore = createConnectionCleanupStore({ db });
  const broadcaster = createEventChatBroadcaster({
    db,
    sender,
    connectionCleanupStore,
  });

  const chatSendAction = createChatSendAction({
    store,
    broadcaster,
    senderContextResolver,
  });

  return createDefaultRouteDispatchHandler({
    chatSendAction: async (input) => chatSendAction(input),
  });
}
