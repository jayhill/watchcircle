import { describe, expect, it } from "vitest";

import { getIpAddress, parseJsonBody } from "../http-utils.js";

describe("http utils", () => {
  it("parses json request body", () => {
    const body = parseJsonBody<{ ok: boolean }>({ body: '{"ok":true}' } as never);
    expect(body.ok).toBe(true);
  });

  it("extracts source ip", () => {
    const ip = getIpAddress({ requestContext: { http: { sourceIp: "1.2.3.4" } } } as never);
    expect(ip).toBe("1.2.3.4");
  });
});
