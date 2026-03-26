import { describe, expect, it } from "vitest";

import { createConnectionCleanupStore, createDisconnectHandler } from "./disconnect.js";

type TableKey = { PK: string; SK: string };

function createInMemoryDb() {
  const deletedKeys: TableKey[] = [];

  return {
    async deleteByKey(key: TableKey): Promise<void> {
      deletedKeys.push(key);
    },
    deletedKeys,
  };
}

describe("ws disconnect handler", () => {
  it("returns bad request without eventId", async () => {
    const handler = createDisconnectHandler({
      connectionStore: {
        async removeConnection() {
          return;
        },
      },
    });

    const result = await handler({
      requestContext: { connectionId: "conn_1" },
    });

    expect(result.statusCode).toBe(400);
  });

  it("removes connection with valid context", async () => {
    const removed: Array<{ eventId: string; connectionId: string }> = [];
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
});

describe("connection cleanup store", () => {
  it("deletes expected ws connection key", async () => {
    const db = createInMemoryDb();
    const store = createConnectionCleanupStore({ db });

    await store.removeConnection({ eventId: "evt_1", connectionId: "conn_1" });

    expect(db.deletedKeys).toEqual([
      {
        PK: "EVENT#evt_1",
        SK: "CONN#conn_1",
      },
    ]);
  });
});
