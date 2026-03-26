import { describe, expect, it } from "vitest";

import {
  createMagicLinkService,
  generateVerificationCode,
  type MagicLinkToken,
} from "./magic-link.js";

function createInMemoryTokenStore() {
  const map = new Map<string, MagicLinkToken>();

  return {
    async putToken(token: MagicLinkToken): Promise<void> {
      map.set(token.token, token);
    },
    async getToken(token: string): Promise<MagicLinkToken | null> {
      return map.get(token) ?? null;
    },
    async deleteToken(token: string): Promise<void> {
      map.delete(token);
    },
  };
}

describe("magic-link", () => {
  it("generates 6 digit code", () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("issues and verifies code", async () => {
    const tokenStore = createInMemoryTokenStore();
    const service = createMagicLinkService({ tokenStore });

    const issued = await service.issueCode({
      email: "USER@example.com",
      eventId: "evt_1",
      nowMs: 1000,
    });
    const verified = await service.verifyCode({
      token: issued.token,
      email: "user@example.com",
      eventId: "evt_1",
      nowMs: 2000,
    });

    expect(verified.email).toBe("user@example.com");
  });

  it("rejects expired codes", async () => {
    const tokenStore = createInMemoryTokenStore();
    const service = createMagicLinkService({ tokenStore });

    const issued = await service.issueCode({
      email: "user@example.com",
      eventId: "evt_1",
      nowMs: 0,
    });

    await expect(
      service.verifyCode({
        token: issued.token,
        email: "user@example.com",
        eventId: "evt_1",
        nowMs: 16 * 60 * 1000,
      })
    ).rejects.toThrow(/expired/i);
  });
});
