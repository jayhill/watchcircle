import { createSessionTokenService, wsConnectionKey, type Role } from "@watchcircle/common";

export interface WsConnectEvent {
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: {
    connectionId?: string;
  };
}

interface ConnectionStore {
  putConnection(input: {
    eventId: string;
    connectionId: string;
    userId: string;
    role: Role;
    connectedAtEpoch: number;
  }): Promise<void>;
}

type SessionServices = ReturnType<typeof createSessionTokenService>;

function unauthorized() {
  return {
    statusCode: 401,
    body: "Unauthorized",
  };
}

function forbidden() {
  return {
    statusCode: 403,
    body: "Forbidden",
  };
}

export function createConnectHandler(deps: {
  sessions: SessionServices;
  connectionStore: ConnectionStore;
}) {
  return async (event: WsConnectEvent) => {
    const query = event.queryStringParameters ?? {};
    const wsToken = query.token;
    const eventId = query.eventId;
    const connectionId = event.requestContext.connectionId;

    if (!wsToken || !eventId || !connectionId) {
      return unauthorized();
    }

    let claims;

    try {
      claims = deps.sessions.ws.verifyWsToken(wsToken);
    } catch {
      return unauthorized();
    }

    if (claims.eventId !== eventId) {
      return forbidden();
    }

    await deps.connectionStore.putConnection({
      eventId,
      connectionId,
      userId: claims.sub,
      role: claims.role,
      connectedAtEpoch: Math.floor(Date.now() / 1000),
    });

    return {
      statusCode: 200,
      body: "Connected",
    };
  };
}

type DbOps = {
  putItem<T extends object>(item: T): Promise<void>;
};

export function createConnectionStore(deps: { db: DbOps; ttlSeconds?: number }): ConnectionStore {
  const ttlSeconds = deps.ttlSeconds ?? 24 * 60 * 60;

  return {
    async putConnection(input) {
      const key = wsConnectionKey(input.eventId, input.connectionId);
      const ttl = input.connectedAtEpoch + ttlSeconds;

      await deps.db.putItem({
        ...key,
        connectionId: input.connectionId,
        userId: input.userId,
        role: input.role,
        connectedAtEpoch: input.connectedAtEpoch,
        ttl,
      });
    },
  };
}
