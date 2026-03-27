import { wsConnectionKey } from "@watchcircle/common";

export interface WsDisconnectEvent {
  requestContext: {
    connectionId?: string;
  };
  queryStringParameters?: Record<string, string | undefined>;
}

interface ConnectionStore {
  removeConnection(input: { eventId?: string; connectionId: string }): Promise<void>;
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

    if (!connectionId) {
      return badRequest();
    }

    await deps.connectionStore.removeConnection({
      eventId: event.queryStringParameters?.eventId,
      connectionId,
    });

    return {
      statusCode: 200,
      body: "Disconnected",
    };
  };
}

type DbOps = {
  getByKey<T>(key: { PK: string; SK: string }): Promise<T | null>;
  deleteByKey(key: { PK: string; SK: string }): Promise<void>;
};

function connectionPointerKey(connectionId: string) {
  return {
    PK: `CONNECTION#${connectionId}`,
    SK: "META",
  };
}

interface ConnectionPointerItem {
  PK: string;
  SK: string;
  eventId: string;
}

export function createConnectionCleanupStore(deps: { db: DbOps }): ConnectionStore {
  return {
    async removeConnection(input) {
      const eventId =
        input.eventId ??
        (await deps.db.getByKey<ConnectionPointerItem>(connectionPointerKey(input.connectionId)))
          ?.eventId;

      if (eventId) {
        await deps.db.deleteByKey(wsConnectionKey(eventId, input.connectionId));
      }

      await deps.db.deleteByKey(connectionPointerKey(input.connectionId));
    },
  };
}
