import { describe, expect, it } from "vitest";

import { createSessionTokenService } from "./session.js";

describe("session tokens", () => {
  it("creates and verifies session token", () => {
    const tokens = createSessionTokenService({
      sessionSecret: "session-secret",
      wsSecret: "ws-secret",
    });

    const token = tokens.sessions.createSessionToken({
      userId: "usr_1",
      email: "u@example.com",
      eventId: "evt_1",
      role: "participant",
      nowMs: Date.now(),
    });

    const claims = tokens.sessions.verifySessionToken(token);
    expect(claims.sub).toBe("usr_1");
    expect(claims.role).toBe("participant");
  });

  it("creates and verifies ws token", () => {
    const tokens = createSessionTokenService({
      sessionSecret: "session-secret",
      wsSecret: "ws-secret",
    });

    const token = tokens.ws.createWsToken({
      userId: "usr_1",
      eventId: "evt_1",
      role: "cohost",
      nowMs: Date.now(),
    });

    const claims = tokens.ws.verifyWsToken(token);
    expect(claims.aud).toBe("ws-connect");
    expect(claims.eventId).toBe("evt_1");
  });
});
