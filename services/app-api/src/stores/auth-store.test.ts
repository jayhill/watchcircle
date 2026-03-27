import { describe, expect, it } from "vitest";

import { createAuthStores } from "./auth-store.js";

type TableItem = {
  PK: string;
  SK: string;
  [key: string]: unknown;
};

function createInMemoryDb() {
  const data = new Map<string, TableItem>();

  const keyOf = (key: { PK: string; SK: string }) => `${key.PK}|${key.SK}`;

  return {
    async getByKey<T>(key: { PK: string; SK: string }): Promise<T | null> {
      return (data.get(keyOf(key)) as T | undefined) ?? null;
    },
    async putItem<T extends object>(item: T): Promise<void> {
      const tableItem = item as TableItem;
      data.set(keyOf({ PK: tableItem.PK, SK: tableItem.SK }), tableItem);
    },
    async deleteByKey(key: { PK: string; SK: string }): Promise<void> {
      data.delete(keyOf(key));
    },
  };
}

describe("auth store", () => {
  it("stores and loads tokens", async () => {
    const stores = createAuthStores({ db: createInMemoryDb() });

    await stores.tokenStore.putToken({
      token: "123456",
      email: "user@example.com",
      eventId: "evt_1",
      createdAtEpoch: 100,
      ttlEpoch: 200,
    });

    const loaded = await stores.tokenStore.getToken("123456");
    expect(loaded?.eventId).toBe("evt_1");
    expect(loaded?.email).toBe("user@example.com");
  });

  it("increments rate limit counters", async () => {
    const stores = createAuthStores({ db: createInMemoryDb() });

    const first = await stores.counterStore.incrementWindowCounter({
      scope: "AUTH_REQ_IP",
      key: "1.2.3.4",
      windowStartEpoch: 1000,
      ttlEpochSeconds: 2000,
    });
    const second = await stores.counterStore.incrementWindowCounter({
      scope: "AUTH_REQ_IP",
      key: "1.2.3.4",
      windowStartEpoch: 1000,
      ttlEpochSeconds: 2000,
    });

    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("creates and reuses participant user id by email", async () => {
    const stores = createAuthStores({ db: createInMemoryDb() });

    const first = await stores.participantStore.ensureParticipant({
      eventId: "evt_1",
      email: "USER@example.com",
      displayName: "Alice",
    });

    const second = await stores.participantStore.ensureParticipant({
      eventId: "evt_2",
      email: "user@example.com",
      displayName: "Alice 2",
    });

    expect(first.userId).toBe(second.userId);
    expect(second.email).toBe("user@example.com");
  });

  it("keeps displayName immutable per event", async () => {
    const stores = createAuthStores({ db: createInMemoryDb() });

    const first = await stores.participantStore.ensureParticipant({
      eventId: "evt_1",
      email: "user@example.com",
      displayName: "Alice",
    });

    const second = await stores.participantStore.ensureParticipant({
      eventId: "evt_1",
      email: "user@example.com",
      displayName: "Alice Updated",
    });

    expect(first.userId).toBe(second.userId);
    expect(second.displayName).toBe("Alice");
  });

  it("assigns host role when email matches event creator", async () => {
    const db = createInMemoryDb();
    const stores = createAuthStores({ db });

    await db.putItem({
      PK: "EVENT#evt_1",
      SK: "META",
      creatorEmail: "host@example.com",
    });

    const participant = await stores.participantStore.ensureParticipant({
      eventId: "evt_1",
      email: "HOST@example.com",
      displayName: "Host User",
    });

    expect(participant.role).toBe("host");
  });
});
