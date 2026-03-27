import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { ChatNewEvent } from "@watchcircle/common";

export type WsSendResult = "sent" | "gone";

export interface WsSender {
  send(connectionId: string, message: ChatNewEvent): Promise<WsSendResult>;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function createApiGatewayWsSender(): WsSender {
  const endpoint = readRequiredEnv("WS_MANAGEMENT_ENDPOINT");
  const client = new ApiGatewayManagementApiClient({ endpoint });

  return {
    async send(connectionId: string, message: ChatNewEvent): Promise<WsSendResult> {
      try {
        await client.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: Buffer.from(JSON.stringify(message)),
          })
        );
        return "sent";
      } catch (error) {
        if (error instanceof GoneException) {
          return "gone";
        }

        throw error;
      }
    },
  };
}

export function createNoopWsSender(): WsSender {
  return {
    async send() {
      return "sent";
    },
  };
}
