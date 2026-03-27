import { describe, expect, it } from "vitest";

import { createNoopWsSender } from "./ws-sender.js";

describe("ws sender", () => {
  it("no-op sender resolves", async () => {
    const sender = createNoopWsSender();
    await expect(sender.send("conn_1", { ok: true })).resolves.toBe("sent");
  });
});
