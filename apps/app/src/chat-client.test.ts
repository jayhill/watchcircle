import { describe, expect, it } from "vitest";

import { createChatClient } from "./chat-client.js";

class MockWebSocket {
  static OPEN = 1;

  readyState = MockWebSocket.OPEN;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: string[] = [];
  lastUrl: string;

  constructor(url: string) {
    this.lastUrl = url;
    MockWebSocket.instance = this;
  }

  static instance: MockWebSocket | null = null;

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }
}

describe("chat client", () => {
  it("connects and sends chat envelope", () => {
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

    const client = createChatClient();
    client.connect({
      wsUrl: "wss://example.test/ws",
      wsToken: "token_123",
      eventId: "evt_1",
    });

    client.sendChat("hello");

    const socket = MockWebSocket.instance;
    expect(socket).toBeDefined();
    expect(socket?.lastUrl).toContain("token=token_123");
    expect(socket?.lastUrl).toContain("eventId=evt_1");
    expect(socket?.sent[0]).toContain("chat:send");
  });

  it("emits parsed chat:new messages", () => {
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;

    const client = createChatClient();
    client.connect({
      wsUrl: "wss://example.test/ws",
      wsToken: "token_123",
      eventId: "evt_1",
    });

    let lastText = "";
    client.onChatMessage((message) => {
      lastText = message.text;
    });

    MockWebSocket.instance?.onmessage?.({
      data: JSON.stringify({
        action: "chat:new",
        payload: {
          message: {
            messageId: "msg_1",
            eventId: "evt_1",
            text: "hello world",
            userId: "usr_1",
            displayName: "Alice",
            role: "participant",
            createdAt: 1,
          },
        },
      }),
    });

    expect(lastText).toBe("hello world");
  });
});
