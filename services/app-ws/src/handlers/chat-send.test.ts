import { describe, expect, it } from "vitest";

import { createChatSendAction, createEventChatBroadcaster } from "./chat-send.js";

describe("chat send action", () => {
  it("persists and broadcasts chat message payload", async () => {
    const saved: Array<{
      connectionId?: string;
      eventId: string;
      text: string;
      messageId: string;
      receivedAtEpoch: number;
    }> = [];
    const broadcasted: Array<{
      connectionId?: string;
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
    });

    const result = await action({ connectionId: "conn_1", eventId: "evt_1", text: "hello" });

    expect(result).toEqual({ accepted: true, action: "chat:send" });
    expect(saved).toHaveLength(1);
    expect(saved[0]?.text).toBe("hello");
    expect(saved[0]?.eventId).toBe("evt_1");
    expect(broadcasted).toHaveLength(1);
    expect(broadcasted[0]?.connectionId).toBe("conn_1");
    expect(broadcasted[0]?.messageId).toContain("msg_");
  });

  it("cleans up stale connections when sender reports gone", async () => {
    const removed: Array<{ eventId: string; connectionId: string }> = [];

    const broadcaster = createEventChatBroadcaster({
      db: {
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
      eventId: "evt_1",
      text: "hello",
      messageId: "msg_1",
      receivedAtEpoch: 1_700_000_000,
    });

    expect(removed).toEqual([{ eventId: "evt_1", connectionId: "conn_stale" }]);
  });
});
