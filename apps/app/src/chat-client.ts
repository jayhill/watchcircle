import type { ChatMessage, ChatNewEvent } from "./types.js";

export interface ChatClient {
  connect(input: { wsUrl: string; wsToken: string; eventId: string }): void;
  disconnect(): void;
  sendChat(text: string): void;
  onChatMessage(listener: (message: ChatMessage) => void): () => void;
}

function parseIncomingMessage(raw: string): ChatMessage | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const candidate = parsed as Partial<ChatNewEvent>;

  if (candidate.action !== "chat:new") {
    return null;
  }

  const message = candidate.payload?.message;
  if (!message || typeof message !== "object") {
    return null;
  }

  return message as ChatMessage;
}

export function createChatClient(): ChatClient {
  let socket: WebSocket | null = null;
  const listeners = new Set<(message: ChatMessage) => void>();

  return {
    connect(input) {
      const url = new URL(input.wsUrl);
      url.searchParams.set("token", input.wsToken);
      url.searchParams.set("eventId", input.eventId);

      socket = new WebSocket(url.toString());

      socket.onmessage = (event) => {
        const message = parseIncomingMessage(String(event.data));
        if (!message) {
          return;
        }

        listeners.forEach((listener) => listener(message));
      };
    },

    disconnect() {
      socket?.close();
      socket = null;
    },

    sendChat(text) {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(
        JSON.stringify({
          action: "chat:send",
          payload: { text },
        })
      );
    },

    onChatMessage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
