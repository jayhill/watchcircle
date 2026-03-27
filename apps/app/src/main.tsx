import React from "react";
import { createRoot } from "react-dom/client";

import { createApiClient } from "./api-client.js";
import { createChatClient } from "./chat-client.js";
import { readAppConfig } from "./config.js";
import type { ChatMessage } from "./types.js";

function App() {
  const config = React.useMemo(() => readAppConfig(), []);
  const apiClient = React.useMemo(() => createApiClient(config.appApiUrl), [config.appApiUrl]);
  const chatClientRef = React.useRef(createChatClient());

  const [eventId, setEventId] = React.useState("");
  const [title, setTitle] = React.useState("Test Watch Party");
  const [youtubeUrl, setYoutubeUrl] = React.useState("https://youtube.com/watch?v=dQw4w9WgXcQ");

  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [code, setCode] = React.useState("");

  const [sessionToken, setSessionToken] = React.useState("");
  const [wsToken, setWsToken] = React.useState("");
  const [connected, setConnected] = React.useState(false);
  const [status, setStatus] = React.useState("Idle");

  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);

  React.useEffect(() => {
    return chatClientRef.current.onChatMessage((message) => {
      setMessages((current) => [...current, message]);
    });
  }, []);

  return (
    <main style={{ padding: "1rem", fontFamily: "sans-serif", maxWidth: 840, margin: "0 auto" }}>
      <h1>WatchCircle App (Minimum Deploy/Test Flow)</h1>
      <p style={{ marginTop: 0 }}>Status: {status}</p>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        <h2>1) Create Event (Host)</h2>
        <input
          placeholder="Event title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          placeholder="YouTube URL"
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
        />
        <input
          placeholder="Host email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button
          onClick={async () => {
            setStatus("Creating event...");
            const result = await apiClient.createEvent({
              title,
              youtubeUrl,
              creatorEmail: email,
            });
            setEventId(result.event.eventId);
            setStatus(`Event created: ${result.event.eventId}`);
          }}
        >
          Create Event
        </button>
      </section>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        <h2>2) Verify Identity</h2>
        <input
          placeholder="Event ID"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
        />
        <input
          placeholder="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={async () => {
              setStatus("Requesting verification code...");
              await apiClient.requestCode({ email, eventId });
              setStatus("Code requested. Check email (or dev logs/store).");
            }}
          >
            Request Code
          </button>
          <input
            placeholder="Verification code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            onClick={async () => {
              setStatus("Verifying code...");
              const verify = await apiClient.verifyCode({
                email,
                eventId,
                code,
                displayName,
              });
              setSessionToken(verify.sessionToken);
              setStatus(`Verified as ${verify.user.displayName} (${verify.user.role})`);
            }}
          >
            Verify
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        <h2>3) Connect WebSocket</h2>
        <button
          onClick={async () => {
            setStatus("Requesting ws token...");
            const result = await apiClient.issueWsToken({
              sessionToken,
              body: { eventId },
            });
            setWsToken(result.wsToken);
            setStatus("WS token issued.");
          }}
        >
          Issue WS Token
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => {
              chatClientRef.current.connect({
                wsUrl: config.appWsUrl,
                wsToken,
                eventId,
              });
              setConnected(true);
              setStatus("WebSocket connected.");
            }}
          >
            Connect WS
          </button>
          <button
            onClick={() => {
              chatClientRef.current.disconnect();
              setConnected(false);
              setStatus("WebSocket disconnected.");
            }}
          >
            Disconnect WS
          </button>
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
        <h2>4) Chat</h2>
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

            chatClientRef.current.sendChat(text);
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
              <strong>{message.displayName}</strong> ({message.role}): {message.text}
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
