import { wsConnectionKey } from "@watchcircle/common";

export interface WsDisconnectEvent {
  requestContext: {
    connectionId?: string;
  };
  queryStringParameters?: Record<string, string | undefined>;
}

interface ConnectionStore {
  removeConnection(input: { eventId: string; connectionId: string }): Promise<void>;
}

function badRequest() {
  return {
    statusCode: 400,
    body: "Missing connection context",
  };
}

export function createDisconnectHandler(deps: { connectionStore: ConnectionStore }) {
  return async (event: WsDisconnectEvent) => {
    const connectionId = event.requestContext.connectionId;
    const eventId = event.queryStringParameters?.eventId;

    if (!connectionId || !eventId) {
      return badRequest();
    }

    await deps.connectionStore.removeConnection({ eventId, connectionId });

    return {
      statusCode: 200,
      body: "Disconnected",
    };
  };
}

type DbOps = {
  deleteByKey(key: { PK: string; SK: string }): Promise<void>;
};

export function createConnectionCleanupStore(deps: { db: DbOps }): ConnectionStore {
  return {
    async removeConnection(input) {
      await deps.db.deleteByKey(wsConnectionKey(input.eventId, input.connectionId));
    },
  };
}
