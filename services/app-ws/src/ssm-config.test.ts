import { describe, expect, it } from "vitest";

import { readWsSecretsFromEnv } from "./ssm-config.js";

describe("ws ssm config", () => {
  it("reads ws secrets from env", () => {
    process.env.SESSION_JWT_SECRET = "session-secret";
    process.env.WS_JWT_SECRET = "ws-secret";

    const secrets = readWsSecretsFromEnv();

    expect(secrets.sessionJwtSecret).toBe("session-secret");
    expect(secrets.wsJwtSecret).toBe("ws-secret");
  });

  it("throws when env secrets are missing", () => {
    delete process.env.SESSION_JWT_SECRET;
    delete process.env.WS_JWT_SECRET;

    expect(() => readWsSecretsFromEnv()).toThrow(/missing required env var/i);
  });
});
