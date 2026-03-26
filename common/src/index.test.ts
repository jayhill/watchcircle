import { describe, expect, it } from "vitest";

import { CONTRACT_CONSTANTS } from "./index.js";

describe("contract constants", () => {
  it("keeps ws token ttl at 90 seconds", () => {
    expect(CONTRACT_CONSTANTS.WS_TOKEN_TTL_SECONDS).toBe(90);
  });
});
