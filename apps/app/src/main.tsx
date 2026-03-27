import React from "react";
import { createRoot } from "react-dom/client";

import { createChatClient } from "./chat-client.js";
import type { ChatMessage } from "./types.js";

function App() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [wsUrl, setWsUrl] = React.useState("");
  const [wsToken, setWsToken] = React.useState("");
  const [eventId, setEventId] = React.useState("");
  const [connected, setConnected] = React.useState(false);
  const clientRef = React.useRef(createChatClient());

  React.useEffect(() => {
    return clientRef.current.onChatMessage((message) => {
      setMessages((current) => [...current, message]);
    });
  }, []);

  return (
    <main style={{ padding: "1rem", fontFamily: "sans-serif", maxWidth: 760, margin: "0 auto" }}>
      <h1>WatchCircle App</h1>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          placeholder="WS URL"
          value={wsUrl}
          onChange={(event) => setWsUrl(event.target.value)}
        />
        <input
          placeholder="WS token"
          value={wsToken}
          onChange={(event) => setWsToken(event.target.value)}
        />
        <input
          placeholder="Event ID"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
        />

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => {
              clientRef.current.connect({ wsUrl, wsToken, eventId });
              setConnected(true);
            }}
          >
            Connect
          </button>
          <button
            onClick={() => {
              clientRef.current.disconnect();
              setConnected(false);
            }}
          >
            Disconnect
          </button>
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        <textarea
          placeholder="Type chat message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
        />
        <button
          onClick={() => {
            const text = draft.trim();
            if (!text) {
              return;
            }

            clientRef.current.sendChat(text);
            setDraft("");
          }}
        >
          Send
        </button>
      </section>

      <section>
        <h2>Messages</h2>
        {messages.length === 0 ? <p>No messages yet.</p> : null}
        <ul>
          {messages.map((message) => (
            <li key={message.messageId}>
              <strong>{message.displayName}</strong>: {message.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const rootNode = document.getElementById("root");

if (!rootNode) {
  throw new Error("Root element not found");
}

createRoot(rootNode).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
