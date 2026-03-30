import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { ChatNewEvent } from "@watchcircle/common";

export type WsSendResult = "sent" | "gone";

export interface WsSender {
  send(
    connectionId: string,
    message: ChatNewEvent,
    managementEndpoint?: string
  ): Promise<WsSendResult>;
}

export function createApiGatewayWsSender(): WsSender {
  const defaultEndpoint = process.env.WS_MANAGEMENT_ENDPOINT;
  const clients = new Map<string, ApiGatewayManagementApiClient>();

  function getClient(endpointOverride?: string) {
    const endpoint = endpointOverride ?? defaultEndpoint;
    if (!endpoint) {
      throw new Error("Missing WS management endpoint");
    }

    const existing = clients.get(endpoint);
    if (existing) {
      return existing;
    }

    const created = new ApiGatewayManagementApiClient({ endpoint });
    clients.set(endpoint, created);
    return created;
  }

  return {
    async send(
      connectionId: string,
      message: ChatNewEvent,
      managementEndpoint?: string
    ): Promise<WsSendResult> {
      try {
        const client = getClient(managementEndpoint);
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
