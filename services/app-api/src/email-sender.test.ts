import { describe, expect, it, vi } from "vitest";

import { createNoopEmailSender, createSesEmailSender } from "./email-sender.js";

describe("email sender", () => {
  it("no-op sender resolves", async () => {
    const sender = createNoopEmailSender();

    await expect(
      sender.sendVerificationCode({
        email: "user@example.com",
        code: "123456",
        eventId: "evt_1",
      })
    ).resolves.toBeUndefined();
  });

  it("ses sender builds and sends a command", async () => {
    const send = vi.fn().mockResolvedValue({});
    const sender = createSesEmailSender({
      fromEmail: "noreply@example.com",
      region: "us-east-1",
      productName: "WatchCircle",
      client: { send },
    });

    await sender.sendVerificationCode({
      email: "user@example.com",
      code: "123456",
      eventId: "evt_1",
    });

    expect(send).toHaveBeenCalledTimes(1);
  });
});
