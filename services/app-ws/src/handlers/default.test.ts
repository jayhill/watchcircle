import { describe, expect, it } from "vitest";

import { createDefaultRouteHandler } from "./default.js";

describe("ws default route", () => {
  it("rejects missing body", async () => {
    const handler = createDefaultRouteHandler();
    const result = await handler({});

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("INVALID_ENVELOPE");
  });

  it("rejects unknown action", async () => {
    const handler = createDefaultRouteHandler();
    const result = await handler({
      body: JSON.stringify({ action: "unknown:action", payload: {} }),
    });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("UNKNOWN_ACTION");
  });

  it("accepts known action envelope", async () => {
    const handler = createDefaultRouteHandler();
    const result = await handler({
      body: JSON.stringify({ action: "chat:send", payload: { text: "hi" } }),
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain("accepted");
  });
});
