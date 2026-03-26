export interface WsEnvelope<TPayload = unknown> {
  action: string;
  payload: TPayload;
}

import { createDefaultConnectHandler } from "./dependencies.js";

export const CLIENT_ACTIONS = [
  "chat:send",
  "chat:react",
  "chat:flag",
  "chat:dm",
  "question:ask",
  "question:upvote",
  "question:removeUpvote",
  "question:flag",
  "highlight:create",
  "highlight:react",
  "sync:heartbeat",
  "moderation:hide",
  "moderation:unhide",
  "moderation:boot",
  "moderation:unboot",
  "chat:toggleEnabled",
  "questions:toggleEnabled",
] as const;

let cachedConnectHandler: ReturnType<typeof createDefaultConnectHandler> | null = null;

function getConnectHandler() {
  if (!cachedConnectHandler) {
    cachedConnectHandler = createDefaultConnectHandler();
  }

  return cachedConnectHandler;
}

export async function connectHandler(event: unknown) {
  return getConnectHandler()(event as never);
}

export async function disconnectHandler() {
  return {
    statusCode: 200,
    body: "disconnected",
  };
}

export async function defaultHandler() {
  return {
    statusCode: 200,
    body: "ok",
  };
}
