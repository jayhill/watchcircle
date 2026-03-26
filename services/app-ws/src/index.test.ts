import { describe, expect, it } from "vitest";

import { CLIENT_ACTIONS } from "./index.js";

describe("ws scaffold", () => {
  it("includes moderation unboot action", () => {
    expect(CLIENT_ACTIONS).toContain("moderation:unboot");
  });
});
