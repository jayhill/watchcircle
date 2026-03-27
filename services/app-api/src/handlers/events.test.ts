import { describe, expect, it } from "vitest";

import { createDynamoEventStore, createEventHandlers } from "./events.js";

type TableItem = {
  PK: string;
  SK: string;
  [key: string]: unknown;
};

function createInMemoryDb() {
  const data = new Map<string, TableItem>();

  const keyOf = (key: { PK: string; SK: string }) => `${key.PK}|${key.SK}`;

  return {
    async putItem<T extends object>(item: T): Promise<void> {
      const tableItem = item as TableItem;
      data.set(keyOf({ PK: tableItem.PK, SK: tableItem.SK }), tableItem);
    },
    async getByKey<T>(key: { PK: string; SK: string }): Promise<T | null> {
      return (data.get(keyOf(key)) as T | undefined) ?? null;
    },
  };
}

describe("event handlers", () => {
  it("creates event and returns summary", async () => {
    const db = createInMemoryDb();
    const store = createDynamoEventStore({ db });
    const handlers = createEventHandlers({ store });

    const result = await handlers.createEvent({
      body: {
        title: "My Event",
        youtubeUrl: "https://youtube.com/watch?v=abc",
        creatorEmail: "HOST@Example.com",
      },
    });

    expect(result.statusCode).toBe(201);
    const body = result.body as { event: { eventId: string; creatorEmail: string } };
    expect(body.event.eventId).toContain("evt_");
    expect(body.event.creatorEmail).toBe("host@example.com");
  });

  it("returns 404 when event missing", async () => {
    const db = createInMemoryDb();
    const store = createDynamoEventStore({ db });
    const handlers = createEventHandlers({ store });

    const result = await handlers.getEvent({ eventId: "evt_missing" });
    expect(result.statusCode).toBe(404);
  });
});
