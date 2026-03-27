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
  createDynamoSenderIdentityResolver,
} from "./handlers/chat-send.js";
import { createConnectionCleanupStore, createDisconnectHandler } from "./handlers/disconnect.js";
import { createDefaultRouteHandler as createDefaultRouteDispatchHandler } from "./handlers/default.js";
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
  const region = process.env.AWS_REGION ?? "us-east-1";
  const wsSecret = readRequiredEnv("WS_JWT_SECRET");
  const sessionSecret = process.env.SESSION_JWT_SECRET ?? "unused-session-secret";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

  const dynamo = createDynamoClient({ region, endpoint: dynamoEndpoint });
  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  const sessions = createSessionTokenService({
    sessionSecret,
    wsSecret,
  });
  const connectionStore = createConnectionStore({ db });

  return createConnectHandler({
    sessions,
    connectionStore,
  });
}

export function createDefaultDisconnectHandler() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const region = process.env.AWS_REGION ?? "us-east-1";
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
  const region = process.env.AWS_REGION ?? "us-east-1";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

  const dynamo = createDynamoClient({ region, endpoint: dynamoEndpoint });
  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });

  const store = createDynamoChatSendStore({ db });
  const senderIdentityResolver = createDynamoSenderIdentityResolver({ db });
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
    senderIdentityResolver,
  });

  return createDefaultRouteDispatchHandler({
    chatSendAction,
  });
}
