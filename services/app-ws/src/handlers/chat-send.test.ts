import { describe, expect, it } from "vitest";

import { createChatSendAction } from "./chat-send.js";

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
});
