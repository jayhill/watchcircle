import { describe, expect, it } from "vitest";

import { createSessionTokenService } from "@watchcircle/common";

import { createConnectHandler, createConnectionStore } from "./connect.js";

type TableItem = {
  PK: string;
  SK: string;
  [key: string]: unknown;
};

function createInMemoryDb() {
  const data = new Map<string, TableItem>();

  return {
    async putItem<T extends object>(item: T): Promise<void> {
      const tableItem = item as TableItem;
      data.set(`${tableItem.PK}|${tableItem.SK}`, tableItem);
    },
    getAll() {
      return [...data.values()];
    },
  };
}

describe("ws connect handler", () => {
  it("rejects missing ws token", async () => {
    const sessions = createSessionTokenService({
      sessionSecret: "session-secret",
      wsSecret: "ws-secret",
    });

    const handler = createConnectHandler({
      sessions,
      connectionStore: {
        async putConnection() {
          return;
        },
      },
    });

    const result = await handler({
      requestContext: { connectionId: "abc" },
      queryStringParameters: { eventId: "evt_1" },
    });

    expect(result.statusCode).toBe(401);
  });

  it("stores connection for valid ws token", async () => {
    const sessions = createSessionTokenService({
      sessionSecret: "session-secret",
      wsSecret: "ws-secret",
    });

    const wsToken = sessions.ws.createWsToken({
      userId: "usr_1",
      eventId: "evt_1",
      role: "participant",
      nowMs: Date.now(),
    });

    const captured: Array<{ eventId: string; connectionId: string; userId: string }> = [];

    const handler = createConnectHandler({
      sessions,
      connectionStore: {
        async putConnection(input) {
          captured.push({
            eventId: input.eventId,
            connectionId: input.connectionId,
            userId: input.userId,
          });
        },
      },
    });

    const result = await handler({
      requestContext: { connectionId: "conn_1" },
      queryStringParameters: {
        token: wsToken,
        eventId: "evt_1",
      },
    });

    expect(result.statusCode).toBe(200);
    expect(captured).toEqual([
      {
        eventId: "evt_1",
        connectionId: "conn_1",
        userId: "usr_1",
      },
    ]);
  });
});

describe("connection store", () => {
  it("writes ws connection entity", async () => {
    const db = createInMemoryDb();
    const store = createConnectionStore({ db, ttlSeconds: 60 });

    await store.putConnection({
      eventId: "evt_1",
      connectionId: "conn_1",
      userId: "usr_1",
      role: "participant",
      connectedAtEpoch: 1_700_000_000,
    });

    const items = db.getAll();
    expect(items).toHaveLength(1);
    const saved = items[0];
    expect(saved).toBeDefined();
    expect(saved?.PK).toBe("EVENT#evt_1");
    expect(saved?.SK).toBe("CONN#conn_1");
    expect(saved?.ttl).toBe(1_700_000_060);
  });
});
