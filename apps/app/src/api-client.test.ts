import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./api-client.js";

describe("api client", () => {
  it("calls create event endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: async () => ({ event: { eventId: "evt_1" } }),
    });

    vi.stubGlobal("fetch", mockFetch);

    const api = createApiClient("https://api.example.com");
    const result = await api.createEvent({
      title: "T",
      youtubeUrl: "https://youtube.com/watch?v=abc",
      creatorEmail: "host@example.com",
    });

    expect(result.event.eventId).toBe("evt_1");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/events",
      expect.objectContaining({ method: "POST" })
    );
  });
});
