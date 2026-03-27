import { describe, expect, it } from "vitest";

import { createConnectionCleanupStore, createDisconnectHandler } from "./disconnect.js";

type TableKey = { PK: string; SK: string };

function createInMemoryDb() {
  const deletedKeys: TableKey[] = [];
  const pointerByConn = new Map<string, { eventId: string }>();

  return {
    async getByKey<T>(key: TableKey): Promise<T | null> {
      if (key.PK.startsWith("CONNECTION#") && key.SK === "META") {
        const connectionId = key.PK.replace("CONNECTION#", "");
        const pointer = pointerByConn.get(connectionId);
        return (pointer ?? null) as T | null;
      }

      return null;
    },
    async deleteByKey(key: TableKey): Promise<void> {
      deletedKeys.push(key);
    },
    setPointer(connectionId: string, eventId: string) {
      pointerByConn.set(connectionId, { eventId });
    },
    deletedKeys,
  };
}

describe("ws disconnect handler", () => {
  it("returns bad request without connectionId", async () => {
    const handler = createDisconnectHandler({
      connectionStore: {
        async removeConnection() {
          return;
        },
      },
    });

    const result = await handler({ requestContext: {} });

    expect(result.statusCode).toBe(400);
  });

  it("removes connection with eventId context", async () => {
    const removed: Array<{ eventId?: string; connectionId: string }> = [];
    const handler = createDisconnectHandler({
      connectionStore: {
        async removeConnection(input) {
          removed.push(input);
        },
      },
    });

    const result = await handler({
      requestContext: { connectionId: "conn_1" },
      queryStringParameters: { eventId: "evt_1" },
    });

    expect(result.statusCode).toBe(200);
    expect(removed).toEqual([{ eventId: "evt_1", connectionId: "conn_1" }]);
  });

  it("removes connection even when eventId is recovered from pointer", async () => {
    const removed: Array<{ eventId?: string; connectionId: string }> = [];
    const handler = createDisconnectHandler({
      connectionStore: {
        async removeConnection(input) {
          removed.push(input);
        },
      },
    });

    const result = await handler({
      requestContext: { connectionId: "conn_1" },
    });

    expect(result.statusCode).toBe(200);
    expect(removed).toEqual([{ eventId: undefined, connectionId: "conn_1" }]);
  });
});

describe("connection cleanup store", () => {
  it("deletes expected ws connection key", async () => {
    const db = createInMemoryDb();
    db.setPointer("conn_1", "evt_1");
    const store = createConnectionCleanupStore({ db });

    await store.removeConnection({ connectionId: "conn_1" });

    expect(db.deletedKeys).toEqual([
      {
        PK: "EVENT#evt_1",
        SK: "CONN#conn_1",
      },
      {
        PK: "CONNECTION#conn_1",
        SK: "META",
      },
    ]);
  });
});
