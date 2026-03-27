import { describe, expect, it } from "vitest";

import {
  createChatSendAction,
  createDynamoSenderIdentityResolver,
  createEventChatBroadcaster,
} from "./chat-send.js";

describe("chat send action", () => {
  it("persists and broadcasts chat message payload", async () => {
    const saved: Array<{
      connectionId?: string;
      userId: string;
      displayName: string;
      role: "host" | "cohost" | "panelist" | "participant";
      eventId: string;
      text: string;
      messageId: string;
      receivedAtEpoch: number;
    }> = [];
    const broadcasted: Array<{
      connectionId?: string;
      userId: string;
      displayName: string;
      role: "host" | "cohost" | "panelist" | "participant";
      eventId: string;
      text: string;
      messageId: string;
      receivedAtEpoch: number;
    }> = [];

    const action = createChatSendAction({
      store: {
        async save(input) {
          saved.push(input);
        },
      },
      broadcaster: {
        async broadcast(input) {
          broadcasted.push(input);
          return;
        },
      },
      senderIdentityResolver: {
        async resolve() {
          return {
            userId: "usr_1",
            displayName: "Alice",
            role: "participant" as const,
          };
        },
      },
    });

    const result = await action({ connectionId: "conn_1", eventId: "evt_1", text: "hello" });

    expect(result).toEqual({ accepted: true, action: "chat:send" });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.text).toBe("hello");
    expect(saved[0]?.eventId).toBe("evt_1");
    expect(saved[0]?.displayName).toBe("Alice");
    expect(broadcasted).toHaveLength(1);
    expect(broadcasted[0]?.connectionId).toBe("conn_1");
    expect(broadcasted[0]?.messageId).toContain("msg_");
  });

  it("rejects send when sender identity cannot be resolved", async () => {
    const action = createChatSendAction({
      store: {
        async save() {
          return;
        },
      },
      broadcaster: {
        async broadcast() {
          return;
        },
      },
      senderIdentityResolver: {
        async resolve() {
          return null;
        },
      },
    });

    await expect(
      action({ connectionId: "conn_1", eventId: "evt_1", text: "hello" })
    ).rejects.toThrow(/SENDER_NOT_FOUND/);
  });

  it("cleans up stale connections when sender reports gone", async () => {
    const removed: Array<{ eventId: string; connectionId: string }> = [];

    const broadcaster = createEventChatBroadcaster({
      db: {
        async getByKey() {
          return null;
        },
        async putItem() {
          return;
        },
        async queryItems<T>() {
          const items = [
            {
              PK: "EVENT#evt_1",
              SK: "CONN#conn_stale",
              connectionId: "conn_stale",
            },
            {
              PK: "EVENT#evt_1",
              SK: "CONN#conn_live",
              connectionId: "conn_live",
            },
          ];
          return items as unknown as T[];
        },
      },
      sender: {
        async send(connectionId: string) {
          return connectionId === "conn_stale" ? "gone" : "sent";
        },
      },
      connectionCleanupStore: {
        async removeConnection(input: { eventId: string; connectionId: string }) {
          removed.push(input);
        },
      },
    });

    await broadcaster.broadcast({
      connectionId: "conn_src",
      userId: "usr_1",
      displayName: "Alice",
      role: "participant",
      eventId: "evt_1",
      text: "hello",
      messageId: "msg_1",
      receivedAtEpoch: 1_700_000_000,
    });

    expect(removed).toEqual([{ eventId: "evt_1", connectionId: "conn_stale" }]);
  });

  it("resolves sender identity from connection and participant records", async () => {
    const resolver = createDynamoSenderIdentityResolver({
      db: {
        async getByKey<T>(key: { PK: string; SK: string }): Promise<T | null> {
          if (key.SK === "CONN#conn_1") {
            return {
              PK: "EVENT#evt_1",
              SK: "CONN#conn_1",
              connectionId: "conn_1",
              userId: "usr_1",
              role: "participant",
            } as T;
          }

          if (key.SK === "USER#usr_1") {
            return {
              PK: "EVENT#evt_1",
              SK: "USER#usr_1",
              userId: "usr_1",
              displayName: "Alice",
              role: "participant",
            } as T;
          }

          return null;
        },
        async putItem() {
          return;
        },
        async queryItems<T>() {
          return [] as unknown as T[];
        },
      },
    });

    const resolved = await resolver.resolve({
      eventId: "evt_1",
      connectionId: "conn_1",
    });

    expect(resolved).toEqual({
      userId: "usr_1",
      displayName: "Alice",
      role: "participant",
    });
  });
});
