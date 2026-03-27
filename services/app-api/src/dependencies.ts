import {
  createAuthAbuseProtector,
  createDbOperations,
  createDocumentClient,
  createDynamoClient,
  createMagicLinkService,
  createSessionTokenService,
} from "@watchcircle/common";

import { loadStageSecretsFromSsm, readSecretsFromEnv } from "./ssm-config.js";
import { createNoopEmailSender, createSesEmailSender } from "./email-sender.js";
import { createAuthHandlers } from "./handlers/auth.js";
import { createDynamoEventStore, createEventHandlers } from "./handlers/events.js";
import { createAuthStores } from "./stores/auth-store.js";

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildEmailSender(input: { region: string }) {
  const source = process.env.AUTH_EMAIL_SENDER ?? "noop";

  if (source === "ses") {
    const fromEmail = readRequiredEnv("SES_FROM_EMAIL");
    const productName = process.env.PRODUCT_NAME ?? "WatchCircle";

    return createSesEmailSender({
      fromEmail,
      region: input.region,
      productName,
    });
  }

  return createNoopEmailSender();
}

export function createDefaultAuthHandlers() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const region = process.env.AWS_REGION ?? "us-east-1";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

  const dynamo = createDynamoClient({
    region,
    endpoint: dynamoEndpoint,
  });

  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  const stores = createAuthStores({ db });

  const magicLinks = createMagicLinkService({ tokenStore: stores.tokenStore });
  const abuseProtector = createAuthAbuseProtector({
    counterStore: stores.counterStore,
    verifyLockStore: stores.verifyLockStore,
  });
  const secrets = readSecretsFromEnv();
  const sessions = createSessionTokenService({
    sessionSecret: secrets.sessionJwtSecret,
    wsSecret: secrets.wsJwtSecret,
  });
  const emailSender = buildEmailSender({ region });

  return createAuthHandlers({
    magicLinks,
    abuseProtector,
    sessions,
    participantStore: stores.participantStore,
    emailSender,
  });
}

export async function createDefaultAuthHandlersFromSsm() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const stage = readRequiredEnv("STAGE");
  const region = process.env.AWS_REGION ?? "us-east-1";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
  const ssmPrefix = process.env.SSM_PREFIX ?? "/watchcircle";

  const dynamo = createDynamoClient({
    region,
    endpoint: dynamoEndpoint,
  });

  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  const stores = createAuthStores({ db });

  const magicLinks = createMagicLinkService({ tokenStore: stores.tokenStore });
  const abuseProtector = createAuthAbuseProtector({
    counterStore: stores.counterStore,
    verifyLockStore: stores.verifyLockStore,
  });

  const secrets = await loadStageSecretsFromSsm({
    stage,
    region,
    ssmPrefix,
  });

  const sessions = createSessionTokenService({
    sessionSecret: secrets.sessionJwtSecret,
    wsSecret: secrets.wsJwtSecret,
  });
  const emailSender = buildEmailSender({ region });

  return createAuthHandlers({
    magicLinks,
    abuseProtector,
    sessions,
    participantStore: stores.participantStore,
    emailSender,
  });
}

export function createDefaultEventHandlers() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const region = process.env.AWS_REGION ?? "us-east-1";
  const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

  const dynamo = createDynamoClient({
    region,
    endpoint: dynamoEndpoint,
  });

  const docClient = createDocumentClient(dynamo);
  const db = createDbOperations(docClient, { tableName });
  const store = createDynamoEventStore({ db });

  return createEventHandlers({
    store,
  });
}
