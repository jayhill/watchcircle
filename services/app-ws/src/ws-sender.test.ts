import { describe, expect, it } from "vitest";

import { createNoopWsSender } from "./ws-sender.js";

describe("ws sender", () => {
  it("no-op sender resolves", async () => {
    const sender = createNoopWsSender();
    await expect(
      sender.send("conn_1", {
        action: "chat:new",
        payload: {
          message: {
            messageId: "msg_1",
            eventId: "evt_1",
            text: "hello",
            userId: "usr_1",
            displayName: "Alice",
            role: "participant",
            createdAt: 1,
          },
        },
      })
    ).resolves.toBe("sent");
  });
});
