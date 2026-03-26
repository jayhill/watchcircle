import {
  createAuthAbuseProtector,
  createDbOperations,
  createDocumentClient,
  createDynamoClient,
  createMagicLinkService,
  createSessionTokenService,
} from "@watchcircle/common";

import { createAuthHandlers } from "./handlers/auth.js";
import { createAuthStores } from "./stores/auth-store.js";

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function createDefaultAuthHandlers() {
  const tableName = readRequiredEnv("TABLE_NAME");
  const region = process.env.AWS_REGION ?? "us-east-1";
  const sessionSecret = readRequiredEnv("SESSION_JWT_SECRET");
  const wsSecret = readRequiredEnv("WS_JWT_SECRET");
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
  const sessions = createSessionTokenService({
    sessionSecret,
    wsSecret,
  });

  return createAuthHandlers({
    magicLinks,
    abuseProtector,
    sessions,
    participantStore: stores.participantStore,
    emailSender: {
      async sendVerificationCode() {
        return;
      },
    },
  });
}
