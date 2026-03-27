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

  it("validates chat:send payload text", async () => {
    const handler = createDefaultRouteHandler();
    const result = await handler({
      body: JSON.stringify({ action: "chat:send", payload: { text: "" } }),
    });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("INVALID_PAYLOAD");
  });

  it("dispatches chat:send to action handler", async () => {
    let capturedText = "";
    let capturedEventId = "";
    const handler = createDefaultRouteHandler({
      chatSendAction: async ({ text, eventId }) => {
        capturedText = text;
        capturedEventId = eventId;
        return { accepted: true, action: "chat:send" };
      },
    });

    const result = await handler({
      requestContext: { connectionId: "conn_1" },
      queryStringParameters: { eventId: "evt_1" },
      body: JSON.stringify({ action: "chat:send", payload: { text: "hello" } }),
    });

    expect(result.statusCode).toBe(200);
    expect(capturedText).toBe("hello");
    expect(capturedEventId).toBe("evt_1");
    expect(result.body).toContain("chat:send");
  });

  it("requires eventId context for chat:send", async () => {
    const handler = createDefaultRouteHandler({
      chatSendAction: async () => ({ accepted: true, action: "chat:send" }),
    });

    const result = await handler({
      requestContext: { connectionId: "conn_1" },
      body: JSON.stringify({ action: "chat:send", payload: { text: "hello" } }),
    });

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("MISSING_EVENT_CONTEXT");
  });
});
